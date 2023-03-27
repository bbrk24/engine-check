#!/usr/bin/env node
// @ts-check

const fs = require('fs');
const semver = require('semver');
const yargs = require('yargs');
const getIntersection = require('./getIntersection.js');

const argv = yargs(process.argv.slice(2))
    .alias({ v: 'version' })
    .option('package', {
        describe: 'The location of package.json',
        normalize: true,
        type: 'string',
    })
    .option('lockfile', {
        describe: 'The location of package-lock.json',
        normalize: true,
        type: 'string',
    })
    .option('engine', {
        default: 'node',
        describe: 'Which engine to check',
        type: 'string',
    })
    .option('find-limits', {
        conflicts: 'package',
        describe: 'Instead of validating package.json, find the limits of the lockfile',
        type: 'boolean',
    })
    .option('quiet', {
        alias: 'q',
        describe: "Don't report which packages fail",
        type: 'boolean',
    }).argv;

/** @param {Awaited<typeof argv>} argv */
const run = argv => {
    /** @param {string} msg */
    const error = msg => {
        process.exitCode = 1;
        if (!argv.quiet) {
            console.error(msg);
        }
    };

    /**
     * @type {{
     *  lockfileVersion?: number,
     *  packages: { [key: string]: { version: string, engines?: Partial<Record<string, string>> }}
     * }}
     */
    const lockfile = JSON.parse(fs.readFileSync(argv.lockfile || './package-lock.json').toString());

    if (lockfile.lockfileVersion === undefined || lockfile.lockfileVersion < 2) {
        error(
            "Older lockfiles don't include the engines object. Please upgrade to lockfile v2 or v3."
        );
        return;
    } else if (lockfile.lockfileVersion > 3 && !argv.quiet) {
        console.warn(`Lockfile v${lockfile.lockfileVersion} is newer than expected.`);
    }

    /**
     * @type {(readonly [string, string, string])[]}
     * @ts-expect-error The filter call ensures there's no undefineds */
    const versions = Object.entries(lockfile.packages)
        .map(el => [
            el[0].replace(/node_modules\//g, ''),
            el[1].version,
            el[1].engines && el[1].engines[argv.engine],
        ])
        .filter(el => el[0] && el[2]);

    if (argv.findLimits) {
        // Currently unused. Could find which exact packages are limiting it.
        // /** @type {Set<readonly [string, string, string]>} */
        // const limitList = new Set();
        // outer: for (const triple of versions) {
        //     for (const limit of limitList) {
        //         if (semver.subset(limit[2], triple[2])) {
        //             continue outer;
        //         }
        //         if (semver.subset(triple[2], limit[2])) {
        //             limitList.delete(limit);
        //         }
        //     }
        //     limitList.add(triple);
        // }

        /** @type {semver.Range | null} */
        let intersection = new semver.Range('*');

        for (const [, , version] of versions) {
            intersection = getIntersection(version, intersection);
            if (intersection === null) {
                error('No valid intersection of ranges exists.');
                return;
            }
        }

        let cleanStr = intersection.toString()
            // Replace e.g. '>=1.0.0 <2.0.0-0' with '^1.0.0'
            .replace(/>=([1-9]\d*)\.(\d+\.\d+) <(\d+)\.0\.0-0/g, (match, firstMajor, firstMinorPatch, secondMajor) => {
                if (+firstMajor + 1 === +secondMajor) return `^${firstMajor}.${firstMinorPatch}`;
                return match;
            })
            // Replace e.g. '>=1.0.0 <1.1.0-0' with '~1.0.0'
            .replace(/>=(\d+)\.(\d+)\.(\d+) <\1\.(\d+)\.0-0/g, (match, major, firstMinor, patch, secondMinor) => {
                if (major === '0' && firstMinor === '0') return match;
                if (+firstMinor + 1 === +secondMinor) return `~${major}.${firstMinor}.${patch}`;
                return match;
            })
            // Insert spaces around ||
            .replace(/\|\|/g, ' || ');
        
        console.log(cleanStr);
    } else {
        /** @type {{ engines?: Partial<Record<string, string>>}} */
        const package = JSON.parse(fs.readFileSync(argv.package || './package.json').toString());

        if (!package.engines || !package.engines[argv.engine]) {
            process.exitCode = 1;
            console.error(`No engines.${[argv.engine]} is present in ${argv.package}.`);
            return;
        }
        if (!semver.validRange(package.engines[argv.engine])) {
            error(
                `engines.${[argv.engine]} "${package.engines[argv.engine]}" is not a valid semver range.`
            );
            return;
        }

        for (const [packageName, packageVersion, engineVersions] of versions) {
            /** @ts-expect-error It can do narrowing on dot access but not bracket access */
            if (!semver.subset(package.engines[argv.engine], engineVersions)) {
                error(`${packageName}@${packageVersion} requires ${argv.engine} "${engineVersions}".`);
            }
        }
    }
};

if (argv instanceof Promise) argv.then(run, e => {
    process.exitCode = 1;
    console.error(e);
});
else run(argv);

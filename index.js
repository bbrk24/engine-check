#!/usr/bin/env node
// @ts-check

const fs = require('fs');
const semver = require('semver');
const yargs = require('yargs');

const argv = yargs(process.argv.slice(2))
    .alias({ v: 'version' })
    .option('package', {
        default: './package.json',
        describe: 'The location of package.json',
        normalize: true,
        type: 'string'
    })
    .option('lockfile', {
        default: './package-lock.json',
        describe: 'The location of package-lock.json',
        normalize: true,
        type: 'string'
    })
    .option('engine', {
        default: 'node',
        describe: 'Which engine to check',
        type: 'string'
    })
    .option('quiet', {
        alias: 'q',
        describe: "Don't report which packages fail",
        type: 'boolean',
        hidden: false
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

    /** @type {{ engines?: Partial<Record<string, string>>}} */
    const package = JSON.parse(fs.readFileSync(argv.package).toString());

    if (!package.engines?.[argv.engine]) {
        process.exitCode = 1;
        console.error(`No engines.${[argv.engine]} is present in ${argv.package}.`);
        return;
    }
    if (!semver.validRange(package.engines[argv.engine])) {
        error(`engines.${[argv.engine]} "${package.engines[argv.engine]}" is not a valid semver range.`);
        return;
    }

    /**
     * @type {{
     *  lockfileVersion?: number,
     *  packages: { [key: string]: { version: string, engines?: Partial<Record<string, string>> }}
     * }}
     */
    const lockfile = JSON.parse(fs.readFileSync(argv.lockfile).toString());

    if (lockfile.lockfileVersion == null || lockfile.lockfileVersion < 2) {
        error("Older lockfiles don't include the engines object. Please upgrade to lockfile v2 or v3.");
        return;
    }

    /**
     * @type {[string, string, string][]}
     * @ts-expect-error The filter call ensures there's no undefineds */
    const versions = Object.entries(lockfile.packages)
        .map(/** @returns {[string, string, string | undefined]} */ el =>
            [el[0].replace(/node_modules\//g, ''), el[1].version, el[1].engines?.[argv.engine]]
        )
        .filter(el => el[0] && el[2]);

    for (const [packageName, packageVersion, engineVersions] of versions) {
        /** @ts-expect-error It can do narrowing on dot access but not bracket access */
        if (!semver.subset(package.engines[argv.engine], engineVersions)) {
            error(`${packageName}@${packageVersion} requires ${argv.engine} "${engineVersions}".`);
        }
    }
};

if (argv instanceof Promise) argv.then(run, e => {
    process.exitCode = 1;
    console.error(e);
});
else run(argv);

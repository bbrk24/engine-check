# engine-check

A simple CLI tool to check your engine versions.

Known limitations:

- v2 and v3 lockfiles include all dependencies' `engines` objects in the package-lock.json. Older lockfile versions don't, so this tool doesn't work for those.
- Yarn lockfiles are unsupported.

## Installation

This isn't published on npm yet, so currently you have to add the github url to the package.json manually. Add this to `devDependencies`, not `dependencies`.

Alternatively, you can clone this repo and then `npm i -g .` to install it globally.

## Usage

```sh
npx engine-check [options]
```

Options:

- `-q`, `--quiet`: If specified, this doesn't say which packages have mismatched engines, and only returns a non-zero exit code to indicate there was a mismatch.
- `--no-quiet`, `--quiet=false`, `-q=false`: Cancels an earlier `--quiet`.
- `--lockfile <path>`: Sets the location of the lockfile. If not given, defaults to "./package-lock.json".
- `--package <path>`: Sets the location of the package.json. If not given, defaults to "./package.json".
- `--engine <string>`: Which engine to check. If not given, defaults to "node".
- `--find-limits`: Instead of validating package.json, find the limiting packages in the lockfile. Mutually exclusive with `--package`.

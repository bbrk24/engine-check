# engine-check

A simple CLI tool to check your engine versions.

Known limitations:

- v2 and v3 lockfiles include all dependencies' `engines` objects in the package-lock.json. Older lockfile versions don't, so this tool doesn't work for those.
- Yarn lockfiles are unsupported.

# Build, CI/CD and Release

## Branches
- `main`: production-ready
- `feature/<name>`: feature work
- `bugfix/<name>`: corrections
- `docs/<name>`: documentation
- `release/vX.Y.Z`: stabilization when needed

Use Conventional Commits such as `feat(transactions): add filters`.

## Pull request gate
```bash
npm ci
npm run ci:validate
```
PRs require focused tests for changed behavior and a review of migrations, privacy boundaries and user-facing translations.

## CI
Pushes and pull requests should run on Node `^20.19.0 || ^22.13.0 || >=24`, matching `package.json` `engines`:
1. checkout;
2. `npm ci`;
3. `npm run ci:validate`;
4. upload build/test evidence when configured.

A successful main build deploys `dist/` to GitHub Pages through `.github/workflows/deploy-pages.yml`.

## Release
1. Update the version in `package.json`. There is no CHANGELOG file.
2. Run `npm ci` and `npm run ci:validate`.
3. Test the production build with `npm run preview`.
4. Validate PWA manifest, service worker, routing fallback and offline core flow.
5. Tag `vMAJOR.MINOR.PATCH`.
6. Deploy and run a production smoke test.

Dexie schema changes need migration notes and old-version upgrade tests. Breaking backup-format changes require a major version or an explicit compatibility migration.

## Environment variables
Only `VITE_*` values intended to be public at build time may be used. They are embedded in client assets and must never contain secrets.

## Logging and monitoring
The application has no default telemetry. Production validation uses local browser tooling and user-reported diagnostics with sensitive data removed.

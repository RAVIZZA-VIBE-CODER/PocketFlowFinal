# PocketFlowFinal Agent Guide

This repository is the public, sanitized PocketFlow snapshot. The runnable app
lives in `receive-hub/` and the product website lives in `website/`; the repository does not include the private project's
`.codex` routing maps, services, credentials, or local data.

## Before Changing Code

1. Read `README.md` for the public/private boundary.
2. Read `APP_BRANCHES.md` when changing a standalone app package.
3. Inspect the relevant source under `receive-hub/src/` and its imports before
   editing.

Keep public-safe wrappers and disabled integrations public-safe. Do not restore
private endpoints, contacts, account data, wallet experiments, relay history,
delivery credentials, or machine-specific paths.

## Validation

From the repository root, run:

```bash
npm --prefix receive-hub run lint
npm --prefix receive-hub run build
npm --prefix website run build
node scripts/scan-public-release.mjs
```

When dependency metadata changes, install with `npm --prefix receive-hub ci`
before running the checks above.

## Safety

- Never print or commit secrets, tokens, passwords, private keys, or personal
  data.
- Track environment variable names, never values.
- Keep changes scoped to this public snapshot; verify private-system assumptions
  against source rather than copying behavior from the private repository.
- Treat `app-bundles-index.json` and `APP_BRANCHES.md` as the source of truth for
  the standalone public branches.

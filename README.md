# Archive / Reader

Edition: public

Branch: `codex/public/archive-reader`

This is a single-app source package extracted from PocketFlow. It is intended for:

- downloading one app without pulling the full phone system,
- reviewing one app in isolation,
- re-integrating the app into the PocketFlow shell,
- preparing app-specific competition/demo packages.

Primary component:

```
receive-hub/src/components/ArchivePublicApp.tsx
```

Included source files: 9

Notes:

- Public packages are sanitized and contain only approved public app surfaces.
- Private packages are generated from the private backup and should remain in private repositories only.
- The generated `src/main.tsx` is a lightweight shell. Some components need host props from the main PocketFlow shell.

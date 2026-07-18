# Codex Operating Guide

This repository uses a source-derived routing map instead of a prose wiki.

Before changing code, read:

1. `.codex/codex-map.yaml`
2. The module map named by the route you are touching.
3. Any linked flow, contract, invariant, or risk file.

Do not start with broad repo scans unless the map is missing, stale, or the task crosses unknown boundaries.

## Routing Rules

- Use `.codex/codex-map.yaml` to find the right module.
- Use `.codex/modules/*.yaml` for entry points, source files, data stores, invariants, and known risks.
- Use `.codex/flows/*.yaml` for user-visible workflows.
- Use `.codex/contracts/*.yaml` for API, storage, bridge, and file-shape expectations.
- Use `.codex/generated/*.json` only as source-derived inventory, not as product intent.

## Safety Rules

- Do not print secrets, tokens, passwords, or private keys.
- Track env var names, never values.
- Do not silently change app behavior while updating maps.
- If a map has low confidence, verify with source before editing.
- If phone, relay, model, or storage claims are made, verify with a command or label them as inferred.

## Validation

Run:

```bash
npm run codex-map:check
```

Use this map as the memory spine for PocketFlow, BalossLLM, BigBrain/Tommyboy, Relay, Reader/Archive, News, CRM, and Moltbook agent work.

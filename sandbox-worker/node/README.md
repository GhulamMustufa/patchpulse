# PatchPulse Node.js & TypeScript Sandbox Worker

Runs untrusted JavaScript (`.js`, `.mjs`, `.cjs`) and TypeScript (`.ts`, `.tsx`) tests inside an isolated offline sandbox.

## Pinned Runtime Versions
- **Node.js LTS:** `20.19.4` (`node:20.19.4-bookworm-slim`)
- **TypeScript:** `5.9.3`

## Building Production Container Image
```bash
docker build -t necrocode-sandbox:node20 ./sandbox-worker/node
```

## Security Guarantees & Limitations
- Runs as unprivileged UID/GID `65534:65534`.
- `--network=none`, `--read-only`, `--cap-drop=ALL`, `--security-opt=no-new-privileges:true`, `--pids-limit=32`, `--memory=256m`, `--cpus=0.5`.
- Never executes `package.json` lifecycle scripts or repository-defined test commands.
- Local macOS fallback uses `/usr/bin/sandbox-exec` (Seatbelt) + `--max-old-space-size=128`; Linux Docker isolation is required for public multi-tenant deployments.

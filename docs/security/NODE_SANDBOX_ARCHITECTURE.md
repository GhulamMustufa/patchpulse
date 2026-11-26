# NecroCode — Node.js & TypeScript Sandbox Architecture

**Status:** Implemented & Tested Locally (`seatbelt` driver); Linux `docker` driver implemented, awaiting live Linux Docker daemon verification.  
**Pinned Runtimes:** Node.js `20.19.4` LTS (`node:20.19.4-bookworm-slim`), TypeScript `5.9.3`.

---

## 1. Architecture Overview

`sandbox-worker/server.mjs` routes jobs by `runtime`:
- `runtime: "python"` → `sandbox-worker/executor.mjs` (`runner.py`)
- `runtime: "node"` → `sandbox-worker/node/executor.mjs` (`sandbox-worker/node/runner.mjs`)

Both workers share the authenticated gateway, Zod schema contracts (`src/lib/necro-engine/schemas.ts`), and job manager (`src/lib/necro-engine/sandbox-jobs.ts`), while keeping execution strictly outside the Next.js server process.

---

## 2. Isolation Controls Implemented

| Control | Docker Driver (Linux Production Target) | Seatbelt Driver (macOS Local Dev/Test) |
|---|---|---|
| Unprivileged user | `--user=65534:65534` | Runs under user MAC sandbox without `/Users` read access |
| Network isolation | `--network=none` | `(deny network*)` |
| Filesystem isolation | `--read-only`, workspace mounted `:ro`, writable `--tmpfs /tmp:rw,noexec,nosuid,nodev,size=48m` | `(deny file-write*)` outside job dir; `(deny file-read* (subpath "/Users"))`; isolated `/tmp/necro-tsc-5.9.3-v2` read-only cache |
| Memory & CPU caps | `--memory=256m --memory-swap=256m --cpus=0.5` | `NODE_OPTIONS=--max-old-space-size=128` + wall-clock `SIGKILL` |
| Process & FD limits | `--pids-limit=32 --ulimit nofile=64:64` | Process-group `SIGKILL` cleanup |
| Environment scrubbing | Zero host secrets passed | Minimal env (`PATH`, `HOME=/nonexistent`, `NODE_OPTIONS`, `NECRO_TSC_BIN`) |
| Workspace cleanup | `docker rm -f` + `fs.rmSync(jobDir)` in `finally` | `fs.rmSync(jobDir)` in `finally` |

---

## 3. Verification Status Matrix

| Capability | Status |
|---|---|
| `node --check`, relative import & CJS/ESM checks | **Implemented & Tested locally** |
| Pinned `tsc --noEmit` & controlled TS compilation | **Implemented & Tested locally** |
| Built-in `node:test` execution via TAP parser | **Implemented & Tested locally** |
| Linux Docker container isolation | **Implemented; NOT yet verified live (Docker daemon stopped locally)** |
| Jest / Vitest test execution with third-party deps | **Unsupported in offline sandbox (flagged as `VERIFICATION_BLOCKED`)** |

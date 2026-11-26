# NecroCode — Multi-Language Sandbox Threat Model (Python, JS, TS)

**Scope:** Multi-language ingestion, dependency inspection, Python 3.12 worker, and Node.js 20 / TypeScript 5.9 worker.

---

## 1. Threat Matrix & Empirical Verification

| Threat | Target Runtime | Mitigation | Status |
|---|---|---|---|
| Host secret / env exfiltration (`os.environ`, `process.env`) | Python & Node | Scrubbed worker environment; zero host secrets passed | **Implemented & Tested locally** |
| Host filesystem read/write (`open`, `fs.readFileSync`, `child_process`) | Python & Node | Seatbelt `(deny file-read* (subpath "/Users"))` & `(deny file-write*)` outside job dir; Docker `--read-only` & workspace isolation | **Implemented & Tested locally (`seatbelt`)**; Docker **not yet verified live** |
| Outbound network / SSRF (`socket`, `net.connect`) | Python & Node | Seatbelt `(deny network*)`; Docker `--network=none` | **Implemented & Tested locally (`seatbelt`)**; Docker **not yet verified live** |
| Malicious lifecycle scripts & dependency URLs | Node.js | `evaluateNodeDependencyPolicy()` blocks `postinstall`/VCS/URL/`file:`/`.npmrc` before worker dispatch | **Implemented & Tested locally** |
| `tsconfig.json` `extends` path escape | TypeScript | `validateTsConfigSafety()` rejects `..` or absolute `extends` paths | **Implemented & Tested locally** |
| Infinite loops & output floods | Python & Node | Process-group `SIGKILL` timeout + 64 KB output truncation | **Implemented & Tested locally** |
| Memory exhaustion & process spawning | Python & Node | `NODE_OPTIONS=--max-old-space-size=128`, `resource.setrlimit`, Docker `--memory` & `--pids-limit=32` | **Implemented & Tested locally** (`seatbelt` advisory RAM; Docker cgroups **not yet verified live**) |
| Symbolic links & path traversal | All | Rejected in ZIP extractor, GitHub tree scanner, job orchestrator, and worker `lstatSync` | **Implemented & Tested locally** |

# PatchPulse — Python Sandbox Threat Model

> **In plain English:** This table lists every security risk when running untrusted Python code (secret theft, file reads, internet access, infinite loops, and fork bombs) and how PatchPulse blocks it.

**Scope:** Untrusted Python repository ingestion, dependency safety checks, worker API, and isolated execution runtime.

---

## 1. Threat Matrix & Mitigations

| ID | Threat / Attack Vector | Impact | Mitigation Implemented | Verification Test |
|---|---|---|---|---|
| TM-01 | **Host Secret / Env Exfiltration** (`os.environ`, reading `.env`) | Compromise of `GEMINI_API_KEY`, `DATABASE_URL`, `SANDBOX_WORKER_TOKEN` | Worker scrubs environment to minimal safe vars (`PYTHONNOUSERSITE=1`, `PYTHONDONTWRITEBYTECODE=1`, `HOME=/nonexistent`). Next.js never executes untrusted code. | `sandbox_security.test.ts` (`os.environ` probe) |
| TM-02 | **Host Filesystem Traversal & Read** (`open('../../package.json')`, `open('/etc/passwd')`, `../` file paths) | Source/credential disclosure, host file tampering | Pre-execution path validator rejects `..`, absolute paths, null bytes. Docker mounts workspace strictly under `/workspace`; Seatbelt denies reads under `/Users`, `/private/etc/master.passwd`, `/private/var/root`, and writes outside job temp dir. | `sandbox_security.test.ts` (traversal & host file read probes) |
| TM-03 | **Malicious Symbolic Links** (Symlink pointing to `/etc/passwd` or `.env`) | Arbitrary file read via symlink dereference | Ingestion (`zip.ts`, `github.ts`) rejects POSIX symlinks (`0o120000`) and git mode `120000`. Sandbox API also rejects symlink-like or unsafe paths and uses `lstatSync` checks before running. | `sandbox_security.test.ts` + `github_zip_ingest.test.ts` |
| TM-04 | **Outbound Network / SSRF / Data Exfiltration** (`socket`, `urllib.request`, reverse shells) | Exfiltrating data or attacking internal metadata (`169.254.169.254`) | Docker `--network=none`; Seatbelt `(deny network*)`. No network interface inside execution phase. | `sandbox_security.test.ts` (TCP & HTTP probe) |
| TM-05 | **Fork Bomb / Process Exhaustion** (`while True: os.fork()`) | Worker DoS / host freeze | Docker `--pids-limit=32`; Python wrapper `RLIMIT_NPROC` limit; process-group `SIGKILL` on timeout. | `sandbox_security.test.ts` (fork bomb probe) |
| TM-06 | **Infinite Loop / CPU Exhaustion** (`while True: pass`) | Worker starvation | Hard wall-clock timeout (`AbortController` / `setTimeout` -> `SIGKILL` process group) + `RLIMIT_CPU`. | `sandbox_security.test.ts` (infinite loop timeout & cleanup) |
| TM-07 | **Memory Exhaustion** (`bytearray(1024**3)`) | OOM crash affecting concurrent jobs | Docker `--memory=128m --memory-swap=128m`; `RLIMIT_AS` / `RLIMIT_DATA` cap in `runner.py`; worker error isolation catches child OOM exits cleanly without crashing the worker HTTP server. | `sandbox_security.test.ts` (memory allocation bomb) |
| TM-08 | **Oversized Stdout/Stderr Flood** (`print("A" * 10_000_000)`) | Memory/log DoS in Next.js or UI | Stream reader aborts/truncates stdout & stderr at 64 KB per stream and kills runaway producer if needed. | `sandbox_security.test.ts` (log flood probe) |
| TM-09 | **Dependency Supply-Chain / `setup.py` RCE** (`git+https://...`, `--extra-index-url`, `-e .`) | RCE during `pip install` | Dependency policy parser rejects VCS/URL/index/editable flags; never runs `pip install` or `setup.py` inside network-enabled host; returns `DEPENDENCY_PREPARATION_FAILED`. | `sandbox_security.test.ts` (malicious `requirements.txt` probe) |
| TM-10 | **Unauthorized Worker / Job Access** | Unauthenticated RCE via exposed worker or cross-user job snooping | Worker requires `Authorization: Bearer <SANDBOX_WORKER_TOKEN>` (timing-safe compare). Job API binds jobs to a caller `jobAccessToken` and enforces concurrency/duplicate limits. | `sandbox_security.test.ts` (unauthenticated worker + unauthorized job ID probes) |
| TM-11 | **Temp Directory / Container Leak on Timeout or Crash** | Disk exhaustion or stale leftover containers | `try / finally` removes ephemeral temp dir (`fs.rmSync(..., { recursive: true, force: true })`) and issues `docker rm -f <containerName>` on timeout, error, or crash. | `sandbox_security.test.ts` (post-timeout & crash cleanup verification) |

---

## 2. Residual Risks & Operational Guidance

1. **Docker vs macOS Seatbelt:** On macOS without Docker Desktop running, `seatbelt` enforces kernel MAC file/network denies and POSIX `rlimit`s, but shares the host kernel and Darwin treats `RLIMIT_AS` as advisory. **For internet-facing production deployments, `SANDBOX_DRIVER=docker` (or Firecracker/gVisor microVMs) on a dedicated Linux host is mandatory.**
2. **Untrusted `setup.py`:** `setup.py` is inspected statically only and never executed.
3. **Worker Network Boundary:** `sandbox-worker` must never be exposed on a public ingress; bind to `127.0.0.1` or private VPC subnet with `SANDBOX_WORKER_TOKEN`.

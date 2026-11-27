# PatchPulse — Sandbox Security & Isolation Test Results

> **In plain English:** Real test results proving our sandbox blocks secret leaks, host file access, internet calls, and infinite loops instead of just claiming it works.

**Environment Verified:** macOS Darwin (arm64), Python 3.12 (`/opt/homebrew/bin/python3.12`)  
**Active Driver Verified:** `seatbelt` (`/usr/bin/sandbox-exec` + `resource.setrlimit` + scrubbed environment + ephemeral `mkdtemp` workspace; also supports `docker` when container images are built locally).

---

## 1. Executed Isolation & Security Test Matrix (`src/lib/__tests__/sandbox_security.test.ts`)

| Test Case | Attack / Behavior Tested | Observed Result |
|---|---|---|
| Dependency attack rejection | `git+https://...`, `--extra-index-url`, `-e file:///etc/passwd` in `requirements.txt` | **PASSED** (`DEPENDENCY_PREPARATION_FAILED`, execution blocked before worker) |
| Fail-closed when unconfigured | `POST /api/sandbox/execute` with no `SANDBOX_WORKER_URL` / `SANDBOX_WORKER_TOKEN` | **PASSED** (`VERIFICATION_BLOCKED`; refuses to execute on Next.js host) |
| Path traversal & symlinks | `../../etc/passwd.py` and `isSymlink: true` | **PASSED** (rejected before writing to temp workspace) |
| Passing Python 3.12 tests | `unittest.TestCase` passing test inside real Seatbelt sandbox | **PASSED** (`PASSED`, `1/1`, `exitCode=0`, `cleanupVerified=true`) |
| Truthful empty / partial runs | Repo with 0 tests & repo with 1 pass + 1 fail | **PASSED** (`NO_TESTS_FOUND` -> `SYNTAX_VERIFIED`; mixed -> `PARTIAL` -> `PARTIALLY_RESURRECTED`) |
| Env secret & host FS & network isolation | `os.environ` secret canary check, `open(package.json)`, `open(/tmp/escape.txt, 'w')`, `socket.create_connection(('1.1.1.1', 80))` | **PASSED** (all host secrets absent; all reads/writes/sockets raised `PermissionError`) |
| Timeout & log flood & cleanup | Infinite loop (`while True: pass` @ 1200ms), `os.write(1, b'A'*150000)` flood, temp dir leak check | **PASSED** (`timedOut=true`, `outputTruncated=true`, `status=FAILED`, 0 leaked temp dirs) |
| Fork / memory containment | Repeated `os.fork()` attempts inside sandbox | **PASSED** (contained cleanly, `cleanupVerified=true`, worker unaffected) |
| Worker Bearer auth, job ACL, dedup, concurrency | Direct worker unauth `401`, `x-job-token` `401`/`403`/`200`, SHA-256 deduplication, 2 concurrent jobs | **PASSED** (all access controls, dedup, and concurrent isolation verified) |

**Suite Summary:** 9/9 tests in `src/lib/__tests__/sandbox_security.test.ts` passed (`9863ms` total execution time).

---

## 2. Honest Isolation Scope Statement

* **What IS verified empirically here:** On macOS Darwin 25.4.0, the `seatbelt` driver genuinely blocks outbound network access, host user-directory file reads, outside-workspace writes, host environment variable inheritance, runaway loops, and stdout floods, and deletes ephemeral workspaces in `finally`.
* **What is NOT yet tested live on this machine:** The Linux `docker` driver (`--network=none --read-only --cap-drop=ALL --pids-limit=32 --memory=128m`) could not run live because the Docker daemon is not running locally. Linux container isolation MUST be tested on the target Docker host prior to public production exposure.

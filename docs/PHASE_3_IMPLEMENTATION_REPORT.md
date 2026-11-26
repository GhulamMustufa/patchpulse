# NecroCode — Phase 3 Implementation Report

**Date:** 2026-11-26  
**Objective:** Implement isolated Python 3.12 sandbox execution, controlled dependency policy, authenticated worker job management, real security isolation tests, and truthful resurrection states.

---

## 1. Architecture & Components Delivered

1. **Standalone Sandbox Worker (`sandbox-worker/`)**
   - `sandbox-worker/Dockerfile`: Unprivileged (`65534:65534`) `python:3.12-slim` image with pinned `pytest==8.3.4`.
   - `sandbox-worker/runner.py`: Non-shell fixed Python 3.12 verifier applying `resource.setrlimit`, `py_compile` syntax checking, `unittest` & `test_*` discovery/execution, and honest `NO_TESTS_FOUND` reporting.
   - `sandbox-worker/executor.mjs`: Ephemeral job directory creator (`0o700`), symlink & traversal guard, `docker` / `seatbelt` / fail-closed driver detection, scrubbed environment (zero host secrets), 64 KB output caps, process-group `SIGKILL` timeout, output sanitization, and `finally` cleanup.
   - `sandbox-worker/server.mjs`: Authenticated HTTP worker (`127.0.0.1:4100`, timing-safe Bearer auth, concurrency cap of 3 jobs, 2 MB body limit).

2. **Dependency Policy & Controlled Job API**
   - `src/lib/necro-engine/dependency-policy.ts`: Pre-execution inspection rejecting VCS/URL/editable/custom-index directives (`DEPENDENCY_PREPARATION_FAILED`).
   - `src/lib/necro-engine/sandbox-jobs.ts`: SHA-256 duplicate-submission deduplication, per-job `x-job-token` access authorization, active concurrency cap, and fail-closed `VERIFICATION_BLOCKED` when `SANDBOX_WORKER_URL` is unconfigured.
   - `src/app/api/sandbox/execute/route.ts` & `src/app/api/sandbox/jobs/[id]/route.ts`: Zod-validated API endpoints.

3. **Truthful UI Integration**
   - `src/app/page.tsx`, `ECGMonitor.tsx`, and `SideBySideDiff.tsx` updated with all 9 states (`DIAGNOSED`, `REPAIR_GENERATED`, `REPAIR_APPROVED`, `SYNTAX_VERIFIED`, `TESTS_RUNNING`, `RESURRECTED`, `PARTIALLY_RESURRECTED`, `FAILED`, `VERIFICATION_BLOCKED`), `"Run Sandbox Tests"` workflow, and sandbox metrics panel (`total`, `passed`, `failed`, `skipped`, `driver`, `durationMs`, `exitCode`).

---

## 2. Security & Verification Deliverables

* [SANDBOX_ARCHITECTURE.md](file:///Users/mac/Desktop/hackathones/active/2026-11-necrocode/docs/security/SANDBOX_ARCHITECTURE.md)
* [SANDBOX_THREAT_MODEL.md](file:///Users/mac/Desktop/hackathones/active/2026-11-necrocode/docs/security/SANDBOX_THREAT_MODEL.md)
* [SANDBOX_TEST_RESULTS.md](file:///Users/mac/Desktop/hackathones/active/2026-11-necrocode/docs/security/SANDBOX_TEST_RESULTS.md)
* [VERIFICATION_ENGINE.md](file:///Users/mac/Desktop/hackathones/active/2026-11-necrocode/docs/qa/VERIFICATION_ENGINE.md)

---

## 3. Infrastructure Limitations & Production Requirements

1. **Docker Daemon Not Running Locally:** Docker CLI (`29.6.1`) is installed, but the Docker daemon is stopped on this machine; local tests executed against the macOS `seatbelt` (`/usr/bin/sandbox-exec`) driver.
2. **Production Requirement:** Before exposing sandbox execution publicly, deploy `sandbox-worker/` on an isolated Linux host running Docker (`SANDBOX_DRIVER=docker`) or Firecracker microVMs, verify Docker isolation tests against the live daemon, and set `SANDBOX_WORKER_URL` + `SANDBOX_WORKER_TOKEN` privately.
3. **Playwright Browser Cache:** `@playwright/test` expects Chromium headless shell build `1248`, whereas local cache contains `1243` and `1255`; run `npx playwright install chromium` to execute browser E2E tests locally.

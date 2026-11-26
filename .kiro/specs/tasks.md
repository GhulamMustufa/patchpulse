# 📋 Ordered Implementation Tasks: NecroCode

---

### Phase 1 & 2: Foundation, Ingestion, Diagnosis & AI Repair
- [x] **Tasks 1.1–2.6:** Fix critical defects, implement GitHub/ZIP ingestion, Python diagnosis, Gemini + AST repair, and non-executing verification prep.

### Phase 3: Isolated Python Execution Sandbox
- [x] **Task 3.1:** Build standalone Python 3.12 sandbox worker (`sandbox-worker/runner.py`, `executor.mjs`, `server.mjs`, `Dockerfile`), controlled dependency policy, and job API (`/api/sandbox/execute`, `/api/sandbox/jobs/[id]`).
- [x] **Task 3.2:** Verify local Seatbelt isolation tests (`sandbox_security.test.ts` 9/9 passing) and create threat model / architecture docs.

### Phase 4A: JavaScript & TypeScript Multi-Language Support
- [x] **Task 4A.1:** Build dedicated Node.js 20.19.4 + TypeScript 5.9.3 sandbox worker (`sandbox-worker/node/`).
- [x] **Task 4A.2:** Implement language/framework detector (`language-detector.ts`) and strict Node dependency policy (`node-dependency-policy.ts`).
- [x] **Task 4A.3:** Extend diagnosis, deterministic/AI repair, unified sandbox routing, and UI telemetry (`node-diagnoser.ts`, `node-repair.ts`, `sandbox-jobs.ts`, `page.tsx`).
- [x] **Task 4A.4:** Verify JS, TS, dependency policy, and malicious isolation tests (`node_ts_sandbox_security.test.ts`).

### Remaining Operational Verification
- [ ] **Task 4B.1:** Run Docker container isolation suite against a live Linux Docker daemon before public internet deployment.
- [ ] **Task 4B.2:** Install Playwright Chromium (`npx playwright install chromium`) and run browser E2E suite in CI.

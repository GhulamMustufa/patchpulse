# NecroCode — Test Coverage & Verification Audit

**Audit Date:** 2026-11-26  
**Verified Commands Executed:** `npm test`, `npm run test:security`, `npx tsc --noEmit`, `npm run lint`, `npm run build`, `npx playwright test --reporter=list`, `npm ls --depth=0`, `next dev` route checks.

---

## 1. Observed Command & Test Execution Results

| Check | Command | Outcome | Observed Details |
|---|---|---|---|
| Unit Tests | `npm test` (`vitest run`) | **PASSED (12/12)** | 4 files passed in 641ms (`necro_engine.test.ts`: 8, `payments_auth.test.ts`: 2, `ai.test.ts`: 1, `db.test.ts`: 1). |
| TypeScript Check | `npx tsc --noEmit` | **FAILED (2 errors)** | `src/lib/__tests__/db.test.ts:11-12` — `TS2339: Property 'simulated'/'rows' does not exist on type 'Record<string, any>[] \| { simulated: boolean; rows: never[]; }'`. |
| ESLint | `npm run lint` (`next lint`) | **FAILED / BLOCKED** | Prompts interactively (`? How would you like to configure ESLint?`) and hangs because no ESLint config exists; `next lint` is deprecated in Next 15/16. |
| Production Build | `npm run build` (`next build`) | **PASSED** | Compiled 7/7 static pages (`/` 14.7 kB, `/dashboard` 5 kB, `/docs` 4.09 kB, `/api/health` dynamic). *Note:* Running `next dev` (e.g., via Playwright `webServer`) overwrites `.next/` and breaks subsequent `next start` (`Cannot find module './vendor-chunks/@opentelemetry.js'`). |
| Security Audit | `npm run test:security` | **PASSED (Misleading)** | `python3 scripts/security_audit.py` scanned 63 files, 0 violations; `semgrep` binary is **not installed**. |
| E2E Browser Suite | `npx playwright test --reporter=list` | **FAILED (5/5)** | 1) Chromium headless binary missing (`npx playwright install` not run); 2) All 5 assertions in `tests/e2e/smoke.spec.ts` target stale template strings that do not exist in NecroCode. |
| Live HTTP Routes | `next dev` + `curl` | **PARTIAL** | `GET /api/health` -> `200`, `GET /` -> `200`, `GET /dashboard` -> `200`, `GET /docs` -> `200`, `POST /api/agent/execute` -> **`404`**. |

---

## 2. Critical Test & Coverage Gaps

### [TC-01] Critical — E2E Test Suite (`tests/e2e/smoke.spec.ts`) Tests the Wrong App & Cannot Run
* **Severity:** Critical
* **Evidence:**
  * `tests/e2e/smoke.spec.ts:6`: expects title `/Hackathon/i` (actual title: `NecroCode | AI Software Resurrection Lab (AWS Kiroween)`).
  * `tests/e2e/smoke.spec.ts:8`: expects `"Official Hackathon Submission"` (does not exist on `/`).
  * `tests/e2e/smoke.spec.ts:32`: expects link `"Explore Live Interactive Demo"` -> `/dashboard` (does not exist on `/`).
  * `tests/e2e/smoke.spec.ts:36`: expects `"Project Command Center"` on `/dashboard` (actual heading is `"Command Center"`).
  * `tests/e2e/smoke.spec.ts:54`: expects `"Interactive Documentation"` on `/docs` (actual heading is `"Docs & API"`).
  * `AGENTS.md` Phase 4 ("Run `npx playwright test` to prove that real user journeys complete") cannot pass as-is.
* **Recommended Fix:** Install Playwright Chromium (`npx playwright install chromium`), rewrite `tests/e2e/smoke.spec.ts` to test real NecroCode user flows (patient switching, custom mode, resurrection workflow, autopsy report updates, error states, console-error check, 360px mobile viewport), and point `playwright.config.ts` at a clean build/start or isolated `.next` flow.
* **Dependencies & Priority:** P0.

### [TC-02] High — `npx tsc --noEmit` Fails on `src/lib/__tests__/db.test.ts`
* **Severity:** High
* **Evidence:** `src/lib/__tests__/db.test.ts:10-12` accesses `queryResult.simulated` and `queryResult.rows` without narrowing the union return type of `runQuery()` (`Record<string, any>[] | { simulated: boolean; rows: never[] }`), causing 2 `TS2339` errors.
* **Business / User Impact:** CI type-checking (`tsc --noEmit`) fails even though `next build` passes, violating `AGENTS.md` ("Zero TypeScript Errors") and `.kiro/steering/tech.md` ("Use strict TypeScript types").
* **Recommended Fix:** Give `runQuery()` a discriminated return type (or type guard) and fix `db.test.ts` type narrowing.
* **Dependencies & Priority:** P1.

### [TC-03] High — `npm run lint` Hangs Interactively
* **Severity:** High
* **Evidence:** Running `npm run lint` triggers Next.js's interactive ESLint setup prompt because neither `.eslintrc.*` nor `eslint.config.*` nor `eslint` devDependency exists in `package.json`.
* **Business / User Impact:** Any automated CI script or developer running `npm run lint` hangs indefinitely waiting for stdin.
* **Recommended Fix:** Configure ESLint CLI (`eslint` + `eslint-config-next`) non-interactively and update `package.json` `"lint"` script.
* **Dependencies & Priority:** P1.

### [TC-04] High — Engine Unit Tests Mask Fake Verification & Broken Custom Mode
* **Severity:** High
* **Evidence:**
  * `src/lib/__tests__/necro_engine.test.ts:101-123` calls `generateAutopsyReport(pyPatient)` and asserts `heartbeatBpm === 78` and `testsPassed === 3`, which only passes because `verifier.ts` ignores `resurrectedCode` and hardcodes `78` and `PASS`. There is **no negative test** passing broken code to `verifyResurrection()`!
  * `necro_engine.test.ts:85-98` only tests a trivial 6-line Python snippet (`print "Hello"`, `xrange(10)`, `except ZeroDivisionError, err:`)—it does **not** test:
    * Custom Node.js code (which would immediately expose the `export { k: v };` `SyntaxError` in `resurrector.ts:118`),
    * `print "x" # comment` or `print >> sys.stderr`,
    * Clean Python 3 code (which triggers a bogus `30%` toxicity score),
    * `from urllib2 import urlopen`,
    * `new Buffer(10)` or `new Buffer(x, 'hex')`.
* **Recommended Fix:** Add negative tests, custom JS/Python syntax-validity tests (using `python3 -m py_compile` / `node --check` or parser checks), and real failure-mode tests.
* **Dependencies & Priority:** P1.

### [TC-05] Medium — Zero Test Coverage for UI Components, API Routes & Error Paths
* **Severity:** Medium
* **Evidence:**
  * `src/app/api/health/route.ts` has no Vitest test (violating `.kiro/steering/tech.md:11`).
  * `src/components/necro/*` (`ECGMonitor`, `AutopsyReportCard`, `SideBySideDiff`, `PatientExhumationBar`) and `src/app/page.tsx` have zero component/unit tests (no `@testing-library/react` tests and no working Playwright tests).
  * `src/lib/__tests__/ai.test.ts` only tests the offline simulated branch (5 lines), never testing live Gemini error handling or schema validation.
* **Recommended Fix:** Add Vitest API route tests for `/api/health` and all new `/api/repo/*`, `/api/diagnose`, `/api/resurrect`, `/api/verify` routes, plus Playwright E2E coverage for all UI flows.
* **Dependencies & Priority:** P2.

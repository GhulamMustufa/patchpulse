# NecroCode — Phase 1 Product, Architecture & UI/UX Audit

**Audit Date:** 2026-11-26  
**Auditor Role:** Senior Software Architect, Product Manager, AI Engineering Specialist, UI/UX Reviewer, QA Engineer & Security Auditor  
**Repository State:** `main` @ `4134b9e` (read-only audit; zero application files modified)

---

## 1. Executive Summary of Product Reality

NecroCode positions itself as an **AI Software Autopsy & Resurrection Lab** where a user submits an abandoned Python (or Node.js) repository, receives a digital autopsy, gets AI-generated/deterministic repairs, executes tests in a safe sandbox, and sees verified proof of resurrection (`README.md`, `SUBMISSION.md`, `.kiro/specs/requirements.md`).

**What actually exists in the codebase today:**
The repository is a **partially customized Hackathon Starter Template** (`package.json` name: `"hackathon-mvp-starter"`). The root route (`/`) has been rebuilt into a visually cohesive dark-themed showcase (`src/app/page.tsx`) backed by a small client-side regex/preset module (`src/lib/necro-engine/`). However:
1. **No GitHub repository ingestion exists.** Users cannot submit a GitHub URL or multi-file repository.
2. **No real AI repair exists.** `src/lib/ai.ts` is unused by the UI, does not import `@google/generative-ai` or `ai`, and returns hardcoded strings even when `GEMINI_API_KEY` is set.
3. **No real test execution or sandbox exists.** `verifyResurrection()` in `src/lib/necro-engine/verifier.ts` ignores the `resurrectedCode` parameter completely and returns hardcoded `PASS` results and `78 BPM`.
4. **Two orphaned boilerplate routes** (`/dashboard` and `/docs`) remain unlinked from `/` and advertise nonexistent endpoints (`POST /api/agent/execute` returns `404`).

---

## 2. Architecture & Integration Audit

### [PA-01] Critical — Core Resurrection & Verification Pipeline Is Simulated / Hardcoded
* **Severity:** Critical
* **Evidence:**
  * `src/lib/necro-engine/resurrector.ts:18-41`: When `patientId` matches `PRESET_PATIENTS` and code matches `deadCode`, it bypasses transformation and returns `matchingPatient.expectedModernCode` verbatim.
  * `src/lib/necro-engine/verifier.ts:26-56`: `verifyResurrection(patient, resurrectedCode)` does not read, parse, or execute `resurrectedCode`; it maps `patient.testSuites` unconditionally to `passed: true`, `resurrectedResult: "PASS"`, `vitalState: "ALIVE"`, and `heartbeatBpm: 78`.
  * `src/app/page.tsx:53-73`: In custom mode (`isCustomMode`), `currentReport` hardcodes `deceasedYear: 2015`, `testsPassed: 3`, `testsTotal: 3`, and `heartbeatBpm: 78` regardless of input or repair success.
  * `src/components/necro/AutopsyReportCard.tsx:154-199`: The "Runtime Test Verification Matrix" table ignores `patient.testSuites` completely and instead iterates over `report.fatalErrors`, synthesizing cycling test names (`idx % 3`) and fake latencies (`10 + idx * 4` ms) that automatically flip to `PASS (0 ERRORS)` whenever `isResurrected` is `true`.
* **Business / User Impact:** Violates NecroCode's core promise and `.kiro/steering/product.md` Principle #3 ("Honest Telemetry: Clearly distinguish live execution from simulated demo fallbacks"). Evaluators testing custom Python code see "100% PASS" even when the output contains `SyntaxError` or no repairs were applied.
* **Recommended Fix:** Separate real execution/validation from preset demo simulation:
  1. Run real Python syntax/AST compilation (`python3 -m py_compile` / `ast.parse`) and isolated `pytest`/`unittest` or Node `--check`/test runner inside an ephemeral sandboxed server API route (or Pyodide/WebWorker in browser RAM if serverless-only).
  2. Display an explicit `SIMULATED_DEMO` vs `LIVE_SANDBOX_VERIFIED` telemetry badge.
* **Dependencies & Priority:** P0 (Blocker for core product credibility).

### [PA-02] Critical — Missing GitHub Repository Ingestion (FR-1 Violation)
* **Severity:** Critical
* **Evidence:**
  * `.kiro/specs/requirements.md:21` ("Evaluators can also paste custom legacy code or an archived GitHub URL") and `src/components/necro/PatientExhumationBar.tsx:43` (button labeled `"Exhume Custom Repository / Code"`).
  * Searching `src/` confirms zero GitHub API clients, zero URL input fields, and zero multi-file tree/archive handling (`src/app/page.tsx` only accepts a single string `customCode`).
* **Business / User Impact:** Users cannot submit an abandoned GitHub Python repository—the primary user journey described in the product brief.
* **Recommended Fix:** Add a GitHub repository URL input + `POST /api/repo/ingest` route using GitHub REST API (or shallow archive fetch) with file-tree filtering for `.py`, `requirements.txt`, `setup.py`, `pyproject.toml`, and `tests/`.
* **Dependencies & Priority:** P0 (Requires URL validation & SSRF protection from Security Audit).

### [PA-03] High — AI Integration Layer (`src/lib/ai.ts`) Is Disconnected & Stubbed
* **Severity:** High
* **Evidence:**
  * `package.json:18,20` installs `@google/generative-ai` (`^0.21.0`) and `ai` (`^3.4.0`), but neither package is imported anywhere in `src/`.
  * `src/lib/ai.ts:11-29`: `executeAgentWorkflow` is never imported by any page, component, or API route. Even when `GEMINI_API_KEY` is present (`src/lib/ai.ts:23-28`), it returns a static string `` `Agent completed task: ${prompt}` `` without calling Gemini or any LLM.
  * `src/lib/necro-engine/resurrector.ts:43-128`: Custom code repairs rely solely on 6 Python regexes and 3 JS regexes, which fail on real-world Python 2 code (see `[PA-04]`).
* **Business / User Impact:** There is no actual "AI" in NecroCode; arbitrary legacy Python repositories cannot be meaningfully diagnosed or repaired beyond trivial single-line regex substitutions.
* **Recommended Fix:** Wire `@google/generative-ai` (with Zod-validated structured JSON diff/plan output per `.kiro/steering/tech.md`) inside a server-side `POST /api/resurrect` route, preserving deterministic AST/regex pre/post-checks and explicit fallback when `GEMINI_API_KEY` is unset.
* **Dependencies & Priority:** P1 (Depends on server API route architecture).

### [PA-04] High — Deterministic Regex Engine Produces Invalid Python & JavaScript Syntax
* **Severity:** High
* **Evidence:**
  * `src/lib/necro-engine/resurrector.ts:117-118`: Converts `module.exports = { dispatchNotification: dispatchNotification };` (used in `PRESET_PATIENTS[1].deadCode` at `src/lib/necro-engine/patients.ts:155-157`) into `export { dispatchNotification: dispatchNotification };`, which is an **ESM `SyntaxError`**.
  * `src/lib/necro-engine/resurrector.ts:104-110`: Replaces `var request = require('request');` with a comment `// Modern native fetch() utilized` but leaves all `request(options, callback)` call sites broken.
  * `src/lib/necro-engine/resurrector.ts:112-115`: `new Buffer(10)` becomes `Buffer.from(10, 'utf-8')` (throws `TypeError` in Node 20), and `new Buffer(str, 'hex')` becomes `Buffer.from(str, 'hex', 'utf-8')` (invalid 3rd arg).
  * `src/lib/necro-engine/resurrector.ts:87-96`: `print "a" # comment` becomes `print("a" # comment)` (comment swallows closing paren -> `SyntaxError`), `print >> sys.stderr, "err"` becomes `print(>> sys.stderr, "err")` (`SyntaxError`), and `from urllib2 import urlopen` is completely missed by `diagnoser.ts:31` and `resurrector.ts:54`.
  * `src/lib/necro-engine/diagnoser.ts:17`: `print "foo"` regex misses `print("foo")` negative check only via `startsWith("print(")`, but `print_value = 1` doesn't match while `print x` with trailing spaces/comments produces broken `repairedSnippet`.
* **Business / User Impact:** Entering custom mode even with Patient #2's own `deadCode` generates broken JavaScript that crashes on execution.
* **Recommended Fix:** Replace naive line regexes with real parser/codemod tooling (`lib2to3`/AST or AI-assisted + AST-verified transforms) and validate output syntax before returning.
* **Dependencies & Priority:** P1.

### [PA-05] High — Custom Mode Has No Language Selector & Misclassifies Code
* **Severity:** High
* **Evidence:**
  * `src/app/page.tsx:36,89-92`: `setCustomLanguage` is only ever called inside `handleToggleCustomMode` to copy `selectedPatient.language`. Neither `PatientExhumationBar.tsx` nor `SideBySideDiff.tsx` renders a Python/JavaScript/TypeScript selector when `isCustomMode` is `true`.
* **Business / User Impact:** If Patient #1 (Python) is selected and a user switches to Custom Mode to paste Node.js code (or vice versa), the diagnoser and resurrector run the wrong language ruleset with no way to change it.
* **Recommended Fix:** Add an explicit language selector (or auto-detection with manual override) in custom mode.
* **Dependencies & Priority:** P1.

### [PA-06] Medium — Orphaned Template Pages (`/dashboard`, `/docs`) & Broken Documented API
* **Severity:** Medium
* **Evidence:**
  * `src/app/page.tsx` contains zero `<Link>` elements to `/dashboard` or `/docs` (even though `Link` is imported at `src/app/page.tsx:4` and unused!).
  * `src/app/dashboard/page.tsx:35-61,88-240` and `src/lib/demo-data.ts` display generic finance/procurement template metrics (`"Active Sessions: 14,820"`, `"Processed Volume: $1,280,450"`, `"Autonomous Procurement Executed"`, `"pgvector cosine similarity search"`) unrelated to NecroCode.
  * `src/app/docs/page.tsx:211` documents `POST /api/agent/execute`, which returned `HTTP 404` during live `next dev` verification (`POST /api/agent/execute 404 in 565ms`).
  * Empty directories exist at `src/app/docs/api-reference`, `src/app/docs/architecture`, and `src/app/docs/sponsors`.
  * `src/app/fumadocs.css` (3,259 lines) is unused anywhere in `src/`.
* **Business / User Impact:** Confuses judges or users who visit `/dashboard` or `/docs` (e.g., via Playwright or URL inspection) and see a completely different hackathon boilerplate app and broken API docs.
* **Recommended Fix:** Either repurpose `/dashboard` (Resurrection History / Lab Telemetry) and `/docs` (NecroCode API & Kiro SDD docs) to reflect NecroCode, or remove stale boilerplate pages and unused `fumadocs.css`, `src/lib/payments/*`, `src/lib/demo-data.ts`.
* **Dependencies & Priority:** P2.

### [PA-07] Medium — Unused Persistence, Auth, and Payment Subsystems
* **Severity:** Medium
* **Evidence:**
  * `src/lib/db.ts`, `src/lib/auth/*`, and `src/lib/payments/*` are only imported by unit tests in `src/lib/__tests__/`, never by `src/app/` or `src/components/`.
  * Autopsy reports and resurrection sessions exist purely in React component state (`src/app/page.tsx:31-46`) and vanish on page refresh.
* **Business / User Impact:** Users lose autopsy reports on reload; there is no shareable autopsy permalink or history.
* **Recommended Fix:** Persist autopsy reports in Postgres via `src/lib/db.ts` (with in-memory Map fallback when `DATABASE_URL` is unset) and expose `/api/autopsies/[id]`.
* **Dependencies & Priority:** P2.

---

## 3. Product & UI/UX Audit

### [UX-01] High — Race Condition in `handleResurrect` `setTimeout` on Patient Switch
* **Severity:** High
* **Evidence:** `src/app/page.tsx:101-120`: Clicking "Resurrect & Defibrillate" starts an untracked `setTimeout(..., 900)` that does not cancel if the user clicks another patient (`handleSelectPatient`) or toggles custom mode (`handleToggleCustomMode`) during the 900ms window.
* **Business / User Impact:** Switching patients mid-resurrection causes the previous patient's resurrected code and `ALIVE / 78 BPM` state to overwrite the newly selected patient!
* **Recommended Fix:** Store timeout ref and clear on unmount/patient change, or tie state updates to a request ID / `AbortController`.
* **Dependencies & Priority:** P1.

### [UX-02] High — Broken Light/Dark Theme Toggle on Main Lab Page
* **Severity:** High
* **Evidence:**
  * `src/app/page.tsx:151` renders `<ThemeToggle />`, and `src/app/layout.tsx:17-37` manages `.dark` on `<html>`.
  * However, `src/app/page.tsx:123,125,159,226,262` and all 4 components in `src/components/necro/*` hardcode dark hex backgrounds (`bg-[#05070d]`, `bg-[#070b14]`, `bg-[#090b10]`) and fixed `text-slate-*` colors instead of CSS theme tokens.
* **Business / User Impact:** Clicking the Theme Toggle in the header flips the icon between Sun/Moon while the entire NecroCode page stays dark.
* **Recommended Fix:** Either enforce NecroCode as a dark-only Gothic laboratory (remove misleading `<ThemeToggle />` from `/`) or bind surfaces to CSS variables. Given the Gothic CRT morgue aesthetic, removing the non-functional toggle on `/` (or styling light mode properly) avoids broken controls.
* **Dependencies & Priority:** P2.

### [UX-03] Medium — Misleading / Fabricated UI Badges & Copy
* **Severity:** Medium
* **Evidence:**
  * `src/app/page.tsx:274-277`: Footer hardcodes `"12/12 Automated Tests Passing"`.
  * `src/components/necro/SideBySideDiff.tsx:172,179`: Displays `"Resurrected Artifact (Kiro SDD Validated)"` and `"VIVUS • 100% PASS"` unconditionally when `isResurrected` is `true`, even in custom mode where nothing was validated.
  * `src/app/page.tsx:161-171` & `src/app/page.tsx:147-150`: Prominent hackathon prize-money badges (`"$5,000"`, `"UTM Student Track"`) compete visually with the actual laboratory controls above the fold.
  * `src/components/necro/AutopsyReportCard.tsx:154-200`: When `fatalErrors.length === 0` (e.g., user pastes clean Python 3 code in custom mode), the Runtime Test Verification Matrix table body is completely empty (`0` rows) while the header claims `0/3 PASSED` or `3/3 PASSED (100%)`.
* **Business / User Impact:** Erodes trust with technical evaluators and confuses real users when clean code shows a 30% toxicity floor (`diagnoser.ts:79` uses `Math.max(30, ...)` even with 0 errors!) and an empty test table claiming `3/3 PASSED`.
* **Recommended Fix:** Compute toxicity `0%` when `fatalErrors.length === 0`; show actual test suite results (or "No tests detected / Syntax check only"); move hackathon metadata out of the primary operating-theatre hero into a subtle footer/about modal.
* **Dependencies & Priority:** P1.

### [UX-04] Medium — Claimed Exports (ZIP & Unified Git Patch) Missing
* **Severity:** Medium
* **Evidence:**
  * `.kiro/specs/requirements.md:44` and `SUBMISSION.md:51` specify **"Download Resurrected ZIP"** and **"Copy Unified Git Patch"**.
  * `src/components/necro/SideBySideDiff.tsx:31-48`: Only copies raw `resurrectedCode` (or falls back to copying `deadCode` when not resurrected, with no label indicating which was copied!) and downloads a single flat `resurrected_artifact.py`/`.js` file.
* **Business / User Impact:** Users cannot inspect a unified git diff or download a complete modernized repository bundle (`requirements.txt`/`package.json` + code + tests).
* **Recommended Fix:** Generate an actual unified diff (`--- a/...`, `+++ b/...`) view/copy option and package multi-file output as a `.zip` archive.
* **Dependencies & Priority:** P2.

### [UX-05] Medium — Accessibility & Directive Defects in Necro Components
* **Severity:** Medium
* **Evidence:**
  * `src/components/necro/ECGMonitor.tsx:1`, `PatientExhumationBar.tsx:1`, `AutopsyReportCard.tsx:1`, `SideBySideDiff.tsx:1` all start with `"useclient";` (typo without space) instead of `"use client";`. Currently masked only because `src/app/page.tsx` has `"use client";`.
  * `src/components/necro/PatientExhumationBar.tsx:52-60`: Patient cards are `<div onClick={...}>` without `role="button"`, `tabIndex={0}`, or `onKeyDown` — impossible to select via keyboard navigation.
  * `src/components/necro/ECGMonitor.tsx:220-225`: `<canvas>` lacks `role="img"` and `aria-label` describing vital status and BPM.
  * `src/components/necro/ECGMonitor.tsx:156-193` & `AutopsyReportCard.tsx:188`: Continuous `animate-ping`, `animate-bounce`, and `animate-pulse` on status badges/icons even when static/settled; no `prefers-reduced-motion` handling on canvas animation loop.
  * `src/components/ui/Toast.tsx`: `ToastProvider` wraps the app in `layout.tsx`, but `/` never triggers user feedback toasts on copy/download/resurrect errors.
  * `src/components/necro/SideBySideDiff.tsx:138,196`: Code `<pre>` blocks lack line numbers, making `Line N:` references in `AutopsyReportCard.tsx:95` hard to correlate visually, and lack `max-h` parity with custom `<textarea>` (`rows={22}` vs `max-h-[500px]`).
* **Business / User Impact:** Fails keyboard accessibility, risks Next.js Server Component build breakage if components are reused, and creates visual noise/motion strain.
* **Recommended Fix:** Fix `"use client";` directives, replace clickable `<div>` with `<button>` or proper ARIA/keyboard handlers, respect `prefers-reduced-motion`, add line numbers and synchronized diff highlighting, and add `aria-label` to canvas/controls.
* **Dependencies & Priority:** P1–P2.

---

## 4. Kiro SDD Artifact Gap Analysis

* **Existing `.kiro/` artifacts:**
  * `.kiro/steering/product.md` (10 lines)
  * `.kiro/steering/tech.md` (14 lines)
  * `.kiro/hooks/validate.json` (14 lines — `PostFileSave` running `npm run test`)
  * `.kiro/specs/requirements.md` (51 lines), `.kiro/specs/design.md` (96 lines), `.kiro/specs/tasks.md` (27 lines) — mirrored verbatim in `specs/`.
* **Observed discrepancies & gaps (without manufacturing prior usage):**
  1. `.kiro/specs/tasks.md` has all 13 tasks (`Task 1.1`–`Task 3.4`) still unchecked `- [ ]`.
  2. `.kiro/specs/design.md:29` references `/.kiro/specs/resurrection.md`, which does not exist.
  3. `.kiro/steering/tech.md:7,13` mandates **"Zod schemas for all API payloads and LLM outputs"** and **"Never use `any`"**, yet `zod` is not even in `package.json`, and `any` appears in `src/lib/ai.ts:11`, `src/lib/db.ts:15`, `src/lib/payments/paypal.ts:62`, `src/lib/payments/types.ts:5,14`, and `src/app/dashboard/page.tsx:205`.
  4. `.kiro/steering/tech.md:11` mandates **"Every new API route or data transformer must have a corresponding Vitest test in `src/lib/__tests__/`"**, yet `/api/health` (`src/app/api/health/route.ts`) has no test.
  5. `.kiro/steering/product.md:3` ("Honest Telemetry") and `requirements.md` FR-1/FR-3/FR-5 are violated by the current simulated implementation.

# NecroCode — Feature Inventory & Verification Matrix

**Audit Date:** 2026-11-26  
**Verification Basis:** Full source inspection (`src/`, `.kiro/`, `tests/`, `scripts/`), Vitest run, TypeScript check, Next.js build, and live `next dev` HTTP checks.

---

## 1. Feature Status Summary

| # | Feature | Claimed Scope | Actual Status | Works? | Evidence |
|---|---|---|---|---|---|
| 1 | 1-Click Pre-Seeded Patients | 2 historical dead repos (Python 2.7 & Node 6) | **Simulated / Preset Lookup** | Partial | `src/lib/necro-engine/patients.ts`, `resurrector.ts:18-41` |
| 2 | GitHub Repository Ingestion | Paste archived GitHub URL & ingest repo | **Missing** | No | No URL input or GitHub fetcher in `src/` |
| 3 | Custom Code Autopsy & Repair | Paste custom legacy Python/Node code | **Broken / Flawed** | Partial | `src/app/page.tsx:34-99`, `resurrector.ts:44-128` |
| 4 | Legacy Decay Diagnoser | AST decay scanner & toxicity score | **Regex-only (Toy)** | Partial | `src/lib/necro-engine/diagnoser.ts:1-135` |
| 5 | AI / LLM Code Resurrection | Gemini/AI repair with hallucination guards | **Stubbed / Unused** | No | `src/lib/ai.ts:11-29` (never called, no SDK call) |
| 6 | Automated Test Verification | Run tests proving resurrected code works | **Fake / Hardcoded** | No | `verifier.ts:26-56`, `AutopsyReportCard.tsx:154-200` |
| 7 | Safe Sandbox Execution | Execute Python/Node tests safely | **Missing** | No | No container, subprocess, Pyodide, or VM runner |
| 8 | Lead II ECG Monitor | Animated CRT heartbeat (`0 -> 45 -> 78` BPM) | **Working (UI Visual)** | Yes | `src/components/necro/ECGMonitor.tsx:1-232` |
| 9 | Side-by-Side Diff & Export | Diff viewer, Download ZIP, Copy Git Patch | **Partial (No Diff / No ZIP / No Patch)** | Partial | `src/components/necro/SideBySideDiff.tsx:31-48,113-209` |
| 10 | Theme Toggle (Dark/Light) | Light/dark theme switching | **Broken on `/`** | No | `src/app/page.tsx:123,151` (hardcoded dark hex) |
| 11 | Health Check API | `GET /api/health` telemetry JSON | **Working** | Yes | `src/app/api/health/route.ts:1-16` (200 OK verified) |
| 12 | Agent Execute API | `POST /api/agent/execute` (in `/docs`) | **Missing (404)** | No | `src/app/docs/page.tsx:211` (live POST -> `404`) |
| 13 | Database Persistence | Neon Serverless Postgres (`pgvector`) | **Unused Stub** | No | `src/lib/db.ts:1-19` (only called in `db.test.ts`) |
| 14 | Auth & 1-Click Guest Session | Guest judge session abstraction | **Unused Stub** | No | `src/lib/auth/*` (only called in `payments_auth.test.ts`) |
| 15 | Payments Gateway | Mock & PayPal REST adapter | **Unused Template Code** | No | `src/lib/payments/*` (irrelevant to NecroCode) |
| 16 | Command Center & Docs Pages | `/dashboard` and `/docs` | **Orphaned Boilerplate** | Partial | `src/app/dashboard/page.tsx`, `src/app/docs/page.tsx` |
| 17 | Kiro SDD Integration | `.kiro/specs`, `steering`, `hooks` | **Partially Populated / Out of Sync** | Partial | `.kiro/` (all tasks `[ ]`, missing `resurrection.md`) |

---

## 2. Detailed Feature Audit

### F-01: Pre-Seeded Patient Presets (`PRESET_PATIENTS`)
* **What it does:** Provides two 1-click preset code snippets: `patient_py2_archiver` (Python 2.7 URL archiver, 2014) and `patient_node_webhook` (Node.js 6 webhook dispatcher, 2016).
* **Whether it works:** UI selection and display work. Both `expectedModernCode` samples are syntactically valid (verified with Python 3.9.6 `ast.parse` and Node 20.19.4 `--input-type=module`), though they are static strings rather than dynamically generated outputs.
* **Dependencies:** `src/lib/necro-engine/patients.ts`, `PatientExhumationBar.tsx`.
* **Failure cases:** If a user switches to Custom Mode using Patient #2's `deadCode`, `resurrectCode` bypasses the preset branch (`patientId` is `undefined`) and generates broken ESM syntax (`export { dispatchNotification: dispatchNotification };`).
* **Missing functionality:** Multi-file repository structure (`requirements.txt`, `package.json`, test files).
* **UX / Security:** `PatientExhumationBar.tsx:52` cards are non-keyboard-accessible `<div>` elements; `"useclient";` typo at line 1.

### F-02: GitHub Repository Ingestion
* **What it does:** Claimed in `requirements.md:21` and `SUBMISSION.md:37` ("inject any custom legacy code or dead GitHub repository").
* **Whether it works:** **Does not exist.**
* **Missing functionality:** GitHub URL input, URL validation, GitHub REST/tarball client, rate-limit handling, multi-file dependency parsing (`requirements.txt`, `setup.py`, `pyproject.toml`), large-repo truncation.
* **Security concerns (once built):** SSRF if arbitrary URLs are fetched server-side; path traversal if extracting tarballs/ZIPs; prompt injection via malicious README/comments in ingested repos.

### F-03: Legacy Code Diagnosis (`diagnoser.ts`)
* **Severity:** High
* **What it does:** Splits single-file `code` by `\n` and checks 5 Python regexes (`PY2_PRINT_STATEMENT`, `DEPRECATED_URLLIB2`, `COMMA_EXCEPT_SYNTAX`, `OBSOLETE_XRANGE`, `DEPRECATED_ITERITEMS`) and 3 JS regexes (`DEAD_REQUEST_PACKAGE`, `UNSAFE_BUFFER_ALLOCATION`, `COMMONJS_EXPORT`).
* **Whether it works:** Works only on the exact patterns present in the 2 presets.
* **Failure cases:**
  * Returns minimum `toxicityScore` of `30` (Python) or `35` (JS) even when `fatalErrors.length === 0` (`diagnoser.ts:79,128`), falsely labeling clean Python 3.12 code as 30% toxic!
  * Misses `from urllib2 import ...`, `ConfigParser`, `Queue`, `StringIO`, `raw_input()`, `unicode()`, `basestring`, `long`, integer division `/`, `dict.itervalues()`, `dict.iterkeys()`, `apply()`, `execfile()`, `<>`, octal `0755`, Python 2 `raise E, V`, metaclass syntax, and `requirements.txt` pinned CVEs.
  * Matches inside string literals and comments (e.g., `# import urllib2` triggers `FATAL`).
  * `type === "typescript"` falls into the `else` JS branch with no TS-specific diagnostics.

### F-04: Code Repair / Resurrection (`resurrector.ts` & `src/lib/ai.ts`)
* **Severity:** Critical
* **What it does:** Returns hardcoded `expectedModernCode` for presets, or runs basic regex string replacements for custom snippets.
* **Whether it works:** Works for presets; broken for non-trivial custom code.
* **Failure cases:**
  * `resurrector.ts:117-118`: `module.exports = { k: v };` becomes invalid `export { k: v };`.
  * `resurrector.ts:104-110`: Removes `require('request')` without transforming `request(...)` calls.
  * `resurrector.ts:112-115`: Corrupts `new Buffer(10)` and `new Buffer(x, 'hex')`.
  * `resurrector.ts:90-94`: Corrupts `print "hi" # comment` and `print >> sys.stderr, "x"`.
  * `src/lib/ai.ts`: Never called; has no real Gemini API call even when `GEMINI_API_KEY` is configured.

### F-05: Automated Test Verification & Sandbox (`verifier.ts`, `AutopsyReportCard.tsx`)
* **Severity:** Critical
* **What it does:** Claims to verify functional parity and execute test suites.
* **Whether it works:** **Completely fake.**
* **Evidence:**
  * `verifier.ts:26-56`: `resurrectedCode` parameter is unused; always returns `passedTests = totalTests`, `passPercentage = 100`, `vitalState = "ALIVE"`, `heartbeatBpm = 78`.
  * `AutopsyReportCard.tsx:154-199`: Ignores `patient.testSuites` and generates synthetic rows from `fatalErrors.length` with hardcoded `PASS (0 ERRORS)` when `isResurrected` is `true`.
* **Missing functionality:** Actual Python syntax verification (`py_compile`/`ast.parse`), dependency install check, isolated test execution (`pytest`/`unittest` inside sandboxed container/microVM/restricted subprocess with CPU/mem/network limits), and real before/after test output logs.

### F-06: Lead II ECG Monitor (`ECGMonitor.tsx`)
* **What it does:** Renders an HTML5 `<canvas>` waveform switching between red flatline (`DEAD`, 0 BPM), amber spasms (`RESURRECTING`, 45 BPM), and green P-QRS-T sinus rhythm (`ALIVE`, 78 BPM).
* **Whether it works:** **Yes**, visual animation renders cleanly.
* **UX / Reliability gaps:** Fixed `width={800} height={112}` canvas attribute without DPI/resize scaling; no `prefers-reduced-motion` pause; no `aria-label`; `"useclient";` typo at line 1.

### F-07: Side-by-Side Diff & Export (`SideBySideDiff.tsx`)
* **What it does:** Displays left ("Deceased") and right ("Resurrected") code panes, a Copy button, and a Download button.
* **Whether it works:** Side-by-side display works, though it is **two separate `<pre>` blocks rather than a line-by-line diff** (no added/removed line highlighting).
* **Missing functionality:** Claimed `"Download Resurrected ZIP"` and `"Copy Unified Git Patch"` (`requirements.md:44`) are absent; no line numbers; no TypeScript `.ts` extension mapping (`SideBySideDiff.tsx:38` outputs `.js` for everything non-Python!).
* **UX problems:** `handleCopy` (`line 32`) silently copies `deadCode` if clicked before resurrection, with no toast notification; `setTimeout` in `page.tsx:106` is not cancelled on patient switch.

### F-08: Orphaned Boilerplate Routes (`/dashboard`, `/docs`) & Unused Libraries
* **What it does:** `/dashboard` renders generic SaaS/fintech mock metrics (`src/lib/demo-data.ts`); `/docs` renders generic quickstart/API/sponsors docs referencing nonexistent `POST /api/agent/execute`; `src/lib/db.ts`, `src/lib/auth/*`, `src/lib/payments/*` sit unused.
* **Whether it works:** `/dashboard` and `/docs` return HTTP `200`, `GET /api/health` returns HTTP `200`, and `POST /api/agent/execute` returns HTTP `404`.
* **UX / Business Impact:** Leaves unbranded template remnants in the deployable app.

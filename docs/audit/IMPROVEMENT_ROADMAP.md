# NecroCode — Prioritized Improvement Roadmap

**Audit Date:** 2026-11-26  
**Objective:** Bridge the gap between the current hackathon showcase prototype and NecroCode's core promise (*submit an abandoned Python repository -> diagnose problems -> generate real AI-assisted repairs -> safely execute tests -> prove resurrection*) while keeping the existing Next.js 15 + Tailwind Gothic aesthetic intact.

---

## Priority Tiers

* **P0 — Submission & Core-Promise Blockers:** Must be resolved before any submission or live evaluation.
* **P1 — Real Engine, AI, Sandbox & Verification:** Replaces simulated/fake core mechanics with verifiable execution.
* **P2 — UI/UX Polish, Persistence & Cleanup:** Eliminates template leftovers, fixes accessibility/theme/UX defects, and adds requested exports.
* **P3 — Hardening, Monitoring & Multi-Language Depth:** Production reliability, observability, and extended runtime support.

---

## Phase A (P0): Fix Build/Test Gates & Remove Misleading Telemetry

| Order | Task | Addresses | Dependencies | Acceptance Criteria |
|---|---|---|---|---|
| A1 | Fix `src/lib/__tests__/db.test.ts` union narrowing (or `runQuery` return shape) so `npx tsc --noEmit` passes with 0 errors. | TC-02 | None | `npx tsc --noEmit` exits 0. |
| A2 | Configure ESLint (`eslint.config.*` + `eslint-config-next`) so `npm run lint` runs non-interactively without prompting. | TC-03 | None | `npm run lint` exits 0 non-interactively. |
| A3 | Fix `"useclient";` -> `"use client";` in `ECGMonitor.tsx`, `PatientExhumationBar.tsx`, `AutopsyReportCard.tsx`, `SideBySideDiff.tsx`. | UX-05 | None | Valid React client directives on all 4 files. |
| A4 | Install Playwright Chromium and rewrite `tests/e2e/smoke.spec.ts` to test real NecroCode flows with zero console errors. | TC-01 | None | `npx playwright test` passes 100% against NecroCode. |
| A5 | Ensure `npm run test:security` runs real Semgrep (`semgrep --config .semgrep.yml --error src/`) or clearly documents/expands static rules (`AIza`, `ghp_`, `Function`, `execSync`, unhandled fetch). | SEC-01 | Semgrep CLI | Security gate catches real secret & RCE patterns. |
| A6 | Enforce Honest Telemetry (`.kiro/steering/product.md`): remove fake `PASS (0 ERRORS)` / `12/12` / `Kiro SDD Validated` badges when running unverified or simulated flows; fix `toxicityScore` floor (`0%` when 0 errors). | PA-01, UX-03 | None | UI clearly distinguishes `SIMULATED_DEMO` vs `LIVE_SANDBOX_VERIFIED`. |

---

## Phase B (P1): Real GitHub Ingestion, AI Repair & Sandboxed Test Execution

| Order | Task | Addresses | Dependencies | Acceptance Criteria |
|---|---|---|---|---|
| B1 | Install `zod` and define strict schemas (`src/lib/necro-engine/schemas.ts`) for repo ingestion, diagnosis, repair diffs, and test execution results. | SEC-03 | None | All new API payloads & LLM outputs parsed via Zod. |
| B2 | Build `POST /api/repo/ingest` for GitHub URL submission (`https://github.com/owner/repo`): SSRF-safe URL parser, file-tree filter (`.py`, `requirements.txt`, `pyproject.toml`, `tests/`), size/file caps, and multi-file patient model. | PA-02, SEC-04 | B1 | User can paste a public archived Python GitHub URL and view its files/dependencies in the lab. |
| B3 | Upgrade Diagnoser (`diagnoser.ts` + server Python AST analyzer): detect real Python 2 syntax/AST issues (`ast.parse` failure lines, `urllib2`, `ConfigParser`, `raw_input`, `xrange`, `.iteritems`, `except E, e`, `requirements.txt` pinned/deprecated packages). | F-03 | B1 | Clean Python 3 code scores `0%` toxicity; real Python 2 files report accurate AST errors without false positives in comments/strings. |
| B4 | Implement real AI Repair service (`src/lib/ai.ts` + `POST /api/resurrect`): wire `@google/generative-ai` (Gemini) with structured Zod JSON output (file patches + explanation + dependency upgrades), keeping deterministic AST/codemod passes and explicit `DEMO_MODE` fallback when `GEMINI_API_KEY` is missing. | PA-03, PA-04 | B1, B3 | Custom Python 2 code and ingested repos receive valid, non-hallucinated repairs; preset fallback works offline. |
| B5 | Implement **Safe Sandboxed Verification** (`POST /api/verify`): run `python3 -m py_compile` / AST check and isolated `pytest`/`unittest` inside a resource-limited, network-disabled ephemeral container (Docker `--network=none --read-only --cap-drop=ALL`) or isolated Pyodide Web Worker, returning real pass/fail counts, stdout/stderr, and exit codes. | PA-01, SEC-02 | B1, B4 | `verifier.ts` actually tests `resurrectedCode`; broken repairs report `FAIL` and keep ECG flatlined/amber instead of faking `78 BPM`. |
| B6 | Fix custom mode language selector (`python` / `javascript` / `typescript`) and `handleResurrect` `setTimeout`/AbortController race condition on patient switch. | PA-05, UX-01 | None | Switching patients mid-run never leaks stale resurrection results; language can be explicitly selected. |

---

## Phase C (P2): UI/UX Polish, Exports, Persistence & Template Cleanup

| Order | Task | Addresses | Dependencies | Acceptance Criteria |
|---|---|---|---|---|
| C1 | Replace side-by-side static panes with a true line-by-line diff view + line numbers, unified Git patch copy, and multi-file resurrected `.zip` export (`jszip` or lightweight ZIP builder). | UX-04, UX-05 | B2 | Both "Copy Unified Git Patch" and "Download Resurrected ZIP" work for single-file and multi-file repos. |
| C2 | Fix Theme Toggle or lock `/` to Gothic dark mode consistently; add keyboard accessibility (`<button>` / `tabIndex` / `onKeyDown`) to `PatientExhumationBar`, `aria-label` to `ECGMonitor` canvas, `prefers-reduced-motion` support, and toast feedback. | UX-02, UX-05 | None | Full keyboard navigation, WCAG contrast/focus states, zero dead theme controls. |
| C3 | Clean up or repurpose `/dashboard` (NecroCode Autopsy Ledger backed by `src/lib/db.ts` + in-memory fallback) and `/docs` (accurate NecroCode API reference + Kiro SDD docs); remove stale `"Active Sessions: 14,820"` mock data, dead `/api/agent/execute` reference, unused `src/app/fumadocs.css`, and unused `src/lib/payments/*`. | PA-06, PA-07 | None | All routes reflect NecroCode; zero broken API references; autopsy runs persist across reload when DB is configured. |
| C4 | Synchronize `.kiro/` artifacts: remove broken reference to `resurrection.md` in `design.md`, update `tasks.md` with accurate completed vs pending state, add `.kiro/specs/api-contract.md` or update `design.md` with new endpoints. | Kiro Audit | Phase B | `.kiro/specs/`, `.kiro/steering/`, and implementation match 1:1. |

---

## Phase D (P3): Security Hardening, Observability & Extended Coverage

| Order | Task | Addresses | Dependencies | Acceptance Criteria |
|---|---|---|---|---|
| D1 | Add `next.config.ts` with CSP, `X-Frame-Options`, `X-Content-Type-Options`, and `Referrer-Policy`. | SEC-07 | None | Security headers verified on HTTP responses. |
| D2 | Add per-IP/session rate limiting on `/api/repo/ingest`, `/api/resurrect`, and `/api/verify`, and scope guest auth role to `"guest"`. | SEC-06 | B2, B4, B5 | Abuse/burst protection on LLM & sandbox routes. |
| D3 | Add structured server logging, error-boundary UI with retry actions, and Vitest coverage for all API routes + negative engine cases. | TC-04, TC-05 | Phase B | >= 90% coverage of `necro-engine` & API routes; zero unhandled rejections. |

---

## Minimum Pre-Submission Checklist (Must-Fix Before Demo/Submission)

1. **P0 Gates Green:** `npx tsc --noEmit`, `npm run lint`, `npm test`, `npx playwright test`, `npm run build` all pass cleanly.
2. **End-to-End Real Flow:** Submitting a real dead Python snippet or archived GitHub repo performs real AST diagnosis, real Gemini (or clearly badged fallback) repair, and real sandboxed syntax/test verification (including failing cleanly when repairs are incomplete).
3. **Zero Stale Boilerplate:** `/dashboard`, `/docs`, `README.md`, and `SUBMISSION.md` match the actual codebase and verified test counts—no `404` endpoints or unverified claims.

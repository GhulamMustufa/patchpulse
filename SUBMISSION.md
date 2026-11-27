# PatchPulse — Hackathon Submission Overview

> **Project:** PatchPulse — AI Code Repair & Offline Verification Platform  
> **Repository:** https://github.com/GhulamMustufa/patchpulse  
> **Author:** Ghulam Mustafa (`GhulamMustufa`)  
> **Verified Status:** 40/40 automated tests passing across 8 suites • 0 security audit findings

---

## Project Title
**PatchPulse — Fix Broken Legacy Code & Prove It With Real Tests**

## Short Pitch (Under 120 Characters)
*Repair outdated Python, JavaScript, and TypeScript code and verify every fix inside an offline test sandbox.*

---

## The Problem
Older codebases stop working not because the core logic was bad, but because languages and libraries evolved:
- **Python 2 to 3:** Old `print` statements, `urllib2` imports, `xrange()`, and `.iteritems()` crash immediately on Python 3.12.
- **Legacy Node.js & TypeScript:** Outdated `new Buffer()` constructors create security bugs, removed packages like `request` break builds, and loose types fail modern TypeScript checks.

Standard AI chat tools can rewrite snippets, but they often guess APIs and never prove whether the updated code compiles or passes tests.

---

## What PatchPulse Does

1. **Zero-Friction Landing & 1-Click Workspace (`/` and `/lab`)**
   - Visitors see a live interactive **Python / JavaScript / TypeScript** preview right on the home page (`/`) and launch the workspace (`/lab`) with one click—no login or API key needed.
2. **Flexible Code Input**
   - Try built-in legacy sample projects, paste your own snippet, or load any public GitHub repository or `.zip` archive (up to 15 MB / 40 files).
3. **Real Diagnosis Before Repair**
   - Scans Python syntax, Node/CJS/ESM rules, real `tsc --noEmit` compiler diagnostics, and dependency manifests.
   - Pairs Google Gemini AI with deterministic offline repair rules so fixes work even without an internet connection or AI key.
4. **Side-by-Side Diff + User Approval**
   - Shows **Original Code** next to **Fixed Code** (or unified diff), lists every change clearly, and requires explicit **Approve Fix** confirmation before execution.
5. **Isolated Offline Test Sandbox (`sandbox-worker/`)**
   - Runs `pytest` / `unittest`, `node --test`, and `tsc --noEmit` in a separate offline worker (`docker` container or macOS `seatbelt` fallback) with zero host network and zero host secrets.
   - **Zero fake passes:** Reports exact test counts or clearly flags `No Tests Found` / `Tests Blocked` if external packages cannot be verified offline.

---

## Tech Stack
- **Web App:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS
- **AI & Static Engine:** Google Gemini (`@google/generative-ai`) + custom AST/syntax/compiler analyzers (`src/lib/necro-engine/`)
- **Database (Optional):** Neon Serverless Postgres (`DATABASE_URL`) with clean in-memory fallback
- **Sandbox Workers:** Python 3.12 (`sandbox-worker/runner.py`), Node.js 20.19.4 LTS + TypeScript 5.9.3 (`sandbox-worker/node/runner.mjs`)
- **Testing & Security:** Vitest (`40/40` passing), Playwright smoke suite (`tests/e2e/smoke.spec.ts`), custom static security auditor (`scripts/security_audit.py`)

---

## Verification Commands
```bash
npx tsc --noEmit
npm run lint
npx vitest run --no-file-parallelism
npm run test:security
npm run build
```

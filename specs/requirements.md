# 📋 Requirements Specification: NecroCode

> **Project Name:** NecroCode — The AI Software Autopsy & Resurrection Engine  
> **Target Hackathon:** AWS Kiroween (Devpost)  
> **Official Category:** Resurrection (Eligible for Best Student Project & Best Demo)  
> **Status:** APPROVED & LOCKED

---

## 1. Executive Summary
Millions of valuable open-source repositories from 2012–2020 are dead on GitHub—abandoned due to deprecated dependencies, obsolete syntax, and security vulnerabilities. **NecroCode** performs a digital autopsy on dead legacy codebases, diagnoses the exact "Cause of Death", and autonomously resurrects them into modern, runnable, test-passing software using Kiro Spec-Driven Development.

---

## 2. Core Functional Requirements (Must-Have MVP)

### FR-1: 1-Click Patient Exhumation (Evaluator Demo Rule)
* The UI must provide **two real, famous dead legacy repositories pre-seeded as 1-click presets**:
  * **Patient #1 (Python 2.7 URL Archiver — Died 2014):** Broken by `print "..."` statements, deprecated `urllib2`, `dict.iteritems()`, and `xrange()`. Fails on Python 3 with `SyntaxError`.
  * **Patient #2 (Node.js 6 Webhook Dispatcher — Died 2016):** Broken by deprecated `request` library, old CommonJS `require()`, and callback nesting. Fails on modern Node 20+.
* Evaluators can also paste custom legacy code or an archived GitHub URL.

### FR-2: Digital Autopsy & Pathology Diagnosis
* Computes and displays:
  * **Status:** Flatline (DEAD)
  * **Decay Severity Score:** (0–100%)
  * **Estimated Time of Death:** (e.g. November 2015)
  * **Official Cause of Death:** Exact deprecated dependencies and syntax errors identified with line numbers.

### FR-3: Deterministic AST & Agentic Resurrection
* Autonomously transforms legacy code into modern, clean standards:
  * Python 2 $\rightarrow$ Modern Python 3.12 (Parenthesized prints, modern `urllib.request`, `dict.items()`, clean type hints).
  * Node CommonJS $\rightarrow$ Modern Node 20+ ESM (Native `fetch()`, `import/export`, `async/await`, modern `package.json`).
* Generates a side-by-side interactive Code Diff Viewer (Red = Deceased, Green = Resurrected).

### FR-4: Real-Time Animated ECG Monitor (Vital Signs)
* Features an animated visual Electrocardiogram (ECG) monitor:
  * **Initial State:** Red flatline ($\heartsuit$ 0 BPM — Deceased).
  * **During Exorcism:** Amber defibrillation wave ($\heartsuit$ 45 BPM — Reviving).
  * **Post-Resurrection:** Pulsing emerald green wave ($\heartsuit$ 78 BPM — Resurrected & Healthy).

### FR-5: Automated Test Verification & Downloadable Patch
* Executes test assertions against the resurrected code to prove functional equivalence.
* Provides a 1-click **"Download Resurrected ZIP"** and **"Copy Unified Git Patch"**.

---

## 3. Non-Functional & Security Constraints
* **Safe Sandbox Rule:** Code transformation and verification must run deterministically in browser RAM / sandboxed API routes. No arbitrary untrusted shell execution.
* **Costume Aesthetic:** Victorian Gothic medical morgue theme (Obsidian black `#0B0C10`, Toxic emerald `#00FFA3`, Blood red `#FF4C4C`, Vintage parchment `#E0E2EC`).
* **Kiro Integration:** All specs and hooks must be mirrored into `/.kiro/specs/` and `/.kiro/hooks/` to prove deep Kiro IDE usage.

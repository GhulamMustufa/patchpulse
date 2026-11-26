# 📋 Requirements Specification: NecroCode

> **Project Name:** NecroCode — AI Software Autopsy & Resurrection Engine  
> **Status:** PHASE 2 IMPLEMENTED (Sandbox Execution Scheduled for Phase 3)

---

## 1. Executive Summary
Abandoned Python repositories often fail on modern runtimes due to Python 2 syntax, removed standard library modules, outdated or conflicting dependencies, and missing configuration. **NecroCode** ingests public Python repositories, diagnoses root compatibility issues, synthesizes syntax-validated AST and Gemini AI repair patches, and prepares non-executing verification reports with honest status tracking.

---

## 2. Core Functional Requirements

### FR-1: Repository & Code Ingestion
* Support **pre-seeded historical patients** (`Archivus Mortis` Python 2.7, `Webhook Specter` Node.js 6) for instant 1-click evaluation.
* Support **custom code paste** with explicit language selection (`python`, `javascript`, `typescript`).
* Support **public GitHub repository ingestion** (`POST /api/repo/ingest`) with strict `https://github.com/<owner>/<repo>` validation, plus **controlled `.zip` archive uploads** with size (`5 MB`), file count (`35`), per-file size (`100 KB`), symlink, and path-traversal protections.

### FR-2: Real Python Repository Diagnosis
* `POST /api/diagnose` inspects actual repository files and manifests (`requirements.txt`, `pyproject.toml`, `setup.py`, `.python-version`, `.py`, test files).
* Reports Python version compatibility, `ast.parse` syntax errors, removed stdlib imports, outdated/conflicting dependencies, missing configuration, and discovered tests.
* Computes toxicity transparently (`0%` when clean) and distinguishes `confirmed` static/AST findings from `ai_suggestion` findings.

### FR-3: AI + AST Repair Synthesis
* `POST /api/resurrect` integrates `@google/generative-ai` (`src/lib/ai.ts`) alongside deterministic Python AST/codemod transforms (`src/lib/necro-engine/repair.ts`).
* Falls back gracefully when `GEMINI_API_KEY` is absent, times out, or returns invalid JSON.
* Preserves original files, outputs unified diffs (`Unified Diff` / `Split View`), supports patch approval/reset, and validates every repaired `.py` file via `ast.parse` before marking it `valid`.

### FR-4: Honest Verification Preparation & ECG Telemetry
* `POST /api/verify` performs non-executing Python AST syntax checks, static re-scans, test discovery, timeout budgeting, and structured logging.
* Untrusted `pytest`/`unittest` execution is **explicitly deferred to Phase 3's isolated sandbox**; pending tests are reported as `PENDING_SANDBOX` and ECG shows `SYNTAX_VERIFIED` (`64 BPM`) or `FAILED` (`0 BPM`), never fabricated `ALIVE` / `78 BPM`.

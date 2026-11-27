# 📋 Requirements Specification: PatchPulse

> **Project Name:** PatchPulse — AI Code Repair & Offline Verification Platform  
> **Status:** IMPLEMENTED (Python 3.12, Node.js 20, TypeScript 5.9 + Isolated Sandbox Verification)

---

## 1. Executive Summary
Abandoned Python, JavaScript, and TypeScript repositories often fail on modern runtimes due to outdated syntax, removed standard library modules, unsafe or conflicting dependencies, and missing configuration. **PatchPulse** ingests public repositories, diagnoses real compatibility issues, prepares syntax-validated repair patches, and executes tests safely inside an offline sandbox with honest status reporting.

---

## 2. Core Functional Requirements

### FR-1: Repository & Code Ingestion
* Support **pre-seeded sample projects** (`Archivus Mortis` Python 2.7, `Webhook Specter` Node.js 6) for instant 1-click evaluation at `/lab`.
* Support **custom code paste** with explicit language selection (`python`, `javascript`, `typescript`).
* Support **public GitHub repository ingestion** (`POST /api/repo/ingest`) with strict `https://github.com/<owner>/<repo>` validation, plus **controlled `.zip` archive uploads** with size (`15 MB` ZIP / `5 MB` archive limits), file count (`40`), symlink, and path-traversal protections.

### FR-2: Real Multi-Language Diagnosis
* `POST /api/diagnose` inspects actual repository files and manifests (`requirements.txt`, `pyproject.toml`, `setup.py`, `package.json`, `tsconfig.json`, `.py`, `.js`, `.ts`, test files).
* Reports language/version compatibility, `ast.parse` / `node --check` / `tsc --noEmit` syntax & compiler errors, removed stdlib imports, outdated/conflicting dependencies, missing configuration, and discovered tests.
* Computes risk transparently (`0%` when clean) and distinguishes `confirmed` static/AST findings from `ai_suggestion` findings.

### FR-3: AI + Deterministic Repair Synthesis
* `POST /api/resurrect` integrates `@google/generative-ai` (`src/lib/ai.ts`) alongside deterministic Python/JS/TS transforms (`src/lib/necro-engine/repair.ts`, `node-repair.ts`).
* Falls back gracefully to built-in rules when `GEMINI_API_KEY` is absent, times out, or returns invalid JSON.
* Preserves original files, outputs unified diffs (`Unified Diff` / `Split View`), supports patch approval/reset, and validates syntax before marking patches valid.

### FR-4: Honest Sandbox Execution & Live Health Monitoring
* `POST /api/verify` performs non-executing syntax checks, test discovery, and structured logging; `POST /api/sandbox/execute` executes approved tests inside an isolated Python 3.12 / Node 20 worker (`sandbox-worker/`).
* Pending or missing tests never fake `All Tests Passed` (`78 BPM`)—missing tests report `NO_TESTS_FOUND` (`SYNTAX_VERIFIED`) and blocked runs report `VERIFICATION_BLOCKED`.

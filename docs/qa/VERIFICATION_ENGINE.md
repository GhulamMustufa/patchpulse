# PatchPulse — Python Verification Guide

> **In plain English:** PatchPulse checks Python syntax safely, discovers real tests, runs them inside an offline sandbox, and only marks a project as fixed if tests actually pass.

**Target Runtime:** Python 3.12 (`sandbox-worker/runner.py`)  
**Orchestrator:** `src/lib/necro-engine/sandbox-jobs.ts` + `POST /api/sandbox/execute`

---

## 1. Execution Stages

1. **Pre-Flight Path & Dependency Policy Gate**
   - `isUnsafeArchivePath()` rejects `..`, absolute paths, backslashes, null bytes, and symbolic links (`isSymlink: true`).
   - `evaluateDependencyPolicy()` (`src/lib/necro-engine/dependency-policy.ts`) audits `requirements.txt`, `setup.py`, and `pyproject.toml`:
     - Rejects `-e`, `--editable`, `--index-url`, `--extra-index-url`, `--find-links`, `--trusted-host`, `git+`, `http://`, `https://`, `file://`.
     - Distinguishes `STDLIB_ONLY_READY` from external package requirements (`DEPENDENCY_PREPARATION_FAILED` when offline wheelhouse does not satisfy them).

2. **Syntax Compilation (`py_compile`)**
   - Every `.py` file is compiled via `py_compile.compile(..., doraise=True)` before any test module is imported.
   - Any `SyntaxError` immediately halts execution with `status: "FAILED"` and `syntaxValid: false`.

3. **Test Discovery & Fixed-Command Execution**
   - Discovers `unittest.TestCase` classes (`unittest.TestLoader().discover`) and top-level `def test_*` functions via `ast.parse`.
   - Executes only via fixed internal runner arguments—never executes shell commands from repository config files.
   - If zero tests are discovered, reports `NO_TESTS_FOUND` (`resurrectionState: "SYNTAX_VERIFIED"`, never `"RESURRECTED"`).

4. **Truthful State Machine**

| State | Meaning | ECG Vital / BPM |
|---|---|---|
| `DIAGNOSED` | Static/AST diagnosis complete | `DEAD` (0 BPM) |
| `REPAIR_GENERATED` | Patch synthesized, awaiting review | `RESURRECTING` / `SYNTAX_VERIFIED` |
| `REPAIR_APPROVED` | User reviewed and approved diff | `SYNTAX_VERIFIED` (64 BPM) |
| `SYNTAX_VERIFIED` | Python 3.12 syntax valid; no runtime tests passed (`NO_TESTS_FOUND` or sandbox pending) | `SYNTAX_VERIFIED` (64 BPM) |
| `TESTS_RUNNING` | Isolated worker executing tests | `TESTS_RUNNING` (45 BPM) |
| `RESURRECTED` | Sandbox ran and 100% of discovered tests passed (`totalTests > 0`) | `ALIVE` (78 BPM) |
| `PARTIALLY_RESURRECTED` | Some tests passed and some failed | `PARTIAL` (58 BPM) |
| `FAILED` | Syntax error, all tests failed, or execution timed out | `FAILED` (0 BPM) |
| `VERIFICATION_BLOCKED` | Dependency policy failed or sandbox worker unavailable | `BLOCKED` (0 BPM) |

# PatchPulse — JavaScript Verification Guide

> **In plain English:** PatchPulse checks JavaScript syntax without running top-level code first, detects CommonJS vs ES Modules, and runs built-in `node:test` suites inside an offline sandbox.

**Worker:** `sandbox-worker/node/runner.mjs`  
**Runtime:** Node.js `20.19.4` LTS  
**Status:** Implemented & tested locally (`seatbelt` driver; `docker` supported when image is built).

---

## 1. Supported Inputs
- `.js`, `.mjs`, `.cjs` files, CommonJS (`require` / `module.exports`), ES modules (`import` / `export`), and `package.json` `"type": "module"` projects.

## 2. Verification Steps
1. **Syntax & Static Checks:**
   - Runs `node --check <file>` on each JS file without executing top-level code.
   - Detects missing local relative imports (`./missing`) and CommonJS vs ESM `type: "module"` mismatches.
2. **Test Discovery:**
   - Discovers `*.test.{js,mjs,cjs}`, `*.spec.{js,mjs,cjs}`, `test/**`, `tests/**`, `__tests__/**`.
   - Never runs arbitrary `package.json` `"scripts"`.
3. **Controlled Test Execution:**
   - Executes `node:test` and Node assertion suites via `node --max-old-space-size=128 --test --test-reporter=tap <discoveredFiles>`.
   - Parses exact `totalTests`, `passedTests`, `failedTests`, `skippedTests`, `failures[]`, `durationMs`, and `exitCode`.
   - Returns `NO_TESTS_FOUND` (`SYNTAX_VERIFIED`) if 0 tests exist.
   - Flags Jest/Vitest imports as `VERIFICATION_BLOCKED` rather than faking support.

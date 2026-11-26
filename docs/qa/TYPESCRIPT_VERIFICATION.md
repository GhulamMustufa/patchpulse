# NecroCode — TypeScript Verification Specification

**Worker:** `sandbox-worker/node/runner.mjs` + `src/lib/necro-engine/node-diagnoser.ts`  
**Compiler:** Pinned `typescript@5.9.3`  
**Status:** Implemented & Tested locally (`seatbelt` driver).

---

## 1. Supported Inputs
- `.ts`, `.tsx`, `.mts`, `.cts` source files and `tsconfig.json` projects.

## 2. Verification Steps
1. **Configuration Safety Check:** Validates `tsconfig.json` JSON and rejects `extends` paths containing `..` or absolute paths. User's `tsconfig.json` is never modified.
2. **Type Checking (`tsc --noEmit`):**
   - Runs `tsc --noEmit --pretty false` inside the isolated worker (using safe defaults if `tsconfig.json` is absent).
   - Reports compiler diagnostics with `file`, `line`, `column`, `code` (`TSxxxx`), and `message`.
3. **Controlled Compilation & `node:test` Execution:**
   - When type-checking passes and `node:test` `.ts` test files exist, compiles TypeScript into an ephemeral directory and executes compiled tests via `node --test --test-reporter=tap`.
   - Returns `NO_TESTS_FOUND` (`SYNTAX_VERIFIED`) when no test files exist.
   - Returns `VERIFICATION_BLOCKED` if Jest/Vitest or uncached external packages are required.

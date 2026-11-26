# NecroCode — Security & Safety Audit

**Audit Date:** 2026-11-26  
**Scope:** Application code (`src/`), security tooling (`scripts/security_audit.py`, `.semgrep.yml`), secrets management (`.env.example`, `.gitignore`), dependency versions (`package.json`, `npm ls`), and planned sandbox/ingestion surfaces.

---

## 1. Security Findings Summary

| ID | Severity | Finding | Location | Priority |
|---|---|---|---|---|
| SEC-01 | Critical | `semgrep` CLI missing; `scripts/security_audit.py` gives false security assurance | `.semgrep.yml`, `scripts/security_audit.py` | P0 |
| SEC-02 | Critical | No sandbox isolation exists yet for Python/Node verification (high RCE risk if added naively) | `src/lib/necro-engine/verifier.ts` | P0 |
| SEC-03 | High | Zero runtime input validation (Zod mandated in `.kiro/steering/tech.md` is absent) | `src/`, `package.json` | P1 |
| SEC-04 | High | Missing SSRF & archive-safety controls for promised GitHub URL ingestion | `.kiro/specs/requirements.md:21` | P1 |
| SEC-05 | Medium | `PayPalPaymentGateway` uses `Buffer.from` without HTTP `res.ok` checks or error handling | `src/lib/payments/paypal.ts:17-27,41-101` | P2 |
| SEC-06 | Medium | Always-authenticated `"judge"` session bypasses auth boundary if write/exec APIs are added | `src/lib/auth/guest.ts:3-16`, `src/lib/auth/index.ts:4-8` | P1 |
| SEC-07 | Medium | `dangerouslySetInnerHTML` inline theme script & missing HTTP security headers | `src/app/layout.tsx:20-36` | P2 |
| SEC-08 | Low | `npm audit` / dependency hygiene & extraneous native binaries | `package.json`, `npm ls` | P3 |

---

## 2. Detailed Security Findings

### [SEC-01] Critical — False Sense of Security from Custom Security Script & Missing Semgrep
* **Severity:** Critical
* **Evidence:**
  * Running `which semgrep` exited with `"semgrep not installed"`.
  * `package.json:12`: `"test:security": "python3 scripts/security_audit.py"` does **not** run Semgrep—it runs a 69-line Python regex script.
  * `scripts/security_audit.py:16`: Ignores the entire `scripts/` directory (`IGNORED_DIRS = {..., "scripts"}`) and skips all lines starting with `//` or `#` (`line 35`).
  * `scripts/security_audit.py:13-14`: Only checks `SECRET_REGEX` (requires `api_key|secret_key|private_key|auth_token` followed by 16+ chars) and `\beval(`. It **does not enforce** `.semgrep.yml:16-22` (`unhandled-promise-catch`), nor does it detect `new Function(...)`, `child_process.exec`, `vm.runInNewContext`, `DATABASE_URL` connection strings with embedded passwords, GitHub PATs (`ghp_...`), Google API keys (`AIza...`), or Python `exec`/`os.system`/`subprocess(..., shell=True)`.
  * `SUBMISSION.md:66` and `.kiro/steering/tech.md:8` claim Semgrep static code analysis is active.
* **Business / User Impact:** Security gates pass even when real secrets (`AIza...`, `postgresql://user:pass@...`), unsafe `Function()`/`execSync()` calls, or unhandled fetches exist.
* **Recommended Fix:** Install `semgrep` in CI/dev environment and wire `npm run test:security` to run `semgrep --config .semgrep.yml --error src/` (plus `gitleaks` or expanded rules for `AIza`, `ghp_`, `postgres://`, `child_process`, `Function`, `dangerouslySetInnerHTML`).
* **Dependencies & Priority:** P0.

### [SEC-02] Critical — Absence of Sandboxed Execution Environment (RCE Hazard for Phase 2)
* **Severity:** Critical
* **Evidence:**
  * `.kiro/specs/requirements.md:49` states: *"Safe Sandbox Rule: Code transformation and verification must run deterministically in browser RAM / sandboxed API routes. No arbitrary untrusted shell execution."*
  * Currently `verifier.ts` executes **nothing**. When real Python test execution is implemented in Phase 2, running `python3` or `pytest` directly on the Next.js host via `child_process` would expose the server to **Remote Code Execution (RCE)**, filesystem exfiltration (`.env` / `GEMINI_API_KEY` / `DATABASE_URL`), and outbound network attacks from malicious code inside abandoned/submitted repositories.
* **Business / User Impact:** Executing untrusted repository code or `setup.py` / `conftest.py` without isolation compromises host credentials and user data.
* **Recommended Fix:** Before enabling real test execution, enforce strict sandbox isolation:
  1. Ephemeral container/microVM (Docker `--network=none --read-only --cap-drop=ALL --memory=256m --cpus=0.5 --pids-limit=64 --user=nobody` with tmpfs and strict timeout), **or** client-side WebAssembly Python runtime (Pyodide inside a dedicated Web Worker with zero host filesystem/secrets access).
  2. Never execute `setup.py` or arbitrary `pip install` on the host. Syntax/AST checks and unit tests must run inside the isolated sandbox only.
* **Dependencies & Priority:** P0 (Hard prerequisite for live test execution).

### [SEC-03] High — No Zod Input Validation or Payload Bounds
* **Severity:** High
* **Evidence:**
  * `.kiro/steering/tech.md:7`: *"Validation: Zod schemas for all API payloads and LLM outputs."*
  * `package.json`: `zod` is not installed.
  * `src/app/page.tsx:35,130-136`: `customCode` textarea has no max length or size guard; `diagnoser.ts` and `resurrector.ts` run regexes like `/new\s+Buffer\s*\((.*?)\)/g` (`resurrector.ts:113`) over unbounded input strings.
* **Business / User Impact:** Once API routes (`/api/diagnose`, `/api/resurrect`, `/api/repo/ingest`) are added, lack of schema validation risks oversized payload DoS, malformed LLM JSON crashes, and ReDoS.
* **Recommended Fix:** Install `zod` and enforce strict request/response schemas (code size limits e.g. `<= 100 KB`, allowed `language` enum, validated GitHub URL format, strict LLM JSON schema).
* **Dependencies & Priority:** P1.

### [SEC-04] High — SSRF, Zip-Slip & Prompt-Injection Risks for Planned GitHub Ingestion
* **Severity:** High
* **Evidence:** `.kiro/specs/requirements.md:21` specifies archived GitHub URL ingestion, which is not yet built.
* **Business / User Impact:** Naive server-side `fetch(userUrl)` allows Server-Side Request Forgery (SSRF) against cloud metadata (`169.254.169.254`) or localhost services; naive tarball extraction risks Zip-Slip path traversal (`../`); repository code/comments passed to Gemini risk prompt injection.
* **Recommended Fix:**
  1. Restrict repo URLs strictly to `https://github.com/<owner>/<repo>` parsed via `new URL()` (no redirects to non-GitHub hosts, no arbitrary URLs).
  2. Use GitHub REST API (`api.github.com`) with explicit file count/size caps (`<= 50` files, `<= 1 MB` total) and path normalization checks.
  3. Wrap untrusted source code in explicit delimiters in LLM prompts and validate returned patches via AST/syntax checks and diff review before execution.
* **Dependencies & Priority:** P1.

### [SEC-05] Medium — Unchecked HTTP Responses & Missing Error Boundaries in `src/lib/payments/paypal.ts`
* **Severity:** Medium
* **Evidence:**
  * `src/lib/payments/paypal.ts:17-27,42-62,85-93`: `fetch()` calls to PayPal OAuth and Orders APIs never check `res.ok` or catch network failures (`await res.json()` throws unhandled syntax error on non-JSON 502/401 HTML responses).
  * Note: `src/lib/payments/*` is unused by NecroCode and has no business requirement in `.kiro/specs/requirements.md`.
* **Recommended Fix:** Remove unused payments module (if out of scope for NecroCode) or wrap all `fetch` calls with `if (!res.ok)` checks, timeouts (`AbortSignal.timeout`), and error handling.
* **Dependencies & Priority:** P2.

### [SEC-06] Medium — Guest Auth Returns Privileged `"judge"` Role Unconditionally
* **Severity:** Medium
* **Evidence:** `src/lib/auth/guest.ts:9` sets `role: "judge"`, and `src/lib/auth/index.ts:4-8` returns it unconditionally.
* **Business / User Impact:** Acceptable for read-only client demos, but dangerous if privileged mutations, billing, or rate-limited LLM/sandbox endpoints are added without per-IP rate limiting and least-privilege guest role scoping.
* **Recommended Fix:** Downgrade default guest role to `"guest"`/`"user"`, add per-IP/session rate limiting on LLM & sandbox API routes, and never rely on `getCurrentSession()` for admin authorization.
* **Dependencies & Priority:** P1.

### [SEC-07] Medium — Secrets & Headers Hygiene
* **Severity:** Medium
* **Evidence:**
  * Good: No `.env` or `.env.local` file is committed (`ls -la .env*` shows only `.env.example`), `.gitignore` excludes `.env*.local` and `.env`, and `scripts/security_audit.py` found 0 hardcoded secrets in source.
  * Gap: No `next.config.*` exists, so baseline security headers (`Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `X-Frame-Options`) are not configured; `src/app/layout.tsx:20-36` uses `dangerouslySetInnerHTML` for theme initialization.
* **Recommended Fix:** Add `next.config.ts` with standard security headers (`nosniff`, `SAMEORIGIN`, `strict-origin-when-cross-origin`, CSP).
* **Dependencies & Priority:** P2.

### [SEC-08] Low — Dependency Versions & Extraneous Packages
* **Severity:** Low
* **Evidence:**
  * `npm ls --depth=0` reports `@emnapi/runtime@1.11.3 extraneous` and `@img/sharp-wasm32@0.35.5 extraneous`.
  * `package.json` uses `"next": "^15.0.0"` (resolved `15.5.29`), `"react": "^19.0.0"` (`19.3.1`), `"@google/generative-ai": "^0.21.0"`, `"ai": "^3.4.0"`, `"@neondatabase/serverless": "^0.10.1"`. Notice `ai` v3 and `@google/generative-ai` are unused at runtime.
* **Recommended Fix:** Prune unused dependencies or actively integrate `@google/generative-ai`; run `npm audit` in an online CI environment and clean `package-lock.json` extraneous entries.
* **Dependencies & Priority:** P3.

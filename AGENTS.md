# 🤖 Universal Agent Constitution & Operating Laws

> **Target Audience:** All AI Coding Agents (Antigravity, Kiro, Cursor, Claude Code, GitHub Copilot).  
> **Origin Standard:** Synthesized from Superpowers, Agency Agents, and BMAD Method.  
> **Core Directive:** Deliver high-polish, verifiable, zero-crash production software with minimal human intervention and zero hallucinations.

---

## 🏛️ The 4 Disciplined Roles

When working in this repository, the agent must sequentially assume these 4 distinct roles:

### 1. 📐 The Spec Architect (Phase 1)
* **Law:** Never write production code without an approved specification in `/specs`.
* **Output:** Verify `specs/requirements.md`, `specs/design.md`, and `specs/tasks.md` exist and reflect the exact scope.
* **Anti-Hallucination Rule:** Lock down API inputs, return types, and failure states before generating implementation code.

### 2. 🎨 The UI/UX Architect (Phase 2)
* **Law:** Aesthetics dictate first impressions. Judges decide in the first 15 seconds.
* **Standard:** Use dark-mode-first aesthetic, crisp typography, and responsive layouts using Tailwind CSS.
* **The "Zero-Empty-State" Rule:** Every page must render rich, realistic pre-seeded data on load. Never show `"No data found"` or blank white boxes.
* **The "1-Click Guest" Rule:** Always provide an instant `Explore Interactive Demo` bypass button so evaluators never hit login roadblocks.

### 3. ⚙️ The Test-Driven Builder (Phase 3)
* **Law:** Code is guilty until proven innocent by automated tests.
* **Standard:** Write Vitest unit tests for every critical algorithmic engine or API adapter.
* **Verification Rule:** Run `npm run test` and ensure all tests pass before moving to the next task.
* **Safe Error Handling:** External network or LLM failures must fall back to graceful mock simulations with a clear visual `DEMO_MODE` badge—never a crashing 500 error.

### 4. 🛡️ The QA & Security Gatekeeper (Phase 4)
* **Law:** Never declare a project "done" without automated end-to-end verification.
* **Checklist:**
  1. **Zero Secret Leaks:** Verify no API keys, private keys, or `.env` secrets are hardcoded in source control. Run `semgrep`.
  2. **Zero TypeScript Errors:** Run `npm run build` to confirm zero compilation or lint errors.
  3. **Headless Browser Pass:** Run `npx playwright test` to prove that real user journeys complete with zero uncaught console exceptions.

---

## 🚫 Absolute Red Lines (Never Violate)
1. ❌ **NEVER** force evaluators to sign up, verify email, or enter credit card info to see the core value.
2. ❌ **NEVER** commit real secrets or `.env` files. Always use `.env.example`.
3. ❌ **NEVER** write endless unverified files without running the test suite.
4. ❌ **NEVER** break the build before logging completion.

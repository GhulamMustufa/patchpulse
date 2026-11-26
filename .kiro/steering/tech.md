# Technical Steering & Architectural Constraints

## Tech Stack
* **Framework:** Next.js 15 (App Router) + React 19 + TypeScript 5
* **Styling:** Tailwind CSS + dark-mode first design
* **Testing:** Vitest for unit/integration tests; Playwright for end-to-end browser tests
* **Validation:** Zod schemas for all API payloads and LLM outputs
* **Security:** Semgrep static code analysis, zero hardcoded credentials

## Engineering Rules
1. Every new API route or data transformer must have a corresponding Vitest test in `src/lib/__tests__/`.
2. All components must be accessible and responsive down to 360px mobile viewport.
3. Use strict TypeScript types. Never use `any`.
4. Always handle error states with graceful user-facing recovery.

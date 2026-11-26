# Technical Steering & Architectural Constraints

## Tech Stack
* **Framework:** Next.js 15 (App Router) + React 19 + TypeScript 5.9.3
* **Validation:** Zod schemas (`src/lib/necro-engine/schemas.ts`) for all API payloads, LLM outputs, and worker responses
* **AI Integration:** `@google/generative-ai` (`src/lib/ai.ts`) with deterministic fallback for Python, JavaScript, and TypeScript
* **Workers:** Dedicated Python 3.12 worker (`sandbox-worker/`) and Node.js 20.19.4 + TypeScript 5.9.3 worker (`sandbox-worker/node/`)

## Engineering Rules
1. Never execute `npm install`, `npm ci`, `npx`, `pip install`, lifecycle scripts, or repository-defined shell commands inside the sandbox.
2. Reject unsafe paths, symbolic links, custom registry overrides, and `git+`/URL/`file:` dependencies before execution.
3. Fail closed (`VERIFICATION_BLOCKED`) whenever no isolation driver or worker is available.
4. Maintain Vitest coverage for every runtime, dependency policy, and security isolation vector in `src/lib/__tests__/`.

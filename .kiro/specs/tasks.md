# 📋 Ordered Implementation Tasks: NecroCode

> **Execution Protocol:** Follow dependency order. Never start a task until previous acceptance criteria pass.

---

### Phase 1: Environment & Pre-Seeded Foundations
- [ ] **Task 1.1:** Initialize directory, environment variables (`.env.example`), and branding constants.
- [ ] **Task 1.2:** Seed realistic mock data in `src/lib/demo-data.ts` (zero empty states).
- [ ] **Task 1.3:** Build `DemoBypassButton.tsx` and verify 1-click guest authentication.

---

### Phase 2: Core Engine & Type Safety (Anti-Hallucination)
- [ ] **Task 2.1:** Define TypeScript interfaces and runtime Zod schemas for all inputs/outputs.
- [ ] **Task 2.2:** Implement the core processing pipeline / agent tool dispatcher.
- [ ] **Task 2.3:** Write automated Vitest unit tests covering success, edge-case, and fallback paths.
- [ ] **Task 2.4:** Run `npm run test` and verify 100% green pass rate.

---

### Phase 3: Interactive UI & Tactile Experience
- [ ] **Task 3.1:** Assemble the main responsive layout using Tailwind CSS and UI primitives.
- [ ] **Task 3.2:** Wire the interactive input console with 2 built-in 1-click sample presets.
- [ ] **Task 3.3:** Build the live visual execution canvas with reactive loading states and status badges.
- [ ] **Task 3.4:** Add honest telemetry / proof disclosure panel.

---

### Phase 4: Verification, Security & Production Readiness
- [ ] **Task 4.1:** Run `npm run test:security` (Semgrep) to audit for secret leaks and unsafe calls.
- [ ] **Task 4.2:** Run `npm run test:e2e` (Playwright) to verify headless browser user journeys.
- [ ] **Task 4.3:** Build production bundle (`npm run build`) and verify zero TypeScript/lint errors.
- [ ] **Task 4.4:** Draft Devpost / submission copy in `SUBMISSION.md` and prepare the 2-minute video script.

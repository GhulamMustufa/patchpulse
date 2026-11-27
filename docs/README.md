# PatchPulse Documentation Hub

Welcome to the PatchPulse docs. Everything here is organized cleanly from easy overviews to deeper security and testing details.

---

## Start Here

- **[Main README](../README.md)** — Quick setup, supported languages, and 3-step workflow.
- **[Submission Overview](../SUBMISSION.md)** — Why PatchPulse exists, how it works, and demo notes.
- **[Live In-App Guide](../src/app/docs/page.tsx)** — Open `/docs` in the running app for the interactive quick guide and API list.

---

## How PatchPulse Verifies Code

| Doc | What It Explains |
|---|---|
| [Python Verification](./qa/VERIFICATION_ENGINE.md) | How Python syntax checks, test discovery, and honest result states work |
| [JavaScript Verification](./qa/JAVASCRIPT_VERIFICATION.md) | How Node 20 checks, CommonJS/ESM detection, and `node:test` execution work |
| [TypeScript Verification](./qa/TYPESCRIPT_VERIFICATION.md) | How `tsc --noEmit` compiler checks and compiled test runs work |

---

## Sandbox & Security Safety

Untrusted code **never** runs directly inside the Next.js server. Every test run goes through a locked-down sandbox worker (`sandbox-worker/`):

| Doc | What It Explains |
|---|---|
| [Python Sandbox Architecture](./security/SANDBOX_ARCHITECTURE.md) | Isolation layers (Docker, macOS Seatbelt fallback, and fail-closed blocking) |
| [Node & TypeScript Sandbox](./security/NODE_SANDBOX_ARCHITECTURE.md) | How Node.js 20 and TypeScript 5.9 run offline with strict memory/file caps |
| [Node Dependency Policy](./security/NODE_DEPENDENCY_POLICY.md) | Why npm install scripts (`postinstall`) and unsafe packages are blocked |
| [Threat Model (Python)](./security/SANDBOX_THREAT_MODEL.md) | Attacks blocked (network leaks, host reads/writes, fork bombs, infinite loops) |
| [Threat Model (Multi-Language)](./security/MULTI_LANGUAGE_THREAT_MODEL.md) | Shared safety checks across Python, JS, and TS |
| [Sandbox Test Results](./security/SANDBOX_TEST_RESULTS.md) | Recorded results from sandbox security tests |

---

## Development History & Specs

- **Project Specs:** [specs/requirements.md](../specs/requirements.md), [specs/design.md](../specs/design.md), [specs/tasks.md](../specs/tasks.md) (mirrored in `.kiro/specs/`)
- **Phase Reports:** [Phase 2](./PHASE_2_IMPLEMENTATION_REPORT.md), [Phase 3](./PHASE_3_IMPLEMENTATION_REPORT.md), [Phase 4A](./PHASE_4A_IMPLEMENTATION_REPORT.md)
- **Phase 1 Audit Archive:** [Product Audit](./audit/PRODUCT_AUDIT.md), [Security Audit](./audit/SECURITY_AUDIT.md), [Feature Inventory](./audit/FEATURE_INVENTORY.md)

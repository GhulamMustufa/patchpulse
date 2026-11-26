# Product Steering & Evaluation Guidelines

## Core Mission
Provide a verifiable multi-language software autopsy and modernization engine supporting Python 3.12, JavaScript, and TypeScript (Node.js 20 LTS) with isolated sandbox verification.

## Non-Negotiable UX & Integrity Principles
1. **1-Click Guest Evaluation:** Evaluators can explore pre-seeded patients, custom Python/JS/TS snippets, and public GitHub/ZIP ingestion without signup walls.
2. **Honest Telemetry:** Clearly distinguish `DIAGNOSED`, `REPAIR_GENERATED`, `REPAIR_APPROVED`, `SYNTAX_VERIFIED` (`NO_TESTS_FOUND`), `TESTS_RUNNING`, `RESURRECTED`, `PARTIALLY_RESURRECTED`, `FAILED`, and `VERIFICATION_BLOCKED`.
3. **Non-Destructive Patch Review:** Preserve original source files, display unified diffs and compiler diagnostics, validate syntax/types before accepting patches, and require explicit approval.
4. **Isolated Worker Execution:** Untrusted Python, JavaScript, and TypeScript code runs strictly inside separate isolated workers (`sandbox-worker/`), never on the Next.js application host.

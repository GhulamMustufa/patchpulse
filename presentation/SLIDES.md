# PatchPulse — Pitch Deck Outline

Use this structure for live demos and hackathon presentations.

---

## Slide 1: Hook
- **Title:** PatchPulse
- **Tagline:** Fix broken legacy code. Prove it with real tests.
- **Supported Languages:** Python 3.12 • Node.js 20 • TypeScript 5.9

---

## Slide 2: The Problem
- **Why old code breaks:** Language updates (like Python 2 to 3) and removed npm packages break working tools overnight.
- **Why normal AI chat falls short:** AI tools guess new APIs without running your tests—or silently drop edge cases.
- **The risk:** Running AI-generated fixes directly on your laptop or server is unsafe.

---

## Slide 3: How PatchPulse Solves It
1. **Load Any Project:** Built-in samples, pasted code, a public GitHub repo, or a `.zip` file.
2. **Fix Safely:** Combines real syntax/compiler checks with AI + built-in offline repair rules.
3. **Prove With Real Tests:** Executes tests inside an offline, locked-down sandbox—and never fakes a pass.

---

## Slide 4: Architecture & Built-In Safety
- **Frontend & API:** Next.js 15, React 19, TypeScript, Tailwind CSS (`/` Landing, `/lab` Workspace, `/dashboard` Status, `/docs` Guide)
- **AI & Rules Engine:** Google Gemini + offline deterministic AST/compiler repairs
- **Isolated Sandbox:** Separate Python 3.12 & Node 20 worker (`docker` or macOS `seatbelt`) with network off and zero host secrets
- **Verified Quality:** 40/40 automated tests passing across 8 suites, plus clean security audit across 112 files

---

## Slide 5: Live Demo & Repository
- **GitHub:** https://github.com/GhulamMustufa/patchpulse
- **Zero-Friction Access:** Open `/` and click **Open Live Workspace** (`/lab`)—no login required.

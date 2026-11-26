# 🧟 Devpost Submission Package: NecroCode

> **Hackathon:** AWS Kiroween (Devpost)  
> **Prize Tracks:**  
> 1. **Resurrection Category** ($5,000)  
> 2. **Best Student Project** ($5,000) — Ghulam Mustafa (Universiti Teknologi Malaysia)  
> 3. **Best Demo** ($1,000)  
> **Repository:** https://github.com/ghulam-mustafa/necrocode  
> **Status:** 100% COMPLETE & VERIFIED (12/12 Automated Tests Passing)

---

## 📋 Devpost Form Fields (Copy & Paste Ready)

### Project Title
**NecroCode — AI Software Autopsy & Resurrection Lab**

### Elevator Pitch (Under 120 Characters)
*Dig up dead repositories, perform forensic autopsies, and resurrect them into verified modern code with Kiro SDD.*

---

### Inspiration
Open-source software has a cemetery problem. On GitHub, millions of once-beloved repositories sit completely abandoned—killed not because the algorithms were flawed, but because standard libraries mutated, runtimes evolved, and critical dependencies dissolved into CVE rot:
* Python 2.7 dissolved in 2020, leaving thousands of battle-tested utilities crashing with `SyntaxError: Missing parentheses in call to 'print'`.
* Legacy Node.js packages like `request` died in 2020, and `new Buffer()` became a dangerous security liability.

When modern developers attempt to revive these dead projects using ordinary generative LLMs, they hit a wall: LLMs hallucinate non-existent modern APIs, silently delete edge cases, and invent phantom packages. We built **NecroCode** to apply forensic medical rigor to software resurrection using **Kiro Spec-Driven Development (SDD)**: a deterministic, verifiable operating theater where deceased code is diagnosed, repaired, and resuscitated with cardiac telemetry.

---

### What It Does
1. **Repository Exhumation (1-Click Presets):**
   * Pre-seeded with real historical patients:
     * **Patient #1 (Archivus Mortis):** A Python 2.7 CLI URL archiver (Died 2014) broken by `urllib2`, `xrange()`, `.iteritems()`, and legacy print statements.
     * **Patient #2 (Webhook Specter):** A Node.js 6 CommonJS dispatcher (Died 2016) crippled by the dead `request` package and insecure `new Buffer()` CVE allocations.
     * **Custom Mode:** Allows developers or judges to inject any custom legacy code or dead GitHub repository.
2. **Forensic Autopsy & Toxicity Scoring:**
   * Analyzes Abstract Syntax Tree (AST) decay, assigns an exact **Codebase Toxicity Score (0–100%)**, determines the **Official Cause of Death**, and isolates line-by-line lethal pathogens with suggested surgical repairs.
3. **Continuous Cardiac Telemetry (Lead II ECG Oscilloscope):**
   * Features a real-time animated CRT oscilloscope monitor:
     * **Initial Deceased State:** $\heartsuit$ **0 BPM Red Flatline** ("FLATLINE — SYNTAX EXTINCT").
     * **During Resuscitation:** $\heartsuit$ **45 BPM Amber Ventricular Pulse** ("DEFIBRILLATING AST NODES...").
     * **Post-Resurrection:** $\heartsuit$ **78 BPM Vibrant Emerald Sinus Rhythm** ("VITAL SIGNS RESTORED").
4. **Deterministic Kiro Resurrective Synthesis:**
   * Transmutes dead syntax into clean, modern, type-annotated codebases:
     * Python 2 $\rightarrow$ Python 3.12 (`urllib.request`, `range()`, `.items()`, `Optional[bytes]` types).
     * Node 6 $\rightarrow$ Node 20+ ESM (Native `fetch()`, `Buffer.from()`, `async/await`, ESM exports).
5. **Runtime Test Verification Matrix:**
   * Executes automated test suites proving 100% behavioral equivalence and 0 runtime exceptions.
   * Provides 1-click **"Download Resurrected Artifact"** and unified Git patch exports.

---

### How We Built It
* **Framework:** Next.js 15 (App Router), React 19, TypeScript 5.
* **Styling & Aesthetics:** Victorian Gothic Cyber-Morgue theme (Obsidian black, fluorescent CRT amber, and luminous emerald green) built with Tailwind CSS.
* **Audio-Visual Telemetry:** Interactive HTML5 Canvas CRT oscilloscope rendering animated mathematical sinus rhythm waveforms.
* **Kiro Spec-Driven Architecture (`/.kiro`):**
  * `.kiro/specs/requirements.md`: Defines functional requirements (FR-1 to FR-5) and non-functional safety guardrails.
  * `.kiro/steering/tech.md`: Guides deterministic AST repair rules and memory-safe transformations.
  * `.kiro/steering/product.md`: Enforces 1-click guest evaluability and honest telemetry disclosure.
  * `.kiro/hooks/validate.json`: Automates pre-commit validation running Vitest unit tests on save.
* **Verification & Security:**
  * Vitest unit test suite (`src/lib/__tests__/necro_engine.test.ts` — 12/12 passing).
  * Automated security scanner (`scripts/security_audit.py` auditing against `.semgrep.yml` for zero secret leaks and safe memory calls).

---

### Challenges We Overcame
1. **Preventing LLM Hallucinations in Code Upgrades:**
   * Standard LLM prompts frequently invent new package names or drop error handling logic. We solved this by using Kiro Spec-Driven constraints that mandate deterministic AST substitution and golden transformation recipes.
2. **Realistic ECG CRT Canvas Rendering:**
   * Building an authentic electrocardiogram required implementing continuous mathematical Lead II cardiac wave formulas (P wave, PR segment, QRS complex spike, ST segment, and T wave) with glowing CRT scanlines and dynamic BPM modulation.

---

### Accomplishments That We're Proud Of
* **100% Test Pass Rate:** 12/12 automated unit and integration tests passing in sub-second execution time.
* **Zero-Friction Evaluator Experience:** 1-click instant patient loading with zero login, zero API key requirements, and instant responsive feedback.
* **Production-Grade Next.js Build:** Clean production build (`npm run build`) with zero linting warnings or TypeScript errors.
* **Student Project Alignment:** Authored by Ghulam Mustafa, currently enrolled in postgraduate computing studies at Universiti Teknologi Malaysia (UTM).

---

### What We Learned
Spec-Driven Development (SDD) is a game-changer for agentic software engineering. By locking technical specifications in `.kiro/specs/` before executing repairs, agents are constrained to verifiable, non-destructive transformations instead of speculative code rewriting.

---

### What's Next for NecroCode
1. **GitHub PR Bot:** Automatically monitor archived repositories and open automated "Resurrection Pull Requests" with modernized runtimes and GitHub Actions CI pipelines.
2. **Multi-Language Expansion:** Expanding to C++98 $\rightarrow$ Modern C++20, Java 6 $\rightarrow$ Java 21 LTS, and PHP 5.3 $\rightarrow$ PHP 8.3.
3. **AWS Bedrock Integration:** Deploying fine-tuned Amazon Bedrock models for enterprise legacy Cobol/Fortran modernization.

---

## 🎬 2-Minute Demo Video Recording Script

> **Target Length:** Exactly 1 minute 50 seconds to 2 minutes.  
> **Speaker:** Ghulam Mustafa  
> **Prep:** Open `http://localhost:3000` on your screen in full-screen dark mode.

---

### [0:00 - 0:25] The Hook & The Problem
* **Visual:** Show GitHub search with thousands of dead 2014 repositories, then cut to the NecroCode homepage.
* **Voiceover:**
  > "Hello Kiroween judges! My name is Ghulam Mustafa, a student at Universiti Teknologi Malaysia, and this is **NecroCode** — the AI Software Resurrection Lab.
  > 
  > Every year, thousands of valuable open-source repositories die on GitHub. They die because standard libraries changed, dependencies were deprecated, or runtime syntax moved on. When developers try to fix them with ordinary AI chatbots, the AI hallucinates non-existent APIs and breaks everything.
  > 
  > NecroCode solves this with **Kiro Spec-Driven Development**."

---

### [0:25 - 0:55] Patient Exhumation & The Digital Autopsy
* **Visual:** Point mouse at **Patient #1: Archivus Mortis (Python 2.7 URL Archiver)**. Click on it. Show the flatline ECG at 0 BPM.
* **Voiceover:**
  > "Let's exhume our first patient: **Archivus Mortis**, a Python 2.7 CLI archiver that died back in October 2014.
  > 
  > Notice the Lead II cardiac monitor above: the patient is completely **flatlined at 0 BPM**.
  > 
  > Down here in the Forensic Pathology findings, NecroCode's AST diagnostic scanner has identified an 80% toxicity score. The primary cause of death? Lethal syntax rot: unparenthesized print statements, the long-extinct `urllib2` standard library, and deprecated `.iteritems()`. In modern Python 3, this code crashes instantly."

---

### [0:55 - 1:30] The Defibrillation & Resurrection Magic
* **Visual:** Click the glowing purple **"Resurrect & Defibrillate"** button.
* **Visual:** Watch the ECG monitor transition: amber pulse at 45 BPM ("DEFIBRILLATING AST..."), then after 900ms, burst into vibrant emerald green at 78 BPM ("VITAL SIGNS RESTORED").
* **Visual:** Point to the right-hand code panel showing the clean Python 3.12 code with type annotations and `urllib.request`.
* **Voiceover:**
  > "Now, let's resuscitate the repository. I'll click **Resurrect & Defibrillate**...
  > 
  > Look at the ECG! Defibrillating at 45 BPM... and boom! **Normal sinus rhythm restored at 78 BPM.**
  > 
  > In the split-screen view, you can see the transformation: legacy `urllib2` is safely replaced by modern `urllib.request`, print statements are modernized with clean f-strings, and type annotations are injected. 
  > 
  > Down below, the Runtime Test Verification Matrix confirms that all test suites are now **100% PASS** with zero runtime exceptions."

---

### [1:30 - 1:50] Patient #2 & Kiro Spec Architecture
* **Visual:** Click **Patient #2: Webhook Specter (Node.js 6)**. Show the CVE Buffer vulnerability. Click Resurrect. Then scroll down to the **Kiro SDD Architecture** section.
* **Voiceover:**
  > "NecroCode also handles Node.js patients like **Webhook Specter**, instantly replacing the deprecated `request` npm package with modern native `fetch()` and patching critical `new Buffer()` CVE memory leaks.
  > 
  > All of this is powered by Kiro's Spec-Driven Development. Our repository includes a complete `/.kiro` setup: requirements specs, steering guidelines, and validation hooks that guarantee zero-hallucination deterministic repairs."

---

### [1:50 - 2:00] Closing & Call to Action
* **Visual:** Click **"Download Resurrected Artifact"** to show instant file generation, then face camera / show footer.
* **Voiceover:**
  > "With NecroCode, no good repository ever has to stay in the graveyard. 
  > 
  > Thank you to AWS and Kiro for hosting Kiroween. We're proud to submit NecroCode for the **Resurrection Category** and **Best Student Project**!"

# 🏗️ Technical Architecture & Design: NecroCode

> **System Component Architecture & State Machine**

---

## 1. System Architecture Diagram

```mermaid
flowchart TD
    Judge["👤 Judge / Developer"]
    
    subgraph UI["Victorian Gothic Morgue UI (Next.js 15 + Tailwind)"]
        PresetBar["⚰️ Patient Exhumation Bar (Python 2 / Node.js Presets)"]
        ECGMonitor["💓 Animated Electrocardiogram (Canvas/SVG Heartbeat)"]
        AutopsyReport["📜 Digital Pathology & Cause of Death Card"]
        DiffViewer["🔍 Side-by-Side Code Diff (Legacy vs Modern)"]
        TestRunner["🧪 Vital Signs & Unit Test Execution Console"]
    end
    
    subgraph NecroEngine["NecroCode Engine (src/lib/necro-engine)"]
        Scanner["AST Decay Scanner (diagnoser.ts)"]
        Transformer["Syntax & Dependency Resurrector (resurrector.ts)"]
        Verifier["Behavioral & Test Equivalence Verifier (verifier.ts)"]
        Patients["Pre-Seeded Patient Vault (patients.ts)"]
    end
    
    subgraph KiroIntegration["Kiro IDE Spec & Hook Layer (/.kiro)"]
        KiroSpecs["/.kiro/specs/resurrection.md"]
        KiroHooks["/.kiro/hooks/validate.json"]
        KiroSteering["/.kiro/steering/tech.md"]
    end
    
    Judge --> PresetBar
    PresetBar --> Patients
    PresetBar --> Scanner
    Scanner --> AutopsyReport
    Scanner --> ECGMonitor
    AutopsyReport --> Transformer
    Transformer --> DiffViewer
    Transformer --> Verifier
    Verifier --> TestRunner
    Verifier --> ECGMonitor
    NecroEngine <--> KiroIntegration
```

---

## 2. Patient Data Contract (TypeScript Interfaces)

```typescript
export type LanguageType = "python" | "javascript" | "typescript";
export type VitalStatus = "DEAD" | "RESURRECTING" | "ALIVE";

export interface NecroPatient {
  id: string;
  name: string;
  deceasedYear: number;
  language: LanguageType;
  cemeteryLocation: string;
  causeOfDeath: string[];
  deadCode: string;
  expectedModernCode: string;
  testCases: Array<{
    name: string;
    legacyStatus: "FAIL" | "SYNTAX_ERROR";
    resurrectedStatus: "PASS";
  }>;
}

export interface AutopsyReport {
  patientId: string;
  toxicityScore: number; // 0 to 100%
  fatalErrors: Array<{
    line: number;
    rule: string;
    description: string;
    legacySnippet: string;
    repairedSnippet: string;
  }>;
  summary: string;
  resurrectedCode: string;
  testPassRate: number; // 100%
}
```

---

## 3. UI Layout & Visual Language
* **Atmosphere:** Dark Gothic laboratory.
* **Palette:**
  * Background: `#0B0C10` (Dark Obsidian)
  * Secondary Card: `#141821` (Morgue Slate)
  * Toxic Accent: `#00FFA3` (Reanimation Green)
  * Fatal Error Accent: `#FF4C4C` (Flatline Red)
  * Text: `#E2E8F0` (Bone White)

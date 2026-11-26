# 🏗️ Technical Architecture & Design: NecroCode

> **Source Standard:** Spec Kit Architecture & OpenPencil Design Specification

---

## 1. System Architecture Diagram

```mermaid
flowchart TD
    User["👤 User / Evaluator (Browser / Client)"]
    
    subgraph Frontend["Frontend Client (Next.js 15 App Router)"]
        UI["Tailwind CSS + shadcn Components"]
        GuestBypass["1-Click Guest Bypass Controller"]
        State["Client State / Reactive Store"]
    end
    
    subgraph CoreEngine["Core Engine / Agent Pipeline"]
        Router["Policy Router / Tool Dispatcher"]
        Engine["Core Business Logic / Worker"]
        Verifier["Deterministic Output Verifier"]
    end
    
    subgraph External["External Services & APIs"]
        LLM["AI Model / Provider (Gemini / Bedrock / Claude)"]
        DB["Database / Storage (Neon / SQLite / IndexedDB)"]
        Protocols["Protocols / RPC (Base / Solana / EVM)"]
    end
    
    User --> UI
    UI --> GuestBypass
    UI --> Router
    Router --> Engine
    Engine --> LLM
    Engine --> DB
    Engine --> Protocols
    Engine --> Verifier
    Verifier --> UI
```

---

## 2. Component Hierarchy & Layout Plan
* **Shell:** Responsive Navbar (Logo, Status Badge, ThemeToggle, Demo Bypass Button).
* **Main Stage:**
  * Left / Top: Input Console (File upload, text prompt, or 1-click Preset Selector).
  * Right / Bottom: Live Execution Canvas (Interactive results, animated status, output diff).
* **Inspector:** Expandable Telemetry / Network Disclosure drawer (showing honest latency, model name, and zero-leak payload proof).

---

## 3. Data Schema & Contracts (Zod / TypeScript)
Define all inputs and outputs with strict runtime schemas to eliminate hallucinations:

```typescript
// Example: Strict output constraint
export interface VerificationResult {
  id: string;
  timestamp: string;
  status: "PASSED" | "FLAGGED" | "FAILED";
  metrics: {
    confidenceScore: number;
    latencyMs: number;
  };
  findings: Array<{
    code: string;
    description: string;
    severity: "low" | "medium" | "critical";
  }>;
}
```

---

## 4. Error Handling & Fallback Strategy
* **Offline / Timeout:** Show simulated pre-seeded fallback data with a transparent `DEMO_MODE` badge instead of breaking.
* **Input Validation:** Reject oversized inputs with clear, polite client-side warnings before triggering API calls.

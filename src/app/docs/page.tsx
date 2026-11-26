"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  ArrowLeft,
  BookOpen,
  Terminal,
  Code2,
  Layers,
  ShieldCheck,
  Copy,
  Check,
} from "lucide-react";

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState<
    "quickstart" | "architecture" | "api" | "safety"
  >("quickstart");
  const [copied, setCopied] = useState<string | null>(null);

  const copyCode = async (code: string, id: string) => {
    await navigator.clipboard.writeText(code);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="min-h-screen bg-[#05070d] text-slate-100 flex flex-col">
      <header className="border-b border-slate-800 bg-[#070b14]/90 backdrop-blur-md px-4 sm:px-6 py-3 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/">
            <Button
              variant="outline"
              size="sm"
              className="border-slate-700 text-slate-200 hover:bg-slate-800"
            >
              <ArrowLeft className="w-4 h-4 mr-1" /> Lab
            </Button>
          </Link>
          <div className="flex items-center gap-2 min-w-0">
            <BookOpen className="w-4 h-4 text-purple-400 shrink-0" />
            <span className="font-mono font-bold text-sm sm:text-base tracking-tight truncate">
              NecroCode Docs &amp; API
            </span>
          </div>
          <Badge variant="purple" className="hidden sm:inline-flex">
            Phase 2
          </Badge>
        </div>

        <Link href="/dashboard">
          <Button
            variant="outline"
            size="sm"
            className="border-slate-700 text-slate-200 hover:bg-slate-800"
          >
            System Telemetry
          </Button>
        </Link>
      </header>

      <div className="flex-1 max-w-7xl w-full mx-auto flex flex-col md:flex-row">
        <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r border-slate-800 p-3 sm:p-6 flex flex-row md:flex-col overflow-x-auto md:overflow-x-visible gap-1 md:space-y-1 shrink-0 bg-[#070b14]/50">
          <div className="text-[11px] font-mono font-semibold text-slate-500 uppercase tracking-wider mb-2 px-3 hidden md:block">
            Documentation Index
          </div>

          {(
            [
              { id: "quickstart", label: "Quickstart", icon: Terminal },
              { id: "architecture", label: "Architecture", icon: Layers },
              { id: "api", label: "API Reference", icon: Code2 },
              { id: "safety", label: "Safety & Sandbox", icon: ShieldCheck },
            ] as const
          ).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveSection(id)}
              className={`whitespace-nowrap md:w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs sm:text-sm font-mono transition shrink-0 ${
                activeSection === id
                  ? "bg-purple-600/30 text-purple-200 border border-purple-500/40 font-semibold"
                  : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-100"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" /> {label}
            </button>
          ))}
        </aside>

        <main className="flex-1 p-6 sm:p-10 max-w-4xl space-y-6">
          {activeSection === "quickstart" && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight font-mono">
                  Quickstart Guide
                </h1>
                <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                  Run NecroCode locally with deterministic AST checks and optional Gemini AI repair synthesis.
                </p>
              </div>

              <div className="relative rounded-xl border border-slate-800 bg-[#070b14] p-4 font-mono text-xs">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-slate-400">
                  <span>bash</span>
                  <button
                    type="button"
                    onClick={() =>
                      copyCode("npm install\nnpm run dev\nnpm test", "quickstart")
                    }
                    className="flex items-center gap-1 hover:text-white transition"
                  >
                    {copied === "quickstart" ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copied === "quickstart" ? "Copied" : "Copy"}</span>
                  </button>
                </div>
                <pre className="text-slate-200 leading-relaxed overflow-x-auto">
{`npm install
npm run dev
npm test`}
                </pre>
              </div>
            </div>
          )}

          {activeSection === "architecture" && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight font-mono">
                  System Architecture
                </h1>
                <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                  Four-stage pipeline: Ingestion → Real Diagnosis → Validated Repair → Verification Preparation.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                <div className="p-4 rounded-lg border border-slate-800 bg-[#070b14]">
                  <div className="font-bold text-purple-300 mb-1">1. Ingestion</div>
                  <div className="text-slate-400 font-sans">
                    Validates public GitHub URLs or controlled ZIP uploads with size, path, and symlink checks.
                  </div>
                </div>
                <div className="p-4 rounded-lg border border-slate-800 bg-[#070b14]">
                  <div className="font-bold text-rose-300 mb-1">2. Diagnosis</div>
                  <div className="text-slate-400 font-sans">
                    Inspects Python AST compatibility, dependencies, imports, and tests across files.
                  </div>
                </div>
                <div className="p-4 rounded-lg border border-slate-800 bg-[#070b14]">
                  <div className="font-bold text-cyan-300 mb-1">3. Repair Synthesis</div>
                  <div className="text-slate-400 font-sans">
                    Combines deterministic transforms with Gemini repair proposals and syntax validation.
                  </div>
                </div>
                <div className="p-4 rounded-lg border border-slate-800 bg-[#070b14]">
                  <div className="font-bold text-emerald-300 mb-1">4. Verification Prep</div>
                  <div className="text-slate-400 font-sans">
                    Performs syntax validation and test discovery while isolating untrusted execution until Phase 3.
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSection === "api" && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight font-mono">
                  API Reference
                </h1>
                <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                  Zod-validated Next.js route handlers backing the NecroCode workbench.
                </p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-[#070b14] divide-y divide-slate-800 text-xs font-mono">
                {[
                  { method: "GET", path: "/api/health", desc: "Service & integration telemetry" },
                  { method: "POST", path: "/api/repo/ingest", desc: "Ingest public GitHub repository or ZIP archive" },
                  { method: "POST", path: "/api/diagnose", desc: "Analyze Python project files & dependencies" },
                  { method: "POST", path: "/api/resurrect", desc: "Generate & syntax-validate AST/AI repair patches" },
                  { method: "POST", path: "/api/verify", desc: "Run syntax checks & test discovery (sandbox-pending)" },
                ].map((ep) => (
                  <div key={ep.path} className="p-4 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <span className="px-2 py-0.5 rounded font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30">
                        {ep.method}
                      </span>
                      <code className="font-semibold text-slate-100">{ep.path}</code>
                    </div>
                    <span className="text-slate-400 font-sans">{ep.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeSection === "safety" && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight font-mono">
                  Safety &amp; Sandbox Boundary
                </h1>
                <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                  Untrusted repository code is never executed on the Next.js application server. Python syntax checks use `ast.parse` only, and runtime `pytest`/`unittest` execution is gated until Phase 3&apos;s isolated sandbox container.
                </p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

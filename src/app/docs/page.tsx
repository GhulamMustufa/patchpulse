"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  BookOpen,
  Code2,
  Cpu,
  Layers,
  ShieldCheck,
} from "lucide-react";

type DocsTab = "quickstart" | "architecture" | "api" | "safety";

export default function DocsPage() {
  const [activeTab, setActiveTab] = useState<DocsTab>("quickstart");

  return (
    <div className="min-h-screen bg-[#05070d] text-slate-100">
      <header className="border-b border-slate-800/80 bg-[#070b14]/90 backdrop-blur-md px-4 sm:px-6 py-3">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/lab"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-slate-700"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Workspace
            </Link>
            <h1 className="text-base font-semibold text-white">
              Guide &amp; API Reference
            </h1>
          </div>

          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 hover:text-white"
          >
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            System Status
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-white">
            How NecroCode Works
          </h2>
          <p className="text-sm text-slate-400">
            Clear documentation for repairing legacy Python, JavaScript, and TypeScript projects.
          </p>
        </div>

        {/* Clean 4-tab switcher */}
        <div
          role="tablist"
          aria-label="Documentation sections"
          className="inline-flex flex-wrap rounded-lg bg-[#070b14] border border-slate-800 p-1 gap-1"
        >
          {[
            { id: "quickstart", label: "Quick Guide", icon: BookOpen },
            { id: "architecture", label: "How It Works", icon: Layers },
            { id: "api", label: "API Reference", icon: Code2 },
            { id: "safety", label: "Security & Sandbox", icon: ShieldCheck },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTab(tab.id as DocsTab)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-colors ${
                  active
                    ? "bg-purple-600/25 text-purple-200 border border-purple-500/40"
                    : "text-slate-400 hover:text-slate-200 border border-transparent"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {activeTab === "quickstart" && (
          <div className="space-y-6">
            <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-xl border border-slate-800 bg-[#070b14] p-4 space-y-2">
                <span className="text-xs font-mono text-purple-300">
                  Step 1
                </span>
                <h3 className="text-sm font-semibold text-white">
                  Load Legacy Code
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Pick a sample project, paste your own snippet, or load a public GitHub repository or .zip archive (up to 15 MB).
                </p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-[#070b14] p-4 space-y-2">
                <span className="text-xs font-mono text-cyan-300">Step 2</span>
                <h3 className="text-sm font-semibold text-white">
                  Fix &amp; Review Diff
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Click Fix Code to check syntax, types, and outdated APIs, then review the side-by-side changes or unified diff.
                </p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-[#070b14] p-4 space-y-2">
                <span className="text-xs font-mono text-emerald-300">
                  Step 3
                </span>
                <h3 className="text-sm font-semibold text-white">
                  Approve &amp; Run Tests
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Approve the fix and click Run Tests to verify behavior in an offline, time-limited sandbox.
                </p>
              </div>
            </section>

            <section className="rounded-xl border border-slate-800 bg-[#070b14] overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-800 bg-[#0b101d] flex items-center gap-2">
                <Cpu className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-semibold text-white">
                  Supported Languages &amp; Limits
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="py-2.5 px-4">Language</th>
                      <th className="py-2.5 px-4">Target Runtime</th>
                      <th className="py-2.5 px-4">Supported Test Runners</th>
                      <th className="py-2.5 px-4">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300">
                    <tr>
                      <td className="py-2.5 px-4 font-medium text-white">
                        Python
                      </td>
                      <td className="py-2.5 px-4 font-mono">Python 3.12</td>
                      <td className="py-2.5 px-4 font-mono">
                        pytest, unittest
                      </td>
                      <td className="py-2.5 px-4 text-slate-400">
                        Upgrades Python 2 syntax, stdlib imports, and legacy Flask patterns
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-medium text-white">
                        JavaScript
                      </td>
                      <td className="py-2.5 px-4 font-mono">Node.js 20 LTS</td>
                      <td className="py-2.5 px-4 font-mono">
                        node --test, Jest, Vitest
                      </td>
                      <td className="py-2.5 px-4 text-slate-400">
                        Modernizes Buffer constructors, url.parse, fs.exists, and callbacks
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-medium text-white">
                        TypeScript
                      </td>
                      <td className="py-2.5 px-4 font-mono">TypeScript 5.9</td>
                      <td className="py-2.5 px-4 font-mono">
                        tsc --noEmit, node --test, Vitest
                      </td>
                      <td className="py-2.5 px-4 text-slate-400">
                        Runs real compiler diagnostics and fixes implicit any and strict-mode issues
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {activeTab === "architecture" && (
          <div className="space-y-6">
            <section className="rounded-xl border border-slate-800 bg-[#070b14] p-5 space-y-4">
              <h3 className="text-sm font-semibold text-white">
                4-Stage Verification Pipeline
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="rounded-lg border border-slate-800 bg-[#090e1a] p-3.5 space-y-1">
                  <div className="font-semibold text-purple-300">
                    1. Safe Repository Ingestion
                  </div>
                  <p className="text-slate-400">
                    Validates public GitHub URLs or uploaded ZIPs, strips symlinks and path traversal, and detects languages and frameworks automatically.
                  </p>
                </div>
                <div className="rounded-lg border border-slate-800 bg-[#090e1a] p-3.5 space-y-1">
                  <div className="font-semibold text-amber-300">
                    2. Static &amp; Compiler Diagnosis
                  </div>
                  <p className="text-slate-400">
                    Finds real syntax errors, TypeScript compiler diagnostics, outdated APIs, and security risks without inflating severity scores.
                  </p>
                </div>
                <div className="rounded-lg border border-slate-800 bg-[#090e1a] p-3.5 space-y-1">
                  <div className="font-semibold text-cyan-300">
                    3. Validated Patch Generation
                  </div>
                  <p className="text-slate-400">
                    Combines deterministic AST transforms with Gemini AI when configured, verifying syntax validity before presenting the diff.
                  </p>
                </div>
                <div className="rounded-lg border border-slate-800 bg-[#090e1a] p-3.5 space-y-1">
                  <div className="font-semibold text-emerald-300">
                    4. Isolated Sandbox Execution
                  </div>
                  <p className="text-slate-400">
                    Runs tests only after user approval inside an offline worker with strict memory, CPU, and timeout limits.
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-slate-800 bg-[#070b14] p-5 space-y-3">
              <h3 className="text-sm font-semibold text-white">
                Kiro Spec-Driven Development (.kiro)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="rounded-lg border border-slate-800 bg-[#090e1a] p-3.5 space-y-1">
                  <div className="font-mono font-semibold text-purple-300">
                    .kiro/specs/requirements.md
                  </div>
                  <p className="text-slate-400">
                    Defines ingestion limits, language support, and truthful telemetry rules.
                  </p>
                </div>
                <div className="rounded-lg border border-slate-800 bg-[#090e1a] p-3.5 space-y-1">
                  <div className="font-mono font-semibold text-cyan-300">
                    .kiro/steering/tech.md
                  </div>
                  <p className="text-slate-400">
                    Enforces Zod validation, strict TypeScript, lifecycle-script bans, and isolated Python &amp; Node workers.
                  </p>
                </div>
                <div className="rounded-lg border border-slate-800 bg-[#090e1a] p-3.5 space-y-1">
                  <div className="font-mono font-semibold text-emerald-300">
                    .kiro/hooks/validate.json
                  </div>
                  <p className="text-slate-400">
                    Post-save hook running Vitest regression and security isolation suites.
                  </p>
                </div>
              </div>
            </section>
          </div>
        )}

        {activeTab === "api" && (
          <div className="space-y-3 text-xs">
            {[
              {
                method: "POST",
                path: "/api/repo/ingest",
                desc: "Fetch a public GitHub repository or unpack a .zip upload (max 15 MB, 40 files).",
              },
              {
                method: "POST",
                path: "/api/diagnose",
                desc: "Run static, compiler, and dependency checks across Python, JS, or TS files.",
              },
              {
                method: "POST",
                path: "/api/resurrect",
                desc: "Generate validated code patches and unified diffs with syntax verification.",
              },
              {
                method: "POST",
                path: "/api/sandbox/execute",
                desc: "Execute approved tests inside an isolated offline worker and return honest results.",
              },
              {
                method: "GET",
                path: "/api/health",
                desc: "Check AI, database, and sandbox worker availability.",
              },
            ].map((ep) => (
              <div
                key={ep.path}
                className="rounded-xl border border-slate-800 bg-[#070b14] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2.5">
                  <span className="px-2 py-0.5 rounded bg-purple-950/60 text-purple-200 border border-purple-500/40 font-mono font-semibold">
                    {ep.method}
                  </span>
                  <code className="font-mono text-cyan-300">{ep.path}</code>
                </div>
                <p className="text-slate-400">{ep.desc}</p>
              </div>
            ))}
          </div>
        )}

        {activeTab === "safety" && (
          <div className="rounded-xl border border-slate-800 bg-[#070b14] p-5 space-y-3 text-xs text-slate-300 leading-relaxed">
            <h3 className="text-sm font-semibold text-white">
              Sandbox &amp; Security Guarantees
            </h3>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-300">
              <li>
                <strong>No Host Execution:</strong> Submitted code never runs directly inside the Next.js server process.
              </li>
              <li>
                <strong>Offline Execution:</strong> Network access is disabled during test runs; no API keys or environment secrets are passed into the sandbox.
              </li>
              <li>
                <strong>No Lifecycle Scripts:</strong> Package postinstall and arbitrary shell scripts are blocked.
              </li>
              <li>
                <strong>Honest Fail-Closed Status:</strong> If an isolation driver (Docker or macOS Seatbelt) is unavailable or external packages cannot be resolved safely, NecroCode returns Tests Blocked instead of faking a pass.
              </li>
            </ul>
          </div>
        )}
      </main>
    </div>
  );
}

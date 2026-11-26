"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Code2,
  Cpu,
  FileDiff,
  FolderGit2,
  Lock,
  Play,
  ShieldCheck,
  Skull,
  Sparkles,
} from "lucide-react";

type PreviewLang = "python" | "javascript" | "typescript";

const PREVIEW_EXAMPLES: Record<
  PreviewLang,
  {
    label: string;
    file: string;
    before: string;
    after: string;
    badge: string;
  }
> = {
  python: {
    label: "Python 2 -> 3.12",
    file: "archiver.py",
    before: `import urllib2
print "Fetching archive..."
for k, v in items.iteritems():
    process(k, v)`,
    after: `import urllib.request
print("Fetching archive...")
for k, v in items.items():
    process(k, v)`,
    badge: "3/3 tests passed • Offline sandbox",
  },
  javascript: {
    label: "Legacy Node -> Node 20",
    file: "webhook.js",
    before: `const buf = new Buffer(payload);
const request = require("request");
fs.exists(cfg, (ok) => {
  if (ok) send(buf);
});`,
    after: `const buf = Buffer.from(payload);
// Uses native fetch (Node 20)
if (fs.existsSync(cfg)) {
  await fetch(endpoint, { method: "POST", body: buf });
}`,
    badge: "Syntax OK • Unsafe APIs fixed",
  },
  typescript: {
    label: "Broken TS -> TypeScript 5.9",
    file: "handler.ts",
    before: `export function parseUser(data) {
  return data.email.trim();
}`,
    after: `export function parseUser(data: { email: string }): string {
  return data.email.trim();
}`,
    badge: "tsc --noEmit passed • Strict types OK",
  },
};

export default function LandingPage() {
  const [previewLang, setPreviewLang] = useState<PreviewLang>("python");
  const example = PREVIEW_EXAMPLES[previewLang];

  return (
    <div className="min-h-screen bg-[#05070d] text-slate-100 selection:bg-purple-600 selection:text-white">
      {/* Subtle Ambient Background Glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 h-[520px] bg-[radial-gradient(ellipse_at_top,_rgba(139,92,246,0.16),_rgba(6,182,212,0.06)_45%,_transparent_75%)]"
      />

      {/* Sticky Top Header */}
      <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-[#070b14]/90 backdrop-blur-md px-4 sm:px-6 py-3">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-950/80 border border-purple-700/60 text-purple-300">
              <Skull className="h-4 w-4" />
            </div>
            <span className="font-mono text-base font-bold tracking-tight text-white">
              NECROCODE
            </span>
          </Link>

          <nav
            className="flex items-center gap-2 sm:gap-3 text-xs font-medium"
            aria-label="Main navigation"
          >
            <Link
              href="/lab"
              className="px-2.5 py-1.5 text-slate-300 hover:text-white transition-colors"
            >
              Workspace
            </Link>
            <Link
              href="/dashboard"
              className="px-2.5 py-1.5 text-slate-300 hover:text-white transition-colors"
            >
              System Status
            </Link>
            <Link
              href="/docs"
              className="px-2.5 py-1.5 text-slate-300 hover:text-white transition-colors"
            >
              Guide
            </Link>
            <Link
              href="/lab"
              className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 px-3.5 py-1.5 text-xs font-semibold text-white transition-colors shadow-sm shadow-purple-950"
            >
              Try It Free
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </nav>
        </div>
      </header>

      <main className="relative max-w-6xl mx-auto px-4 sm:px-6">
        {/* HERO SECTION */}
        <section className="py-12 md:py-16 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
          <div className="lg:col-span-6 space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-950/40 px-3 py-1 text-xs font-medium text-purple-200">
              <Cpu className="w-3.5 h-3.5 text-purple-400" />
              Python 3.12 • Node.js 20 • TypeScript 5.9
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white leading-[1.12]">
              Fix Broken Legacy Code.{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-cyan-300 to-emerald-400">
                Prove It With Real Tests.
              </span>
            </h1>

            <p className="text-base text-slate-300 leading-relaxed max-w-xl">
              Load a public GitHub repo or paste outdated code. NecroCode finds what broke, repairs it safely, and tests every fix inside an offline sandbox.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Link
                href="/lab"
                className="inline-flex items-center gap-2 rounded-lg bg-purple-600 hover:bg-purple-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors shadow-lg shadow-purple-950/50"
              >
                <Play className="w-4 h-4 fill-current" />
                Open Live Workspace
              </Link>
              <a
                href="#how-it-works"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/70 hover:border-slate-500 px-4 py-2.5 text-sm font-medium text-slate-200 transition-colors"
              >
                See How It Works
              </a>
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-2 text-xs text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                No signup required
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-cyan-400" />
                Tests run offline
              </span>
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
                Zero fake test passes
              </span>
            </div>
          </div>

          {/* RIGHT HERO: Interactive Visual Code Card */}
          <div className="lg:col-span-6">
            <div className="rounded-2xl border border-slate-800 bg-[#070b14] shadow-2xl overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b border-slate-800 bg-[#0b101d]">
                <div
                  role="tablist"
                  aria-label="Preview language"
                  className="inline-flex items-center gap-1"
                >
                  {(["python", "javascript", "typescript"] as const).map(
                    (lang) => {
                      const active = previewLang === lang;
                      return (
                        <button
                          key={lang}
                          type="button"
                          role="tab"
                          aria-selected={active}
                          onClick={() => setPreviewLang(lang)}
                          className={`px-2.5 py-1 rounded-md text-xs font-medium capitalize cursor-pointer transition-colors ${
                            active
                              ? "bg-purple-600/30 text-purple-100 border border-purple-500/50"
                              : "text-slate-400 hover:text-slate-200 border border-transparent"
                          }`}
                        >
                          {lang}
                        </button>
                      );
                    }
                  )}
                </div>
                <span className="font-mono text-[11px] text-slate-400">
                  {example.file}
                </span>
              </div>

              <div className="p-4 space-y-3 font-mono text-xs">
                <div className="rounded-lg border border-rose-500/20 bg-rose-950/20 p-3">
                  <div className="text-[10px] font-sans font-semibold uppercase tracking-wider text-rose-300 mb-1.5">
                    Before ({example.label.split("->")[0].trim()})
                  </div>
                  <pre className="text-rose-200/90 overflow-x-auto leading-relaxed">
                    <code>{example.before}</code>
                  </pre>
                </div>

                <div className="rounded-lg border border-emerald-500/25 bg-emerald-950/20 p-3">
                  <div className="text-[10px] font-sans font-semibold uppercase tracking-wider text-emerald-300 mb-1.5">
                    After (Repaired)
                  </div>
                  <pre className="text-emerald-100 overflow-x-auto leading-relaxed">
                    <code>{example.after}</code>
                  </pre>
                </div>
              </div>

              <div className="px-4 py-2.5 border-t border-slate-800 bg-[#0b101d] flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="inline-flex items-center gap-1.5 text-emerald-300 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {example.badge}
                </span>
                <Link
                  href="/lab"
                  className="text-cyan-300 hover:text-cyan-200 font-medium inline-flex items-center gap-1"
                >
                  Try it yourself
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* PLATFORM QUALITIES: 4 Smart Highlights */}
        <section aria-label="Platform highlights" className="py-10 border-t border-slate-800/70">
          <div className="mb-6 space-y-1">
            <h2 className="text-xl sm:text-2xl font-bold text-white">
              Why Teams Trust NecroCode
            </h2>
            <p className="text-sm text-slate-400">
              Built for real code verification—not blind AI guesses.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                icon: Code2,
                color: "text-cyan-400",
                title: "Finds Real Errors First",
                desc: "Scans syntax, types, and outdated packages before editing a single line.",
              },
              {
                icon: Sparkles,
                color: "text-purple-400",
                title: "AI + Built-in Rules",
                desc: "Pairs Gemini AI with deterministic AST fixes so repairs work offline too.",
              },
              {
                icon: ShieldCheck,
                color: "text-emerald-400",
                title: "Offline Test Sandbox",
                desc: "Runs untrusted code with network disabled and zero access to host secrets.",
              },
              {
                icon: FileDiff,
                color: "text-amber-400",
                title: "100% Honest Results",
                desc: "Shows real pass/fail telemetry. Missing tests never count as passing.",
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className="rounded-xl border border-slate-800 bg-[#070b14] p-4 space-y-2"
                >
                  <Icon className={`w-5 h-5 ${item.color}`} />
                  <h3 className="text-sm font-semibold text-white">
                    {item.title}
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* HOW IT WORKS: 3 Clean Steps */}
        <section
          id="how-it-works"
          aria-label="How it works"
          className="py-10 border-t border-slate-800/70"
        >
          <div className="mb-6 space-y-1">
            <h2 className="text-xl sm:text-2xl font-bold text-white">
              How It Works in 3 Steps
            </h2>
            <p className="text-sm text-slate-400">
              From broken legacy code to verified tests in under a minute.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                step: "01",
                title: "Add Your Code",
                desc: "Pick a sample project, paste code, or import any public GitHub repo or .zip file.",
              },
              {
                step: "02",
                title: "Review Every Fix",
                desc: "Inspect the side-by-side diff and approve the exact changes before execution.",
              },
              {
                step: "03",
                title: "Run Safe Tests",
                desc: "Execute pytest, unittest, node:test, or tsc checks in a locked-down sandbox.",
              },
            ].map((item) => (
              <div
                key={item.step}
                className="rounded-xl border border-slate-800 bg-[#070b14] p-5 space-y-2"
              >
                <span className="font-mono text-xs font-bold text-purple-400">
                  STEP {item.step}
                </span>
                <h3 className="text-base font-semibold text-white">
                  {item.title}
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* DIRECT WORKSPACE SHORTCUTS */}
        <section aria-label="Try live examples" className="py-10 border-t border-slate-800/70">
          <div className="mb-6 space-y-1">
            <h2 className="text-xl sm:text-2xl font-bold text-white">
              Jump Right In
            </h2>
            <p className="text-sm text-slate-400">
              Open a built-in example or load your own repository right away.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link
              href="/lab?sample=patient_py2_archiver"
              className="group rounded-xl border border-slate-800 bg-[#070b14] hover:border-purple-500/60 p-4 flex flex-col justify-between gap-3 transition-colors"
            >
              <div className="space-y-1.5">
                <span className="inline-block px-2 py-0.5 rounded bg-sky-950/60 text-sky-300 border border-sky-700/40 text-[11px] font-medium">
                  Python 2 -&gt; 3.12
                </span>
                <h3 className="text-sm font-semibold text-white">
                  Legacy Python CLI
                </h3>
                <p className="text-xs text-slate-400">
                  Fixes old print statements, urllib2 imports, and dict methods.
                </p>
              </div>
              <span className="text-xs font-medium text-purple-300 group-hover:text-purple-200 inline-flex items-center gap-1">
                Open sample <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </Link>

            <Link
              href="/lab?sample=patient_node_webhook"
              className="group rounded-xl border border-slate-800 bg-[#070b14] hover:border-purple-500/60 p-4 flex flex-col justify-between gap-3 transition-colors"
            >
              <div className="space-y-1.5">
                <span className="inline-block px-2 py-0.5 rounded bg-amber-950/60 text-amber-300 border border-amber-700/40 text-[11px] font-medium">
                  Node.js 6 -&gt; 20
                </span>
                <h3 className="text-sm font-semibold text-white">
                  Outdated Node Webhook
                </h3>
                <p className="text-xs text-slate-400">
                  Replaces unsafe Buffer constructors and deprecated packages.
                </p>
              </div>
              <span className="text-xs font-medium text-purple-300 group-hover:text-purple-200 inline-flex items-center gap-1">
                Open sample <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </Link>

            <Link
              href="/lab?mode=github"
              className="group rounded-xl border border-slate-800 bg-[#070b14] hover:border-cyan-500/60 p-4 flex flex-col justify-between gap-3 transition-colors"
            >
              <div className="space-y-1.5">
                <span className="inline-block px-2 py-0.5 rounded bg-cyan-950/60 text-cyan-300 border border-cyan-700/40 text-[11px] font-medium">
                  GitHub / .ZIP
                </span>
                <h3 className="text-sm font-semibold text-white inline-flex items-center gap-1.5">
                  <FolderGit2 className="w-4 h-4 text-cyan-400" />
                  Your Own Repository
                </h3>
                <p className="text-xs text-slate-400">
                  Analyze and test any public Python, JavaScript, or TypeScript project.
                </p>
              </div>
              <span className="text-xs font-medium text-cyan-300 group-hover:text-cyan-200 inline-flex items-center gap-1">
                Load repository <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </Link>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="my-10 rounded-2xl border border-purple-500/30 bg-gradient-to-r from-[#0c1122] via-[#090d1a] to-[#081520] p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-lg sm:text-xl font-bold text-white">
              Ready to rescue broken code?
            </h2>
            <p className="text-xs sm:text-sm text-slate-300">
              Launch the workspace in one click—no account or setup required.
            </p>
          </div>
          <Link
            href="/lab"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-purple-600 hover:bg-purple-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors shrink-0"
          >
            Open Interactive Workspace
            <ArrowRight className="w-4 h-4" />
          </Link>
        </section>
      </main>

      <footer className="border-t border-slate-800/80 bg-[#06080e] py-5 px-4 sm:px-6 text-xs text-slate-400">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <span className="text-slate-300 font-medium">NecroCode</span>
          <div className="flex items-center gap-4">
            <Link href="/lab" className="hover:text-white">
              Workspace
            </Link>
            <Link href="/dashboard" className="hover:text-white">
              System Status
            </Link>
            <Link href="/docs" className="hover:text-white">
              Guide &amp; API
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

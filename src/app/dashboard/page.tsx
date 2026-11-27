"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  BookOpen,
  Cpu,
  Database,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { PRESET_PATIENTS } from "@/lib/necro-engine/patients";

interface HealthPayload {
  status: string;
  timestamp: string;
  version: string;
  environment: string;
  integrations: {
    database: string;
    ai: string;
    github: string;
    sandbox: string;
    runtimes?: string[];
  };
}

function formatDatabaseStatus(val?: string) {
  if (val === "connected_serverless") {
    return {
      title: "Connected (Neon Postgres)",
      detail: "Autopsy reports and job telemetry are persisted to serverless Postgres.",
      tone: "text-emerald-300",
    };
  }
  return {
    title: "Temporary Memory",
    detail: "Running without an external database; data stays in memory for this session.",
    tone: "text-amber-300",
  };
}

function formatAiStatus(val?: string) {
  if (val === "live_gemini_configured") {
    return {
      title: "Gemini AI Ready",
      detail: "Uses Google Gemini alongside deterministic syntax checks for repairs.",
      tone: "text-emerald-300",
    };
  }
  return {
    title: "Built-in Rules Mode",
    detail: "No Gemini API key detected — using fast offline AST and compiler repair rules.",
    tone: "text-cyan-300",
  };
}

function formatSandboxStatus(val?: string) {
  if (val === "isolated_worker_configured") {
    return {
      title: "Isolated Sandbox Ready",
      detail: "Approved code runs offline inside an isolated Docker or macOS Seatbelt worker.",
      tone: "text-emerald-300",
    };
  }
  return {
    title: "Local / Safe Fail-Closed",
    detail: "Remote sandbox worker URL not set; uses safe local isolation or blocks if unavailable.",
    tone: "text-amber-300",
  };
}

export default function DashboardPage() {
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const loadHealth = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/health");
      if (res.ok) {
        setHealth((await res.json()) as HealthPayload);
      }
    } catch {
      // Keep graceful empty state
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadHealth();
  }, []);

  const dbInfo = formatDatabaseStatus(health?.integrations.database);
  const aiInfo = formatAiStatus(health?.integrations.ai);
  const sandboxInfo = formatSandboxStatus(health?.integrations.sandbox);

  return (
    <div className="min-h-screen bg-[#05070d] text-slate-100">
      <header className="border-b border-slate-800/80 bg-[#070b14]/90 backdrop-blur-md px-4 sm:px-6 py-3">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
              <Image
                src="/logo.png"
                alt="PatchPulse logo"
                width={28}
                height={28}
                className="rounded-md"
              />
            </Link>
            <Link
              href="/lab"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-slate-700"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Workspace
            </Link>
            <h1 className="text-base font-semibold text-white">
              System Status
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadHealth}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 hover:text-white cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <Link
              href="/docs"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 hover:text-white"
            >
              <BookOpen className="w-3.5 h-3.5 text-purple-400" />
              Guide &amp; API
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-white">
            Service &amp; Sandbox Health
          </h2>
          <p className="text-sm text-slate-400">
            Live configuration for AI repair, storage, and isolated test execution.
          </p>
        </div>

        <section
          aria-label="Service status cards"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          <div className="rounded-xl border border-slate-800 bg-[#070b14] p-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>AI Repair Engine</span>
              <Sparkles className="w-4 h-4 text-purple-400" />
            </div>
            <div className={`text-sm font-semibold ${aiInfo.tone}`}>
              {loading ? "Checking..." : aiInfo.title}
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              {aiInfo.detail}
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-[#070b14] p-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Test Sandbox</span>
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <div className={`text-sm font-semibold ${sandboxInfo.tone}`}>
              {loading ? "Checking..." : sandboxInfo.title}
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              {sandboxInfo.detail}
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-[#070b14] p-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Storage</span>
              <Database className="w-4 h-4 text-cyan-400" />
            </div>
            <div className={`text-sm font-semibold ${dbInfo.tone}`}>
              {loading ? "Checking..." : dbInfo.title}
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              {dbInfo.detail}
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-[#070b14] p-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Supported Runtimes</span>
              <Cpu className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-sm font-semibold text-white">
              Python 3.12 • Node 20 • TS 5.9
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Syntax checking, type validation, and offline test execution across all 3 runtimes.
            </p>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-purple-400" />
                Included Sample Projects
              </h2>
              <p className="text-xs text-slate-400">
                Try these built-in legacy projects inside the main workspace.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {PRESET_PATIENTS.map((patient) => (
              <div
                key={patient.id}
                className="rounded-xl border border-slate-800 bg-[#070b14] p-4 flex flex-col justify-between gap-3"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300 font-medium capitalize">
                      {patient.language}
                    </span>
                    <span className="text-slate-400 font-mono">
                      {patient.deceasedYear}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-white">
                    {patient.name}
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {patient.tombstoneInscription}
                  </p>
                </div>

                <Link
                  href={`/lab?sample=${encodeURIComponent(patient.id)}`}
                  className="inline-flex items-center justify-center rounded-lg border border-purple-500/40 bg-purple-600/20 hover:bg-purple-600/30 px-3 py-1.5 text-xs font-medium text-purple-200 transition-colors"
                >
                  Open in Workspace
                </Link>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

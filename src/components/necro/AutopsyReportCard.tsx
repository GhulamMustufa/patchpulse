"use client";

import React, { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FlaskConical,
  ListChecks,
  ShieldCheck,
  Terminal,
  Wrench,
} from "lucide-react";
import { z } from "zod";
import { AutopsyReport, FatalError } from "@/lib/necro-engine/types";
import {
  SandboxWorkerResult,
  TypeScriptDiagnosticSchema,
} from "@/lib/necro-engine/schemas";

type TypeScriptDiagnostic = z.infer<typeof TypeScriptDiagnosticSchema>;

interface AutopsyReportCardProps {
  report: AutopsyReport;
  resurrectionSteps?: string[];
  tsDiagnostics?: TypeScriptDiagnostic[];
  sandboxJobResult?: SandboxWorkerResult | null;
  sandboxError?: string | null;
  sandboxDependencyStatus?: string;
  sandboxRuntimeInfo?: {
    language?: string;
    runtime?: string;
    framework?: string;
  } | null;
  verificationLogs?: string[];
  isRunningSandbox?: boolean;
}

const SEVERITY_META: Record<
  FatalError["severity"],
  { label: string; dotClass: string; badgeClass: string }
> = {
  FATAL: {
    label: "Critical",
    dotClass: "bg-rose-400",
    badgeClass: "bg-rose-950/60 text-rose-200 border-rose-500/40",
  },
  SECURITY_HAZARD: {
    label: "Security",
    dotClass: "bg-orange-400",
    badgeClass: "bg-orange-950/60 text-orange-200 border-orange-500/40",
  },
  DEPRECATED: {
    label: "Outdated",
    dotClass: "bg-amber-400",
    badgeClass: "bg-amber-950/60 text-amber-200 border-amber-500/40",
  },
  WARNING: {
    label: "Warning",
    dotClass: "bg-slate-400",
    badgeClass: "bg-slate-800 text-slate-300 border-slate-700",
  },
};

function humanizeCause(raw: string): string {
  if (raw.includes("Lethal Syntax Rot")) {
    return "Outdated Python 2 syntax (e.g., old print statements or imports) blocks Python 3 execution.";
  }
  if (raw.includes("Critical Dependency CVE Expiration")) {
    return "Old package versions or unsafe API patterns should be updated to modern releases.";
  }
  if (raw.includes("Unverified Syntax")) {
    return "Syntax or compiler errors prevent the code from running cleanly.";
  }
  return raw;
}

function humanizeDependencyStatus(status?: string): string {
  if (!status) return "Standard offline sandbox";
  if (status === "STDLIB_ONLY_READY") {
    return "Offline-safe (uses built-in language libraries only)";
  }
  if (status === "BLOCKED_UNSUPPORTED_DEPENDENCY") {
    return "Blocked: needs an unapproved third-party package";
  }
  if (status === "MANIFEST_NEEDS_INSTALL") {
    return "Note: third-party packages are not installed in offline sandbox";
  }
  return status;
}

function formatDriverName(driver?: string): string {
  if (driver === "docker") return "Docker Container (Offline)";
  if (driver === "seatbelt") return "macOS Seatbelt Sandbox (Offline)";
  if (driver === "unavailable") return "Sandbox Unavailable";
  return driver || "Isolated Worker";
}

export function AutopsyReportCard({
  report,
  resurrectionSteps,
  tsDiagnostics,
  sandboxJobResult,
  sandboxError,
  sandboxDependencyStatus,
  sandboxRuntimeInfo,
  verificationLogs,
  isRunningSandbox,
}: AutopsyReportCardProps) {
  const [activeTab, setActiveTab] = useState<"issues" | "tests" | "logs">(
    "issues"
  );
  const [expandedIssueKeys, setExpandedIssueKeys] = useState<
    Record<string, boolean>
  >({});

  const toggleIssue = (key: string) => {
    setExpandedIssueKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const healthColor =
    report.toxicityScore >= 60
      ? "text-rose-300"
      : report.toxicityScore >= 25
        ? "text-amber-300"
        : "text-emerald-300";

  const barColor =
    report.toxicityScore >= 60
      ? "bg-rose-500"
      : report.toxicityScore >= 25
        ? "bg-amber-500"
        : "bg-emerald-500";

  const activeSteps =
    resurrectionSteps && resurrectionSteps.length > 0
      ? resurrectionSteps
      : report.resurrectionPlan;

  return (
    <section
      aria-label="Diagnostics and test results"
      className="rounded-xl border border-slate-800 bg-[#070b14] overflow-hidden shadow-lg"
    >
      {/* Unified Summary & Tab Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 px-4 py-3 border-b border-slate-800 bg-[#0b101d]">
        <div
          role="tablist"
          aria-label="Diagnostic result sections"
          className="inline-flex rounded-lg bg-[#04070e] border border-slate-800 p-1 gap-1 self-start"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "issues"}
            onClick={() => setActiveTab("issues")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-colors ${
              activeTab === "issues"
                ? "bg-purple-600/25 text-purple-200 border border-purple-500/40"
                : "text-slate-400 hover:text-slate-200 border border-transparent"
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5" />
            Issues ({report.fatalErrors.length})
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "tests"}
            onClick={() => setActiveTab("tests")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-colors ${
              activeTab === "tests"
                ? "bg-emerald-600/25 text-emerald-200 border border-emerald-500/40"
                : "text-slate-400 hover:text-slate-200 border border-transparent"
            }`}
          >
            <FlaskConical className="w-3.5 h-3.5" />
            Test Results
            {report.testsTotal > 0 && (
              <span className="font-mono text-[11px] opacity-80">
                ({report.testsPassed}/{report.testsTotal})
              </span>
            )}
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "logs"}
            onClick={() => setActiveTab("logs")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-colors ${
              activeTab === "logs"
                ? "bg-cyan-600/25 text-cyan-200 border border-cyan-500/40"
                : "text-slate-400 hover:text-slate-200 border border-transparent"
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            Logs
            {verificationLogs && verificationLogs.length > 0 && (
              <span className="font-mono text-[11px] opacity-80">
                ({verificationLogs.length})
              </span>
            )}
          </button>
        </div>

        {/* Compact Risk Meter */}
        <div className="flex items-center gap-3 text-xs">
          <span className="text-slate-400">Code Risk:</span>
          <div className="w-28 h-2 rounded-full bg-slate-800 overflow-hidden">
            <div
              className={`h-full transition-all ${barColor}`}
              style={{ width: `${Math.min(100, Math.max(0, report.toxicityScore))}%` }}
            />
          </div>
          <span className={`font-mono font-semibold ${healthColor}`}>
            {report.toxicityScore}%
          </span>
        </div>
      </div>

      {/* TAB 1: ISSUES & CHANGES */}
      {activeTab === "issues" && (
        <div className="p-4 space-y-4">
          {/* Plain-English Summary */}
          <div className="rounded-lg border border-slate-800 bg-[#090e1a] px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="text-xs space-y-0.5">
              <span className="text-slate-400 font-medium uppercase tracking-wider text-[10px]">
                Main Finding
              </span>
              <p className="text-slate-200">
                {humanizeCause(report.primaryCauseOfDeath)}
              </p>
            </div>
            <span className="text-xs text-slate-400 shrink-0">
              Syntax valid:{" "}
              <strong
                className={
                  report.syntaxValid ? "text-emerald-300" : "text-rose-300"
                }
              >
                {report.syntaxValid ? "Yes" : "No"}
              </strong>
            </span>
          </div>

          {/* Collapsible Issue Rows */}
          {report.fatalErrors.length === 0 ? (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/20 px-4 py-3 text-xs text-emerald-200 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              No major issues detected in this file.
            </div>
          ) : (
            <div className="divide-y divide-slate-800 rounded-lg border border-slate-800 bg-[#090e1a] overflow-hidden">
              {report.fatalErrors.map((err, idx) => {
                const key = `${err.file || "file"}-${err.line}-${err.rule}-${idx}`;
                const expanded = Boolean(expandedIssueKeys[key]);
                const sev = SEVERITY_META[err.severity] ?? SEVERITY_META.WARNING;
                const isStatic = err.origin !== "ai_suggestion";

                return (
                  <div key={key} className="text-xs">
                    <button
                      type="button"
                      onClick={() => toggleIssue(key)}
                      aria-expanded={expanded}
                      className="w-full flex items-center justify-between gap-3 px-3.5 py-2.5 text-left hover:bg-slate-900/60 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {expanded ? (
                          <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        )}
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${sev.dotClass}`}
                        />
                        <span
                          className={`px-2 py-0.5 rounded border text-[10px] font-semibold shrink-0 ${sev.badgeClass}`}
                        >
                          {sev.label}
                        </span>
                        <span className="font-medium text-slate-100 truncate">
                          {err.rule}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[11px] text-slate-400 hidden sm:inline">
                          {isStatic ? "Confirmed" : "AI Tip"}
                        </span>
                        <span className="font-mono text-[11px] text-slate-400">
                          {err.file ? `${err.file}:${err.line}` : `Line ${err.line}`}
                        </span>
                      </div>
                    </button>

                    {expanded && (
                      <div className="px-4 pb-3 pt-1 space-y-2.5 bg-[#04070e]/70 border-t border-slate-800/70">
                        <p className="text-slate-300 leading-relaxed">
                          {err.diagnosis}
                        </p>
                        {err.recommendedRepair && (
                          <p className="text-emerald-300">
                            <span className="font-semibold">Fix:</span>{" "}
                            {err.recommendedRepair}
                          </p>
                        )}
                        {(err.legacySnippet || err.repairedSnippet) && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            <pre className="rounded border border-rose-500/20 bg-rose-950/20 p-2 font-mono text-[11px] text-rose-200 overflow-x-auto">
                              <code>- {err.legacySnippet}</code>
                            </pre>
                            <pre className="rounded border border-emerald-500/20 bg-emerald-950/20 p-2 font-mono text-[11px] text-emerald-200 overflow-x-auto">
                              <code>+ {err.repairedSnippet}</code>
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Changes Applied Summary */}
          {activeSteps.length > 0 && (
            <div className="rounded-lg border border-slate-800 bg-[#090e1a] p-3.5 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
                <Wrench className="w-3.5 h-3.5 text-purple-400" />
                <span>Fixes Applied ({activeSteps.length})</span>
              </div>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-1.5 text-xs text-slate-300">
                {activeSteps.map((step, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <ListChecks className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{step}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: TEST RESULTS */}
      {activeTab === "tests" && (
        <div className="p-4 space-y-3 text-xs">
          {/* Sandbox Status Row */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 bg-[#090e1a] px-3.5 py-2.5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="text-slate-200 font-medium">
                {isRunningSandbox
                  ? "Running tests inside isolated sandbox..."
                  : sandboxJobResult
                    ? `Sandbox run finished in ${sandboxJobResult.durationMs}ms (Exit ${sandboxJobResult.exitCode})`
                    : "Tests have not been executed in the sandbox yet."}
              </span>
            </div>
            <span className="text-slate-400">
              {sandboxJobResult
                ? formatDriverName(sandboxJobResult.driver)
                : sandboxRuntimeInfo?.runtime
                  ? `${sandboxRuntimeInfo.runtime} • ${humanizeDependencyStatus(sandboxDependencyStatus)}`
                  : humanizeDependencyStatus(sandboxDependencyStatus)}
            </span>
          </div>

          {sandboxError && (
            <div
              role="alert"
              className="rounded-lg border border-orange-500/40 bg-orange-950/30 px-3.5 py-2.5 text-orange-200"
            >
              <strong>Tests Blocked:</strong> {sandboxError}
            </div>
          )}

          {report.executionResults.length === 0 ? (
            <p className="text-slate-400 px-1">
              Click <strong className="text-slate-200">Fix Code</strong>, approve
              the changes, and click{" "}
              <strong className="text-slate-200">Run Tests</strong> to verify
              behavior inside an offline sandbox.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-800">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#090e1a] border-b border-slate-800 text-[11px] uppercase text-slate-400">
                    <th className="py-2 px-3">Test</th>
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 px-3">Time</th>
                    <th className="py-2 px-3">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 bg-[#04070e]">
                  {report.executionResults.map((res, idx) => {
                    const statusBadge =
                      res.resurrectedResult === "PASS"
                        ? "bg-emerald-950/60 text-emerald-300 border-emerald-500/40"
                        : res.resurrectedResult === "PENDING_SANDBOX"
                          ? "bg-cyan-950/60 text-cyan-300 border-cyan-500/40"
                          : res.resurrectedResult === "SKIPPED"
                            ? "bg-slate-800 text-slate-300 border-slate-700"
                            : "bg-rose-950/60 text-rose-300 border-rose-500/40";
                    const friendlyResult =
                      res.resurrectedResult === "PASS"
                        ? "Passed"
                        : res.resurrectedResult === "PENDING_SANDBOX"
                          ? "Not Run"
                          : res.resurrectedResult === "SKIPPED"
                            ? "Skipped"
                            : "Failed";

                    return (
                      <tr key={idx}>
                        <td className="py-2.5 px-3 font-mono text-slate-200">
                          {res.name}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded border text-[11px] font-medium ${statusBadge}`}
                          >
                            {friendlyResult}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-400">
                          {res.latencyMs}ms
                        </td>
                        <td className="py-2.5 px-3 text-slate-300">
                          {res.details || res.description}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {sandboxJobResult &&
            (sandboxJobResult.stdout || sandboxJobResult.stderr) && (
              <details className="rounded-lg border border-slate-800 bg-[#090e1a] p-3">
                <summary className="cursor-pointer font-medium text-slate-300">
                  View raw sandbox terminal output
                </summary>
                <pre className="mt-2 max-h-48 overflow-auto rounded bg-[#04070e] p-3 font-mono text-[11px] text-slate-300 whitespace-pre-wrap">
                  {[sandboxJobResult.stdout, sandboxJobResult.stderr]
                    .filter(Boolean)
                    .join("\n---\n")}
                </pre>
              </details>
            )}
        </div>
      )}

      {/* TAB 3: LOGS & COMPILER DETAILS */}
      {activeTab === "logs" && (
        <div className="p-4 space-y-3 text-xs">
          {tsDiagnostics && tsDiagnostics.length > 0 && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-3 space-y-1.5">
              <div className="font-semibold text-amber-200">
                TypeScript Compiler Checks ({tsDiagnostics.length})
              </div>
              <ul className="space-y-1 font-mono text-[11px] text-amber-100">
                {tsDiagnostics.map((d, idx) => (
                  <li key={idx}>
                    {d.file}:{d.line}:{d.column} [{d.code}] {d.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="rounded-lg border border-slate-800 bg-[#04070e] p-3 font-mono text-[11px] text-slate-300 max-h-60 overflow-auto space-y-1">
            {verificationLogs && verificationLogs.length > 0 ? (
              verificationLogs.map((log, i) => <div key={i}>{log}</div>)
            ) : (
              <div className="text-slate-500">
                No execution logs yet. Click Fix Code to begin.
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

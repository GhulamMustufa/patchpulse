"use client";

import React from "react";
import { AutopsyReport } from "@/lib/necro-engine/types";
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  Flame,
  FileCheck2,
  Stethoscope,
  Clock,
  Info,
} from "lucide-react";

interface AutopsyReportCardProps {
  report: AutopsyReport;
  isResurrected: boolean;
  isPresetDemo?: boolean;
}

export function AutopsyReportCard({
  report,
  isResurrected,
  isPresetDemo = false,
}: AutopsyReportCardProps) {
  const results = report.executionResults ?? [];
  const passedCount = isResurrected
    ? results.filter((r) => r.resurrectedResult === "PASS").length
    : 0;
  const pendingCount = isResurrected
    ? results.filter((r) => r.resurrectedResult === "PENDING_SANDBOX").length
    : 0;
  const failedCount = isResurrected
    ? results.filter((r) => r.resurrectedResult === "FAIL").length
    : 0;

  return (
    <div className="space-y-6 rounded-xl border border-slate-800 bg-[#070b14] p-5 shadow-2xl">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-950/50 border border-purple-800/60 text-purple-300">
            <Stethoscope className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-100 flex flex-wrap items-center gap-2">
              Forensic Pathology &amp; Autopsy Findings
              {isPresetDemo && (
                <span className="rounded bg-amber-500/15 border border-amber-500/40 px-2 py-0.5 text-[10px] font-mono text-amber-300">
                  PRESET DEMO SUBJECT
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-400">
              Deterministic static analysis &amp; verification telemetry (no fabricated test runs)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-slate-900/80 px-3 py-2 rounded-lg border border-slate-800">
          <div>
            <div className="flex items-center justify-between gap-3 text-xs font-mono mb-1">
              <span className="text-slate-400 flex items-center gap-1">
                <Flame className="h-3 w-3 text-rose-500" />
                Codebase Toxicity:
              </span>
              <span
                className={`font-bold ${
                  report.toxicityScore === 0
                    ? "text-emerald-400"
                    : report.toxicityScore >= 60
                    ? "text-rose-400"
                    : "text-amber-400"
                }`}
              >
                {report.toxicityScore}%
              </span>
            </div>
            <div className="h-2 w-32 overflow-hidden rounded-full bg-slate-800">
              <div
                className={`h-full transition-all duration-500 ${
                  report.toxicityScore === 0
                    ? "bg-emerald-500"
                    : "bg-gradient-to-r from-amber-500 to-rose-600"
                }`}
                style={{ width: `${report.toxicityScore}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Cause of Death / Health Summary */}
      <div
        className={`rounded-lg border p-3.5 ${
          report.fatalErrors.length === 0
            ? "border-emerald-900/60 bg-emerald-950/20"
            : "border-rose-900/60 bg-rose-950/30"
        }`}
      >
        <div className="flex items-start gap-3">
          {report.fatalErrors.length === 0 ? (
            <Info className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <ShieldAlert className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
          )}
          <div>
            <span
              className={`text-xs font-mono font-semibold uppercase tracking-wider ${
                report.fatalErrors.length === 0 ? "text-emerald-300" : "text-rose-300"
              }`}
            >
              {report.fatalErrors.length === 0
                ? "Diagnostic Summary:"
                : "Primary Fatal Pathology:"}
            </span>
            <p className="text-sm font-medium text-slate-200 mt-0.5">
              {report.primaryCauseOfDeath}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {report.fatalErrors.length === 0
                ? "Static pattern scan found 0 confirmed fatal legacy patterns in this snippet."
                : `Subject target (${report.language}, circa ${report.deceasedYear}) contains confirmed breaking patterns on modern runtimes.`}
            </p>
          </div>
        </div>
      </div>

      {/* Identified Findings */}
      <div>
        <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
          Diagnostic Findings ({report.fatalErrors.length} Detected)
        </h3>

        {report.fatalErrors.length === 0 ? (
          <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 text-xs font-mono text-slate-400">
            No confirmed legacy syntax or deprecated library findings detected in this source.
          </div>
        ) : (
          <div className="space-y-2.5">
            {report.fatalErrors.map((err, idx) => (
              <div
                key={`${err.rule}-${err.line}-${idx}`}
                className="rounded-lg border border-slate-800/80 bg-slate-900/50 p-3 text-xs font-mono space-y-1.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex flex-wrap items-center gap-2">
                    {err.file && (
                      <span className="text-cyan-400">{err.file}</span>
                    )}
                    <span className="text-slate-500">Line {err.line}:</span>
                    <span className="font-semibold text-rose-400">{err.rule}</span>
                    <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300">
                      {err.origin === "ai_suggestion" ? "AI SUGGESTION" : "CONFIRMED"}
                    </span>
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      err.severity === "FATAL" || err.severity === "SECURITY_HAZARD"
                        ? "bg-rose-900/50 text-rose-300 border border-rose-800"
                        : "bg-amber-900/50 text-amber-300 border border-amber-800"
                    }`}
                  >
                    {err.severity}
                  </span>
                </div>

                <p className="text-slate-300 font-sans text-xs">{err.diagnosis}</p>
                {err.recommendedRepair && (
                  <p className="text-slate-400 font-sans text-[11px]">
                    Recommended repair: {err.recommendedRepair}
                  </p>
                )}

                <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 pt-1 border-t border-slate-800/60">
                  <div className="rounded bg-rose-950/20 p-2 border border-rose-900/40">
                    <span className="text-[10px] text-rose-400 uppercase font-bold block mb-1">
                      Original Snippet:
                    </span>
                    <code className="text-rose-300 break-all">{err.legacySnippet}</code>
                  </div>
                  <div className="rounded bg-emerald-950/20 p-2 border border-emerald-900/40">
                    <span className="text-[10px] text-emerald-400 uppercase font-bold block mb-1">
                      Suggested Replacement:
                    </span>
                    <code className="text-emerald-300 break-all">{err.repairedSnippet}</code>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Verification Matrix */}
      <div className="border-t border-slate-800 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <FileCheck2 className="h-3.5 w-3.5 text-cyan-400" />
            Verification Checks Matrix (Syntax &amp; Static Analysis)
          </h3>
          <span className="text-xs font-mono text-slate-300">
            {!isResurrected
              ? `AWAITING REPAIR (${results.length} checks queued)`
              : `${passedCount} PASSED • ${pendingCount} SANDBOX PENDING • ${failedCount} FAILED`}
          </span>
        </div>

        {results.length === 0 ? (
          <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 text-xs font-mono text-slate-400">
            No verification checks available yet. Run repair to execute syntax and static validation.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full text-left font-mono text-xs">
              <thead className="border-b border-slate-800 bg-slate-900/90 text-slate-400">
                <tr>
                  <th className="p-2.5">Check / Test</th>
                  <th className="p-2.5">Details</th>
                  <th className="p-2.5">Pre-Repair</th>
                  <th className="p-2.5">Post-Repair Status</th>
                  <th className="p-2.5 text-right">Latency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-900/30">
                {results.map((item, idx) => (
                  <tr key={`${item.name}-${idx}`} className="hover:bg-slate-900/60 transition-colors">
                    <td className="p-2.5 font-semibold text-slate-200">{item.name}</td>
                    <td className="p-2.5 text-slate-400 text-[11px] font-sans">
                      {isResurrected ? item.details : item.description}
                    </td>
                    <td className="p-2.5">
                      <span className="inline-flex items-center gap-1 rounded bg-rose-950/40 border border-rose-900/60 px-1.5 py-0.5 text-[10px] text-rose-400 font-bold">
                        <XCircle className="h-3 w-3" />
                        {item.legacyResult}
                      </span>
                    </td>
                    <td className="p-2.5">
                      {!isResurrected ? (
                        <span className="text-slate-500 text-[10px]">AWAITING REPAIR</span>
                      ) : item.resurrectedResult === "PASS" ? (
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-950/40 border border-emerald-900/60 px-1.5 py-0.5 text-[10px] text-emerald-400 font-bold">
                          <CheckCircle2 className="h-3 w-3" />
                          SYNTAX / STATIC PASS
                        </span>
                      ) : item.resurrectedResult === "PENDING_SANDBOX" ? (
                        <span className="inline-flex items-center gap-1 rounded bg-amber-950/40 border border-amber-900/60 px-1.5 py-0.5 text-[10px] text-amber-300 font-bold">
                          <Clock className="h-3 w-3" />
                          SANDBOX PENDING (PHASE 3)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded bg-rose-950/40 border border-rose-900/60 px-1.5 py-0.5 text-[10px] text-rose-400 font-bold">
                          <XCircle className="h-3 w-3" />
                          FAIL
                        </span>
                      )}
                    </td>
                    <td className="p-2.5 text-right text-slate-400">
                      {item.latencyMs > 0 ? `${item.latencyMs}ms` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

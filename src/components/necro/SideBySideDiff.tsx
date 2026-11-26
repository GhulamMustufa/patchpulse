"use client";

import React, { useState } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Columns2,
  Copy,
  Download,
  FileDiff,
  Loader2,
  Play,
  Sparkles,
} from "lucide-react";
import { LanguageType, VerificationStatus } from "@/lib/necro-engine/types";

interface SideBySideDiffProps {
  deadCode: string;
  resurrectedCode: string;
  unifiedDiff?: string;
  activeFilePath?: string;
  language: LanguageType;
  isResurrecting: boolean;
  isResurrected: boolean;
  onResurrect: () => void;
  warnings?: string[];
  verificationStatus?: VerificationStatus;
  repairSourceLabel?: string;
  isCustomMode?: boolean;
  onCustomCodeChange?: (code: string) => void;
  isApproved?: boolean;
  onApproveChanges?: () => void;
  onResetApproval?: () => void;
  onRunSandboxTests?: () => void;
  isRunningSandbox?: boolean;
  canRunSandbox?: boolean;
}

function getFriendlyStatus(
  verificationStatus?: VerificationStatus,
  isResurrected?: boolean
): { label: string; badgeClass: string } {
  if (verificationStatus === "PASSED") {
    return {
      label: "All Tests Passed",
      badgeClass: "bg-emerald-950/60 text-emerald-300 border-emerald-500/40",
    };
  }
  if (verificationStatus === "PARTIAL") {
    return {
      label: "Some Tests Failed",
      badgeClass: "bg-amber-950/60 text-amber-300 border-amber-500/40",
    };
  }
  if (verificationStatus === "FAILED") {
    return {
      label: "Tests Failed",
      badgeClass: "bg-rose-950/60 text-rose-300 border-rose-500/40",
    };
  }
  if (verificationStatus === "VERIFICATION_BLOCKED") {
    return {
      label: "Tests Blocked",
      badgeClass: "bg-orange-950/60 text-orange-300 border-orange-500/40",
    };
  }
  if (verificationStatus === "NO_TESTS_FOUND") {
    return {
      label: "Syntax OK • No Tests",
      badgeClass: "bg-cyan-950/60 text-cyan-300 border-cyan-500/40",
    };
  }
  if (verificationStatus === "SYNTAX_PASSED_SANDBOX_PENDING" || isResurrected) {
    return {
      label: "Syntax OK • Ready to Test",
      badgeClass: "bg-cyan-950/60 text-cyan-300 border-cyan-500/40",
    };
  }
  return {
    label: "Needs Repair",
    badgeClass: "bg-slate-900 text-slate-300 border-slate-700",
  };
}

function formatRepairSource(raw?: string): string | null {
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (lower.includes("gemini") || lower.includes("hybrid")) {
    return "Gemini AI + Rules";
  }
  if (lower.includes("ast") || lower.includes("fallback") || lower.includes("deterministic")) {
    return "Built-in Rules";
  }
  return raw;
}

export function SideBySideDiff({
  deadCode,
  resurrectedCode,
  unifiedDiff,
  activeFilePath,
  language,
  isResurrecting,
  isResurrected,
  onResurrect,
  warnings,
  verificationStatus,
  repairSourceLabel,
  isCustomMode,
  onCustomCodeChange,
  isApproved,
  onApproveChanges,
  onResetApproval,
  onRunSandboxTests,
  isRunningSandbox,
  canRunSandbox,
}: SideBySideDiffProps) {
  const [copied, setCopied] = useState<"code" | "patch" | null>(null);
  const [viewMode, setViewMode] = useState<"split" | "diff">("split");

  const statusMeta = getFriendlyStatus(verificationStatus, isResurrected);
  const friendlyEngine = formatRepairSource(repairSourceLabel);

  const handleCopyCode = async () => {
    const content = resurrectedCode || deadCode;
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      setCopied("code");
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Clipboard blocked in restricted browser contexts
    }
  };

  const handleCopyPatch = async () => {
    if (!unifiedDiff) return;
    try {
      await navigator.clipboard.writeText(unifiedDiff);
      setCopied("patch");
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Clipboard blocked
    }
  };

  const handleDownload = () => {
    const content = resurrectedCode || deadCode;
    if (!content) return;
    const ext =
      language === "python" ? "py" : language === "typescript" ? "ts" : "js";
    const filename =
      activeFilePath?.split("/").pop() || `fixed-code.${ext}`;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const defaultFileLabel =
    activeFilePath ||
    (language === "python"
      ? "main.py"
      : language === "typescript"
        ? "index.ts"
        : "index.js");

  return (
    <section
      aria-label="Code editor and repair diff"
      className="rounded-xl border border-slate-800 bg-[#070b14] overflow-hidden shadow-lg"
    >
      {/* Streamlined Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-slate-800 bg-[#0b101d]">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="text-xs font-mono font-medium text-slate-200 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-md">
            {defaultFileLabel}
          </span>
          <span
            className={`px-2.5 py-0.5 rounded-full border text-xs font-medium ${statusMeta.badgeClass}`}
          >
            {statusMeta.label}
          </span>
          {friendlyEngine && (
            <span className="text-xs text-slate-400 hidden sm:inline">
              via {friendlyEngine}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Split / Diff segmented control */}
          <div
            role="group"
            aria-label="Code view mode"
            className="inline-flex rounded-lg border border-slate-800 bg-[#04070e] p-0.5"
          >
            <button
              type="button"
              onClick={() => setViewMode("split")}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors ${
                viewMode === "split"
                  ? "bg-slate-800 text-white"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Columns2 className="w-3.5 h-3.5" />
              Split
            </button>
            <button
              type="button"
              onClick={() => setViewMode("diff")}
              disabled={!unifiedDiff}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors disabled:opacity-40 ${
                viewMode === "diff"
                  ? "bg-slate-800 text-white"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <FileDiff className="w-3.5 h-3.5" />
              Diff
            </button>
          </div>

          {/* Copy & Download */}
          {viewMode === "diff" && unifiedDiff && (
            <button
              type="button"
              onClick={handleCopyPatch}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs text-slate-200 cursor-pointer"
            >
              {copied === "patch" ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-slate-400" />
              )}
              {copied === "patch" ? "Copied" : "Copy Diff"}
            </button>
          )}

          <button
            type="button"
            onClick={handleCopyCode}
            aria-label="Copy code"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs text-slate-200 cursor-pointer"
          >
            {copied === "code" ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-slate-400" />
            )}
            <span>{copied === "code" ? "Copied" : "Copy"}</span>
          </button>

          <button
            type="button"
            onClick={handleDownload}
            aria-label="Download fixed file"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs text-slate-200 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">Download</span>
          </button>

          {/* Step 1: Fix Code */}
          <button
            type="button"
            onClick={onResurrect}
            disabled={isResurrecting}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-xs font-semibold text-white transition-colors cursor-pointer"
          >
            {isResurrecting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            {isResurrecting
              ? "Fixing..."
              : isResurrected
                ? "Re-run Fix"
                : "Fix Code"}
          </button>

          {/* Step 2 & 3: Approve + Run Tests */}
          {resurrectedCode && onApproveChanges && onResetApproval && (
            <button
              type="button"
              onClick={isApproved ? onResetApproval : onApproveChanges}
              aria-pressed={Boolean(isApproved)}
              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition-colors ${
                isApproved
                  ? "bg-emerald-950/60 text-emerald-200 border-emerald-500/50"
                  : "bg-slate-900 text-slate-300 border-slate-700 hover:border-slate-500"
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              {isApproved ? "Approved" : "Approve Fix"}
            </button>
          )}

          {resurrectedCode && onRunSandboxTests && (
            <button
              type="button"
              onClick={onRunSandboxTests}
              disabled={!canRunSandbox || isRunningSandbox}
              title={
                !isApproved
                  ? "Approve the proposed changes first to run tests"
                  : "Run tests inside an isolated sandbox"
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-45 text-xs font-semibold text-white transition-colors cursor-pointer"
            >
              {isRunningSandbox ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5" />
              )}
              {isRunningSandbox ? "Testing..." : "Run Tests"}
            </button>
          )}
        </div>
      </div>

      {/* Inline Warnings if any */}
      {warnings && warnings.length > 0 && (
        <div className="px-4 py-2 bg-amber-950/30 border-b border-amber-500/20 flex items-center gap-2 text-xs text-amber-200">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>{warnings[0]}</span>
        </div>
      )}

      {/* Editor / Diff Body */}
      {viewMode === "split" ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-800">
          {/* Original Code */}
          <div className="flex flex-col min-w-0">
            <div className="flex items-center justify-between px-4 py-2 bg-[#090e1a] border-b border-slate-800/80 text-xs">
              <span className="font-medium text-slate-300">Original Code</span>
              {isCustomMode && (
                <span className="text-[11px] text-purple-300">Editable</span>
              )}
            </div>
            {isCustomMode && onCustomCodeChange ? (
              <textarea
                value={deadCode}
                onChange={(e) => onCustomCodeChange(e.target.value)}
                aria-label="Original source code input"
                spellCheck={false}
                className="w-full h-80 bg-[#04070e] p-4 font-mono text-xs text-slate-200 leading-relaxed focus:outline-none resize-y"
              />
            ) : (
              <pre className="h-80 overflow-auto bg-[#04070e] p-4 font-mono text-xs text-slate-300 leading-relaxed">
                <code>{deadCode}</code>
              </pre>
            )}
          </div>

          {/* Fixed Code */}
          <div className="flex flex-col min-w-0">
            <div className="flex items-center justify-between px-4 py-2 bg-[#090e1a] border-b border-slate-800/80 text-xs">
              <span className="font-medium text-emerald-300">Fixed Code</span>
              {!resurrectedCode && (
                <span className="text-[11px] text-slate-500">
                  Waiting for Fix Code
                </span>
              )}
            </div>
            {resurrectedCode ? (
              <pre className="h-80 overflow-auto bg-[#04070e] p-4 font-mono text-xs text-emerald-100 leading-relaxed">
                <code>{resurrectedCode}</code>
              </pre>
            ) : (
              <div className="h-80 flex flex-col items-center justify-center bg-[#04070e] px-6 text-center text-xs text-slate-400 space-y-2">
                <Sparkles className="w-6 h-6 text-purple-400/70" />
                <p>
                  Click <strong className="text-slate-200">Fix Code</strong>{" "}
                  above to diagnose issues and generate updated code.
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-[#04070e] h-80 overflow-auto p-4 font-mono text-xs leading-relaxed">
          {unifiedDiff ? (
            unifiedDiff.split("\n").map((line, idx) => {
              const colorClass = line.startsWith("+") && !line.startsWith("+++")
                ? "bg-emerald-950/40 text-emerald-200"
                : line.startsWith("-") && !line.startsWith("---")
                  ? "bg-rose-950/40 text-rose-200"
                  : line.startsWith("@@")
                    ? "text-cyan-300"
                    : "text-slate-400";
              return (
                <div key={idx} className={`px-2 whitespace-pre ${colorClass}`}>
                  {line || " "}
                </div>
              );
            })
          ) : (
            <p className="text-slate-400">
              No diff available yet. Run Fix Code first.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

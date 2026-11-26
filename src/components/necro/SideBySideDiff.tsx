"use client";

import React, { useState } from "react";
import { VerificationStatus } from "@/lib/necro-engine/types";
import { useToast } from "@/components/ui/Toast";
import {
  Zap,
  Copy,
  Check,
  Download,
  FileCode2,
  Sparkles,
  Terminal,
  AlertTriangle,
  ShieldCheck,
  GitCompare,
} from "lucide-react";

interface SideBySideDiffProps {
  deadCode: string;
  resurrectedCode: string;
  unifiedDiff?: string;
  activeFilePath?: string;
  language: string;
  isResurrecting: boolean;
  isResurrected: boolean;
  onResurrect: () => void;
  resurrectionSteps: string[];
  warnings?: string[];
  verificationStatus?: VerificationStatus;
  repairSourceLabel?: string;
  isCustomMode: boolean;
  onCustomCodeChange: (code: string) => void;
  isApproved?: boolean;
  onApproveChanges?: () => void;
  onResetApproval?: () => void;
  onRunSandboxTests?: () => void;
  isRunningSandbox?: boolean;
  canRunSandbox?: boolean;
}

export function SideBySideDiff({
  deadCode,
  resurrectedCode,
  unifiedDiff = "",
  activeFilePath,
  language,
  isResurrecting,
  isResurrected,
  onResurrect,
  resurrectionSteps,
  warnings = [],
  verificationStatus = "UNVERIFIED",
  repairSourceLabel,
  isCustomMode,
  onCustomCodeChange,
  isApproved = false,
  onApproveChanges,
  onResetApproval,
  onRunSandboxTests,
  isRunningSandbox = false,
  canRunSandbox = false,
}: SideBySideDiffProps) {
  const [copied, setCopied] = useState<"code" | "patch" | null>(null);
  const [viewMode, setViewMode] = useState<"split" | "diff">("split");
  const { toast } = useToast();

  const handleCopy = async () => {
    const target = isResurrected && resurrectedCode ? resurrectedCode : deadCode;
    await navigator.clipboard.writeText(target);
    setCopied("code");
    toast({
      title: isResurrected ? "Copied repaired code" : "Copied original code",
      description: isResurrected
        ? "Repaired artifact copied to clipboard."
        : "Original source copied (run repair first to copy modernized code).",
      type: "info",
    });
    setTimeout(() => setCopied(null), 2000);
  };

  const handleCopyPatch = async () => {
    if (!unifiedDiff) return;
    await navigator.clipboard.writeText(unifiedDiff);
    setCopied("patch");
    toast({
      title: "Copied unified diff",
      description: `Patch for ${activeFilePath || "artifact"} copied to clipboard.`,
      type: "success",
    });
    setTimeout(() => setCopied(null), 2000);
  };

  const handleDownload = () => {
    if (!isResurrected || !resurrectedCode) return;
    const ext =
      language === "python" ? "py" : language === "typescript" ? "ts" : "js";
    const fileName = activeFilePath
      ? activeFilePath.split("/").pop() || `resurrected_artifact.${ext}`
      : `resurrected_artifact.${ext}`;
    const blob = new Blob([resurrectedCode], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({
      title: "Artifact downloaded",
      description: `Saved ${fileName}`,
      type: "success",
    });
  };

  const isFailed = verificationStatus === "FAILED";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-[#070b14] p-3 shadow-lg">
        <div className="flex flex-wrap items-center gap-2">
          <Terminal className="h-4 w-4 text-purple-400" />
          <span className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-300">
            Resurrection Operating Theatre
          </span>
          {activeFilePath && (
            <span className="rounded bg-cyan-950/60 border border-cyan-800/60 px-2 py-0.5 text-[10px] font-mono text-cyan-200">
              {activeFilePath}
            </span>
          )}
          <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-mono text-slate-300">
            Target: {language.toUpperCase()}
          </span>
          {repairSourceLabel && isResurrected && (
            <span className="rounded bg-purple-950/60 border border-purple-700/50 px-2 py-0.5 text-[10px] font-mono text-purple-200">
              {repairSourceLabel}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onResurrect}
            disabled={isResurrecting || !deadCode.trim()}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
              isResurrecting
                ? "bg-amber-600 text-amber-100 cursor-wait"
                : isFailed
                ? "bg-rose-600 hover:bg-rose-500 text-white"
                : isResurrected
                ? "bg-cyan-600 hover:bg-cyan-500 text-white"
                : "bg-purple-600 hover:bg-purple-500 text-white"
            }`}
          >
            <Zap className={`h-4 w-4 ${isResurrecting ? "animate-spin" : ""}`} />
            {isResurrecting
              ? "Diagnosing & Repairing..."
              : isResurrected
              ? "Re-Run Repair"
              : "Diagnose & Repair"}
          </button>

          {isResurrected && unifiedDiff && (
            <button
              type="button"
              onClick={() => setViewMode(viewMode === "split" ? "diff" : "split")}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs font-mono text-slate-200 hover:bg-slate-800 transition-colors"
            >
              <GitCompare className="h-3.5 w-3.5 text-cyan-400" />
              {viewMode === "split" ? "Unified Diff" : "Split View"}
            </button>
          )}

          {isResurrected && onApproveChanges && !isFailed && (
            <button
              type="button"
              onClick={isApproved ? onResetApproval : onApproveChanges}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-mono transition-colors ${
                isApproved
                  ? "border-emerald-500/70 bg-emerald-950/50 text-emerald-300"
                  : "border-slate-700 bg-slate-900/80 text-slate-200 hover:border-emerald-500/50"
              }`}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              {isApproved ? "Patch Approved" : "Approve Patch"}
            </button>
          )}

          {isResurrected && canRunSandbox && onRunSandboxTests && (
            <button
              type="button"
              onClick={onRunSandboxTests}
              disabled={isRunningSandbox}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 px-3 py-2 text-xs font-mono font-bold text-white transition-colors"
            >
              <Terminal className={`h-3.5 w-3.5 ${isRunningSandbox ? "animate-spin" : ""}`} />
              {isRunningSandbox ? "Running Sandbox..." : "Run Sandbox Tests"}
            </button>
          )}

          {isResurrected && unifiedDiff && (
            <button
              type="button"
              onClick={handleCopyPatch}
              className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2 text-xs font-mono text-slate-300 hover:border-slate-700 hover:bg-slate-800 transition-colors"
            >
              {copied === "patch" ? (
                <Check className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {copied === "patch" ? "Patch Copied" : "Copy Patch"}
            </button>
          )}

          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2 text-xs font-mono text-slate-300 hover:border-slate-700 hover:bg-slate-800 transition-colors"
          >
            {copied === "code" ? (
              <Check className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            {copied === "code"
              ? "Copied!"
              : isResurrected
              ? "Copy Repaired"
              : "Copy Source"}
          </button>

          <button
            type="button"
            onClick={handleDownload}
            disabled={!isResurrected || !resurrectedCode}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-mono transition-colors ${
              isResurrected && resurrectedCode
                ? "border-slate-800 bg-slate-900/80 text-slate-300 hover:border-slate-700 hover:bg-slate-800"
                : "border-slate-800/40 bg-slate-950/40 text-slate-600 cursor-not-allowed"
            }`}
          >
            <Download className="h-3.5 w-3.5" />
            Download
          </button>
        </div>
      </div>

      {viewMode === "diff" && isResurrected && unifiedDiff ? (
        <div className="overflow-hidden rounded-xl border border-slate-800 bg-[#06080e] p-4 font-mono text-xs shadow-xl">
          <div className="text-slate-400 mb-2 pb-2 border-b border-slate-800">
            Unified Patch Review ({activeFilePath || "artifact"})
          </div>
          <pre className="overflow-x-auto leading-relaxed max-h-[500px]">
            {unifiedDiff.split("\n").map((line, idx) => (
              <div
                key={idx}
                className={
                  line.startsWith("+") && !line.startsWith("+++")
                    ? "bg-emerald-950/40 text-emerald-300 px-2"
                    : line.startsWith("-") && !line.startsWith("---")
                    ? "bg-rose-950/40 text-rose-300 px-2"
                    : line.startsWith("@@")
                    ? "text-cyan-400 px-2"
                    : "text-slate-400 px-2"
                }
              >
                {line}
              </div>
            ))}
          </pre>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="overflow-hidden rounded-xl border border-rose-900/60 bg-[#090b10] shadow-xl">
            <div className="flex items-center justify-between border-b border-rose-950/80 bg-rose-950/30 px-4 py-2.5">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-500/80" />
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-rose-300">
                  Original Source (Preserved)
                </span>
              </div>
              <span className="font-mono text-[10px] text-rose-400/80">
                {isCustomMode ? "Editable Input" : "Read-Only Snapshot"}
              </span>
            </div>

            <div className="relative p-3 font-mono text-xs">
              {isCustomMode ? (
                <textarea
                  value={deadCode}
                  onChange={(e) => onCustomCodeChange(e.target.value)}
                  rows={20}
                  aria-label="Custom legacy source code input"
                  className="w-full resize-y rounded-lg border border-slate-800 bg-[#06080e] p-3 text-rose-200 font-mono text-xs focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
                  placeholder="Paste legacy Python, JavaScript, or TypeScript code here..."
                />
              ) : (
                <pre className="overflow-x-auto rounded-lg bg-[#06080e] p-3 text-rose-200 leading-relaxed max-h-[500px]">
                  <code>{deadCode}</code>
                </pre>
              )}
            </div>
          </div>

          <div
            className={`overflow-hidden rounded-xl border transition-all duration-300 shadow-xl ${
              isFailed
                ? "border-rose-800/80 bg-[#120709]"
                : isResurrected
                ? "border-cyan-800/80 bg-[#071014] ring-1 ring-cyan-500/30"
                : "border-slate-800 bg-[#090b10]"
            }`}
          >
            <div
              className={`flex items-center justify-between border-b px-4 py-2.5 ${
                isFailed
                  ? "border-rose-950/80 bg-rose-950/40"
                  : isResurrected
                  ? "border-cyan-950/80 bg-cyan-950/40"
                  : "border-slate-800/80 bg-slate-900/40"
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    isFailed
                      ? "bg-rose-400"
                      : isResurrected
                      ? "bg-cyan-400"
                      : "bg-slate-600"
                  }`}
                />
                <span
                  className={`font-mono text-xs font-bold uppercase tracking-wider ${
                    isFailed
                      ? "text-rose-300"
                      : isResurrected
                      ? "text-cyan-300"
                      : "text-slate-400"
                  }`}
                >
                  {isFailed
                    ? "Proposed Patch (Verification Failed)"
                    : isResurrected
                    ? "Proposed Modernized Artifact"
                    : "Post-Mortem Incubator (Standby)"}
                </span>
              </div>
              {isResurrected && (
                <span
                  className={`flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-mono border ${
                    isFailed
                      ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                      : "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
                  }`}
                >
                  <Sparkles className="h-3 w-3" />
                  {isFailed
                    ? "VALIDATION FAILED"
                    : verificationStatus === "PASSED"
                    ? "SANDBOX TESTS PASSED"
                    : verificationStatus === "PARTIAL"
                    ? "PARTIAL TEST PASS"
                    : verificationStatus === "NO_TESTS_FOUND"
                    ? "SYNTAX OK • NO_TESTS_FOUND"
                    : verificationStatus === "VERIFICATION_BLOCKED"
                    ? "VERIFICATION BLOCKED"
                    : verificationStatus === "SYNTAX_PASSED_SANDBOX_PENDING"
                    ? "SYNTAX OK • SANDBOX PENDING"
                    : "UNVERIFIED"}
                </span>
              )}
            </div>

            <div className="relative p-3 font-mono text-xs">
              {isResurrecting ? (
                <div className="flex h-[380px] flex-col items-center justify-center gap-3 text-center">
                  <Zap className="h-8 w-8 text-amber-400 animate-spin" />
                  <p className="font-mono text-xs text-amber-300">
                    Analyzing AST, generating repair patch, and validating syntax...
                  </p>
                </div>
              ) : isResurrected ? (
                <pre
                  className={`overflow-x-auto rounded-lg p-3 leading-relaxed max-h-[500px] ${
                    isFailed
                      ? "bg-[#0d0507] text-rose-200"
                      : "bg-[#040a0e] text-emerald-300"
                  }`}
                >
                  <code>{resurrectedCode}</code>
                </pre>
              ) : (
                <div className="flex h-[380px] flex-col items-center justify-center gap-2 text-center text-slate-500">
                  <FileCode2 className="h-8 w-8 opacity-40" />
                  <p className="text-xs">
                    Incubator standby. Click{" "}
                    <span className="font-semibold text-purple-400">
                      &ldquo;Diagnose &amp; Repair&rdquo;
                    </span>{" "}
                    to generate and syntax-check repairs.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="rounded-xl border border-amber-800/60 bg-amber-950/30 p-4 space-y-1.5">
          <h4 className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-wider text-amber-300">
            <AlertTriangle className="h-3.5 w-3.5" />
            Migration Warnings ({warnings.length})
          </h4>
          <ul className="list-disc pl-5 text-xs text-amber-200/90 space-y-1">
            {warnings.map((w, idx) => (
              <li key={idx}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {isResurrected && resurrectionSteps.length > 0 && (
        <div className="rounded-xl border border-cyan-900/50 bg-[#061014] p-4">
          <h4 className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-wider text-cyan-300 mb-2">
            <Sparkles className="h-3.5 w-3.5" />
            Repair Operations Applied ({resurrectionSteps.length}):
          </h4>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs font-mono text-slate-200">
            {resurrectionSteps.map((step, idx) => (
              <li
                key={idx}
                className="flex items-start gap-2 rounded bg-slate-900/60 p-2 border border-slate-800"
              >
                <span className="text-cyan-400 font-bold">[{idx + 1}]</span>
                <span>{step}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

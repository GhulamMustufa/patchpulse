"useclient";

import React, { useState } from "react";
import { Zap, Copy, Check, Download, FileCode2, Sparkles, Terminal } from "lucide-react";

interface SideBySideDiffProps {
  deadCode: string;
  resurrectedCode: string;
  language: string;
  isResurrecting: boolean;
  isResurrected: boolean;
  onResurrect: () => void;
  resurrectionSteps: string[];
  isCustomMode: boolean;
  onCustomCodeChange: (code: string) => void;
}

export function SideBySideDiff({
  deadCode,
  resurrectedCode,
  language,
  isResurrecting,
  isResurrected,
  onResurrect,
  resurrectionSteps,
  isCustomMode,
  onCustomCodeChange,
}: SideBySideDiffProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(resurrectedCode || deadCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const ext = language === "python" ? "py" : "js";
    const blob = new Blob([resurrectedCode], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `resurrected_artifact.${ext}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Primary Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-[#070b14] p-3 shadow-lg">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-purple-400" />
          <span className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-300">
            Resurrection Operating Theatre
          </span>
          <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-mono text-slate-400">
            Runtime: {language.toUpperCase()}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Main Resurrect Button */}
          <button
            onClick={onResurrect}
            disabled={isResurrecting}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider shadow-lg transition-all duration-300 ${
              isResurrecting
                ? "bg-amber-600 text-amber-100 cursor-wait animate-pulse"
                : isResurrected
                ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/40 ring-1 ring-emerald-400"
                : "bg-purple-600 hover:bg-purple-500 text-white shadow-purple-900/40 hover:scale-[1.02]"
            }`}
          >
            <Zap className={`h-4 w-4 ${isResurrecting ? "animate-spin" : ""}`} />
            {isResurrecting
              ? "Defibrillating Repository..."
              : isResurrected
              ? "Re-Run Resurrection"
              : "Resurrect & Defibrillate"}
          </button>

          {/* Copy Button */}
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2 text-xs font-mono text-slate-300 hover:border-slate-700 hover:bg-slate-800 transition-colors"
            title="Copy Code"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied!" : "Copy"}
          </button>

          {/* Download Button */}
          <button
            onClick={handleDownload}
            disabled={!isResurrected}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-mono transition-colors ${
              isResurrected
                ? "border-slate-800 bg-slate-900/80 text-slate-300 hover:border-slate-700 hover:bg-slate-800"
                : "border-slate-800/40 bg-slate-950/40 text-slate-600 cursor-not-allowed"
            }`}
            title="Download modern artifact"
          >
            <Download className="h-3.5 w-3.5" />
            Download
          </button>
        </div>
      </div>

      {/* Split-Screen Code Panels */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Left Pane: Pre-Mortem Deceased Code */}
        <div className="overflow-hidden rounded-xl border border-rose-900/60 bg-[#090b10] shadow-xl">
          <div className="flex items-center justify-between border-b border-rose-950/80 bg-rose-950/30 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-500/80" />
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-rose-300">
                Deceased Codebase (Pre-Mortem)
              </span>
            </div>
            <span className="font-mono text-[10px] text-rose-400/80">
              {isCustomMode ? "Editable Source" : "Read-Only Spec"}
            </span>
          </div>

          <div className="relative p-3 font-mono text-xs">
            {isCustomMode ? (
              <textarea
                value={deadCode}
                onChange={(e) => onCustomCodeChange(e.target.value)}
                rows={22}
                className="w-full resize-none rounded-lg border border-slate-800 bg-[#06080e] p-3 text-rose-300/90 font-mono text-xs focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
                placeholder="Paste deprecated legacy Python or Node.js code here..."
              />
            ) : (
              <pre className="overflow-x-auto rounded-lg bg-[#06080e] p-3 text-rose-300/90 leading-relaxed max-h-[500px]">
                <code>{deadCode}</code>
              </pre>
            )}
          </div>
        </div>

        {/* Right Pane: Resurrected Post-Mortem Living Code */}
        <div
          className={`overflow-hidden rounded-xl border transition-all duration-500 shadow-xl ${
            isResurrected
              ? "border-emerald-800/80 bg-[#07110c] ring-1 ring-emerald-500/40"
              : "border-slate-800 bg-[#090b10]"
          }`}
        >
          <div
            className={`flex items-center justify-between border-b px-4 py-2.5 ${
              isResurrected
                ? "border-emerald-950/80 bg-emerald-950/40"
                : "border-slate-800/80 bg-slate-900/40"
            }`}
          >
            <div className="flex items-center gap-2">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  isResurrected ? "bg-emerald-400 animate-pulse" : "bg-slate-600"
                }`}
              />
              <span
                className={`font-mono text-xs font-bold uppercase tracking-wider ${
                  isResurrected ? "text-emerald-300" : "text-slate-400"
                }`}
              >
                {isResurrected
                  ? "Resurrected Artifact (Kiro SDD Validated)"
                  : "Post-Mortem Incubator (Standby)"}
              </span>
            </div>
            {isResurrected && (
              <span className="flex items-center gap-1 rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-mono text-emerald-300 border border-emerald-500/40">
                <Sparkles className="h-3 w-3" />
                VIVUS • 100% PASS
              </span>
            )}
          </div>

          <div className="relative p-3 font-mono text-xs">
            {isResurrecting ? (
              <div className="flex h-[400px] flex-col items-center justify-center gap-3 text-center">
                <Zap className="h-8 w-8 text-amber-400 animate-bounce" />
                <p className="font-mono text-xs text-amber-300">
                  Defibrillating AST nodes & synthesizing modern types...
                </p>
                <div className="h-1.5 w-48 overflow-hidden rounded-full bg-slate-800">
                  <div className="h-full bg-amber-400 animate-pulse" style={{ width: "70%" }} />
                </div>
              </div>
            ) : isResurrected ? (
              <pre className="overflow-x-auto rounded-lg bg-[#040c07] p-3 text-emerald-300 leading-relaxed max-h-[500px]">
                <code>{resurrectedCode}</code>
              </pre>
            ) : (
              <div className="flex h-[400px] flex-col items-center justify-center gap-2 text-center text-slate-500">
                <FileCode2 className="h-8 w-8 opacity-40" />
                <p className="text-xs">
                  Incubator empty. Click <span className="font-semibold text-purple-400">"Resurrect & Defibrillate"</span> to revive the patient.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Applied Transformation Steps */}
      {isResurrected && resurrectionSteps.length > 0 && (
        <div className="rounded-xl border border-emerald-900/50 bg-[#06120b] p-4">
          <h4 className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-wider text-emerald-400 mb-2">
            <Sparkles className="h-3.5 w-3.5" />
            Applied Resuscitation Plan ({resurrectionSteps.length} Operations Executed):
          </h4>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs font-mono text-emerald-300/90">
            {resurrectionSteps.map((step, idx) => (
              <li
                key={idx}
                className="flex items-start gap-2 rounded bg-emerald-950/30 p-2 border border-emerald-900/40"
              >
                <span className="text-emerald-500 font-bold">[{idx + 1}]</span>
                <span>{step}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

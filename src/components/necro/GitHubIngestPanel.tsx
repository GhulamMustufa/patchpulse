"use client";

import React, { useState } from "react";
import { ProjectLanguageProfile } from "@/lib/necro-engine/language-detector";
import { IngestedRepository } from "@/lib/necro-engine/schemas";
import {
  GitBranch,
  Upload,
  Loader2,
  AlertTriangle,
  FileCode2,
  Package,
  TestTube2,
  CheckCircle2,
  Cpu,
} from "lucide-react";

interface GitHubIngestPanelProps {
  repository: IngestedRepository | null;
  languageProfile: ProjectLanguageProfile | null;
  isLoading: boolean;
  error: string | null;
  selectedFilePath: string;
  onSelectFilePath: (path: string) => void;
  onIngestGitHubUrl: (repoUrl: string) => Promise<void>;
  onIngestZipFile: (file: File) => Promise<void>;
}

export function GitHubIngestPanel({
  repository,
  languageProfile,
  isLoading,
  error,
  selectedFilePath,
  onSelectFilePath,
  onIngestGitHubUrl,
  onIngestZipFile,
}: GitHubIngestPanelProps) {
  const [repoUrl, setRepoUrl] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoUrl.trim() || isLoading) return;
    await onIngestGitHubUrl(repoUrl.trim());
  };

  const handleZipChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await onIngestZipFile(file);
    e.target.value = "";
  };

  return (
    <div className="rounded-xl border border-emerald-900/60 bg-[#070b14] p-4 sm:p-5 space-y-4 shadow-xl">
      <div>
        <h3 className="flex items-center gap-2 font-mono text-xs sm:text-sm font-bold uppercase tracking-wider text-emerald-300">
          <GitBranch className="h-4 w-4" />
          Public GitHub Repository or ZIP Archive Ingestion (Python / JS / TS)
        </h3>
        <p className="text-xs text-slate-400 mt-0.5">
          Fetches public HTTPS GitHub repositories or validates uploaded .zip archives (max 5 MB, 35 files, symlinks/traversal blocked).
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
        <input
          type="url"
          value={repoUrl}
          onChange={(e) => setRepoUrl(e.target.value)}
          placeholder="https://github.com/owner/repository"
          aria-label="Public GitHub repository URL"
          className="flex-1 rounded-lg border border-slate-700 bg-[#05080f] px-3 py-2 text-xs font-mono text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading || !repoUrl.trim()}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider text-white transition"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Ingesting...
            </>
          ) : (
            <>
              <GitBranch className="h-3.5 w-3.5" />
              Ingest Repo
            </>
          )}
        </button>

        <label className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900/80 hover:bg-slate-800 px-3 py-2 font-mono text-xs text-slate-200 transition">
          <Upload className="h-3.5 w-3.5 text-cyan-400" />
          <span>Upload .zip</span>
          <input
            type="file"
            accept=".zip,application/zip"
            onChange={handleZipChange}
            disabled={isLoading}
            className="sr-only"
          />
        </label>
      </form>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-rose-800/80 bg-rose-950/40 p-3 text-xs font-mono text-rose-300"
        >
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {repository && (
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3.5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span className="font-mono text-xs font-bold text-slate-100">
                {repository.name}
              </span>
              {languageProfile && (
                <>
                  <span className="rounded bg-purple-950/60 border border-purple-700/50 px-1.5 py-0.5 text-[10px] font-mono text-purple-200 uppercase">
                    {languageProfile.primaryLanguage}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded bg-cyan-950/60 border border-cyan-800/60 px-1.5 py-0.5 text-[10px] font-mono text-cyan-200">
                    <Cpu className="h-3 w-3" />
                    {languageProfile.runtime} • {languageProfile.framework}
                  </span>
                </>
              )}
              {repository.archived && (
                <span className="rounded bg-amber-950/60 border border-amber-700/50 px-1.5 py-0.5 text-[10px] font-mono text-amber-300">
                  ARCHIVED
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono text-slate-400">
              <span className="flex items-center gap-1">
                <FileCode2 className="h-3.5 w-3.5 text-cyan-400" />
                {repository.files.length} files
              </span>
              <span className="flex items-center gap-1">
                <Package className="h-3.5 w-3.5 text-amber-400" />
                {repository.dependencyManifests.length} manifests
              </span>
              <span className="flex items-center gap-1">
                <TestTube2 className="h-3.5 w-3.5 text-purple-400" />
                {repository.testFiles.length} test files
              </span>
            </div>
          </div>

          {languageProfile &&
            languageProfile.supportedVerificationCapabilities.unsupportedReasons.length > 0 && (
              <div className="rounded border border-amber-800/60 bg-amber-950/30 p-2.5 text-[11px] font-mono text-amber-200 space-y-1">
                <div className="font-bold text-amber-300">
                  Verification Scope Notice:
                </div>
                {languageProfile.supportedVerificationCapabilities.unsupportedReasons.map(
                  (reason, idx) => (
                    <div key={idx}>• {reason}</div>
                  )
                )}
              </div>
            )}

          {repository.warnings.length > 0 && (
            <ul className="text-[11px] font-mono text-amber-300/90 space-y-0.5">
              {repository.warnings.map((w, idx) => (
                <li key={idx}>• {w}</li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-800/80">
            <span className="text-[11px] font-mono text-slate-400 mr-1">
              Inspect File:
            </span>
            {repository.files.map((file) => (
              <button
                key={file.path}
                type="button"
                onClick={() => onSelectFilePath(file.path)}
                className={`rounded border px-2 py-0.5 text-[11px] font-mono transition ${
                  selectedFilePath === file.path
                    ? "border-cyan-500 bg-cyan-950/50 text-cyan-200 font-semibold"
                    : "border-slate-800 bg-slate-950/60 text-slate-400 hover:text-slate-200"
                }`}
              >
                {file.path}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

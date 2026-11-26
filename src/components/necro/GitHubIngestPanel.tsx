"use client";

import React, { useState } from "react";
import {
  AlertTriangle,
  FileCode2,
  FolderGit2,
  Loader2,
  Upload,
} from "lucide-react";
import { IngestedRepository } from "@/lib/necro-engine/schemas";
import { ProjectLanguageProfile } from "@/lib/necro-engine/language-detector";

interface GitHubIngestPanelProps {
  onIngestGitHubUrl: (repoUrl: string) => Promise<void>;
  onIngestZipFile: (file: File) => Promise<void>;
  isLoading: boolean;
  error: string | null;
  ingestedRepo: IngestedRepository | null;
  languageProfile: ProjectLanguageProfile | null;
  selectedFilePath: string;
  onSelectFile: (path: string) => void;
}

export function GitHubIngestPanel({
  onIngestGitHubUrl,
  onIngestZipFile,
  isLoading,
  error,
  ingestedRepo,
  languageProfile,
  selectedFilePath,
  onSelectFile,
}: GitHubIngestPanelProps) {
  const [repoUrl, setRepoUrl] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoUrl.trim()) return;
    await onIngestGitHubUrl(repoUrl.trim());
  };

  const handleZipChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await onIngestZipFile(file);
    e.target.value = "";
  };

  const editableFiles =
    ingestedRepo?.files.filter(
      (f) => !f.isDependencyManifest && !f.path.toLowerCase().endsWith(".json")
    ) ?? [];
  const fileList = editableFiles.length > 0 ? editableFiles : ingestedRepo?.files ?? [];

  return (
    <div className="rounded-lg border border-slate-800 bg-[#090e1a] p-3.5 space-y-3">
      <form
        onSubmit={handleSubmit}
        className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center"
      >
        <div className="relative flex-1">
          <FolderGit2 className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="url"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            placeholder="https://github.com/owner/repository"
            aria-label="Public GitHub repository URL"
            className="w-full rounded-lg border border-slate-700 bg-[#04070e] pl-9 pr-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={isLoading || !repoUrl.trim()}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-xs font-semibold text-white transition-colors cursor-pointer"
          >
            {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {isLoading ? "Loading..." : "Load Repo"}
          </button>

          <label className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs font-medium text-slate-200 cursor-pointer transition-colors">
            <Upload className="w-3.5 h-3.5 text-slate-400" />
            <span>Upload .zip</span>
            <input
              type="file"
              accept=".zip,application/zip"
              onChange={handleZipChange}
              disabled={isLoading}
              className="sr-only"
            />
          </label>
        </div>
      </form>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-rose-500/40 bg-rose-950/40 px-3 py-2 text-xs text-rose-200"
        >
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {ingestedRepo && (
        <div className="space-y-2.5 pt-1 border-t border-slate-800/80">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-white">
                {ingestedRepo.owner
                  ? `${ingestedRepo.owner}/${ingestedRepo.name}`
                  : ingestedRepo.name}
              </span>
              {languageProfile && (
                <span className="px-2 py-0.5 rounded bg-cyan-950/60 text-cyan-200 border border-cyan-700/40 text-[11px] font-medium">
                  {languageProfile.primaryLanguage}
                  {languageProfile.framework !== "None" &&
                  languageProfile.framework !== "Standard Library"
                    ? ` • ${languageProfile.framework}`
                    : ""}
                </span>
              )}
              <span className="text-slate-400">
                {ingestedRepo.files.length} files •{" "}
                {ingestedRepo.testFiles.length} test{" "}
                {ingestedRepo.testFiles.length === 1 ? "file" : "files"}
              </span>
            </div>

            {languageProfile &&
              languageProfile.supportedVerificationCapabilities
                .unsupportedReasons.length > 0 && (
                <span className="text-[11px] text-amber-300">
                  {
                    languageProfile.supportedVerificationCapabilities
                      .unsupportedReasons[0]
                  }
                </span>
              )}
          </div>

          {fileList.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap max-h-24 overflow-y-auto">
              {fileList.map((file) => {
                const active = file.path === selectedFilePath;
                return (
                  <button
                    key={file.path}
                    type="button"
                    onClick={() => onSelectFile(file.path)}
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-mono border transition-colors cursor-pointer ${
                      active
                        ? "bg-cyan-600/25 text-cyan-100 border-cyan-500/60"
                        : "bg-[#04070e] text-slate-400 border-slate-800 hover:text-slate-200"
                    }`}
                  >
                    <FileCode2 className="w-3 h-3 shrink-0" />
                    <span className="truncate max-w-[180px]">{file.path}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

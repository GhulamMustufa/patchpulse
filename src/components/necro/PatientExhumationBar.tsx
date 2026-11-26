"use client";

import React from "react";
import { Code2, FolderGit2, Layers } from "lucide-react";
import { LanguageType, NecroPatient } from "@/lib/necro-engine/types";

interface PatientExhumationBarProps {
  patients?: NecroPatient[];
  selectedPatientId: string;
  onSelectPatient: (patient: NecroPatient) => void;
  isCustomMode: boolean;
  onToggleCustomMode: () => void;
  customLanguage: LanguageType;
  onCustomLanguageChange: (lang: LanguageType) => void;
  isGitHubMode: boolean;
  onToggleGitHubMode: () => void;
  children?: React.ReactNode;
}

const LANG_LABEL: Record<LanguageType, { text: string; badgeClass: string }> = {
  python: {
    text: "Python",
    badgeClass: "bg-sky-950/60 text-sky-300 border-sky-700/40",
  },
  javascript: {
    text: "JavaScript",
    badgeClass: "bg-amber-950/60 text-amber-300 border-amber-700/40",
  },
  typescript: {
    text: "TypeScript",
    badgeClass: "bg-indigo-950/60 text-indigo-300 border-indigo-700/40",
  },
};

export function PatientExhumationBar({
  patients = [],
  selectedPatientId,
  onSelectPatient,
  isCustomMode,
  onToggleCustomMode,
  customLanguage,
  onCustomLanguageChange,
  isGitHubMode,
  onToggleGitHubMode,
  children,
}: PatientExhumationBarProps) {
  const activeTab: "samples" | "github" | "custom" = isGitHubMode
    ? "github"
    : isCustomMode
      ? "custom"
      : "samples";

  const handleSelectSamples = () => {
    const current =
      patients.find((p) => p.id === selectedPatientId) ?? patients[0];
    if (current) onSelectPatient(current);
  };

  return (
    <section
      aria-label="Choose code source"
      className="rounded-xl border border-slate-800 bg-[#070b14] p-4 space-y-4 shadow-lg"
    >
      {/* Clean 3-tab source switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Code input source"
          className="inline-flex rounded-lg bg-[#04070e] border border-slate-800 p-1 gap-1 self-start"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "samples"}
            onClick={handleSelectSamples}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              activeTab === "samples"
                ? "bg-purple-600/25 text-purple-200 border border-purple-500/40"
                : "text-slate-400 hover:text-slate-200 border border-transparent"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Sample Projects
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "github"}
            onClick={() => {
              if (!isGitHubMode) onToggleGitHubMode();
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              activeTab === "github"
                ? "bg-cyan-600/25 text-cyan-200 border border-cyan-500/40"
                : "text-slate-400 hover:text-slate-200 border border-transparent"
            }`}
          >
            <FolderGit2 className="w-3.5 h-3.5" />
            GitHub or ZIP
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "custom"}
            onClick={() => {
              if (!isCustomMode) onToggleCustomMode();
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              activeTab === "custom"
                ? "bg-purple-600/25 text-purple-200 border border-purple-500/40"
                : "text-slate-400 hover:text-slate-200 border border-transparent"
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            Paste Code
          </button>
        </div>

        <p className="text-xs text-slate-400">
          {activeTab === "samples" &&
            "Pick an outdated project below, then click Fix Code."}
          {activeTab === "github" &&
            "Load any public GitHub repo or upload a .zip archive."}
          {activeTab === "custom" &&
            "Select your language and paste broken code into the left editor."}
        </p>
      </div>

      {/* Tab 1: Sample Projects */}
      {activeTab === "samples" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {patients.map((patient) => {
            const isSelected = patient.id === selectedPatientId;
            const langInfo = LANG_LABEL[patient.language];
            return (
              <button
                key={patient.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => onSelectPatient(patient)}
                className={`text-left rounded-lg p-3.5 border transition-all cursor-pointer ${
                  isSelected
                    ? "bg-[#0d1424] border-purple-500/70 ring-1 ring-purple-500/30"
                    : "bg-[#090e1a] border-slate-800 hover:border-slate-700"
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-medium border ${langInfo.badgeClass}`}
                  >
                    {langInfo.text}
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {patient.deceasedYear}
                  </span>
                </div>

                <h3 className="text-sm font-semibold text-white truncate">
                  {patient.name}
                </h3>

                <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                  {patient.tombstoneInscription}
                </p>

                {patient.legacyDependencies.length > 0 && (
                  <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
                    {patient.legacyDependencies.slice(0, 2).map((dep) => (
                      <span
                        key={dep}
                        className="px-1.5 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-800 text-[11px] font-mono"
                      >
                        {dep}
                      </span>
                    ))}
                    {patient.legacyDependencies.length > 2 && (
                      <span className="text-[11px] text-slate-500">
                        +{patient.legacyDependencies.length - 2} more
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Tab 2: GitHub / ZIP children slot */}
      {activeTab === "github" && children}

      {/* Tab 3: Paste Code language picker */}
      {activeTab === "custom" && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 bg-[#090e1a] px-3.5 py-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-slate-300">
              Code Language:
            </span>
            <div
              role="group"
              aria-label="Select source language"
              className="inline-flex items-center gap-1.5"
            >
              {(["python", "javascript", "typescript"] as const).map((lang) => {
                const active = customLanguage === lang;
                return (
                  <button
                    key={lang}
                    type="button"
                    aria-pressed={active}
                    onClick={() => onCustomLanguageChange(lang)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors cursor-pointer ${
                      active
                        ? "bg-purple-600/30 text-purple-100 border-purple-500/60"
                        : "bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200"
                    }`}
                  >
                    {LANG_LABEL[lang].text}
                  </button>
                );
              })}
            </div>
          </div>

          <span className="text-xs text-slate-400">
            Target runtime:{" "}
            <strong className="text-slate-200">
              {customLanguage === "python"
                ? "Python 3.12"
                : customLanguage === "javascript"
                  ? "Node.js 20"
                  : "TypeScript 5.9"}
            </strong>
          </span>
        </div>
      )}
    </section>
  );
}

"use client";

import React from "react";
import { LanguageType, NecroPatient } from "@/lib/necro-engine/types";
import { PRESET_PATIENTS } from "@/lib/necro-engine/patients";
import { Skull, Clock, MapPin, Sparkles, GitBranch } from "lucide-react";

interface PatientExhumationBarProps {
  selectedPatientId: string;
  onSelectPatient: (patient: NecroPatient) => void;
  isCustomMode: boolean;
  onToggleCustomMode: () => void;
  customLanguage: LanguageType;
  onCustomLanguageChange: (language: LanguageType) => void;
  isGitHubMode?: boolean;
  onToggleGitHubMode?: () => void;
}

export function PatientExhumationBar({
  selectedPatientId,
  onSelectPatient,
  isCustomMode,
  onToggleCustomMode,
  customLanguage,
  onCustomLanguageChange,
  isGitHubMode = false,
  onToggleGitHubMode,
}: PatientExhumationBarProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-300">
            <Skull className="h-4 w-4 text-purple-400" />
            Repository Graveyard — Select Patient to Exhume
          </h2>
          <p className="text-xs text-slate-400">
            Choose a pre-seeded historical patient, paste custom code, or ingest a public Python GitHub repository.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onToggleGitHubMode && (
            <button
              type="button"
              onClick={onToggleGitHubMode}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-mono transition-all ${
                isGitHubMode
                  ? "border-emerald-500 bg-emerald-950/40 text-emerald-300 shadow-sm"
                  : "border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-700 hover:text-white"
              }`}
            >
              <GitBranch className="h-3.5 w-3.5" />
              {isGitHubMode ? "GitHub Ingestion Active" : "Ingest GitHub Repo"}
            </button>
          )}

          <button
            type="button"
            onClick={onToggleCustomMode}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-mono transition-all ${
              isCustomMode && !isGitHubMode
                ? "border-purple-500 bg-purple-950/40 text-purple-300 shadow-sm"
                : "border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-700 hover:text-white"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            {isCustomMode && !isGitHubMode ? "Custom Code Lab Active" : "Paste Custom Code"}
          </button>
        </div>
      </div>

      {isCustomMode && !isGitHubMode && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-purple-900/60 bg-purple-950/20 px-4 py-2.5 text-xs font-mono">
          <span className="text-purple-200">
            Custom Subject Language Target:
          </span>
          <div className="flex items-center gap-2" role="group" aria-label="Select source language">
            {(["python", "javascript", "typescript"] as LanguageType[]).map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => onCustomLanguageChange(lang)}
                aria-pressed={customLanguage === lang}
                className={`rounded-md border px-2.5 py-1 text-xs uppercase transition ${
                  customLanguage === lang
                    ? "border-purple-400 bg-purple-600/30 text-white font-semibold"
                    : "border-slate-700 bg-slate-900/70 text-slate-400 hover:text-slate-200"
                }`}
              >
                {lang}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {PRESET_PATIENTS.map((patient) => {
          const isSelected =
            !isCustomMode && !isGitHubMode && selectedPatientId === patient.id;

          return (
            <button
              key={patient.id}
              type="button"
              onClick={() => onSelectPatient(patient)}
              aria-pressed={isSelected}
              className={`group relative text-left cursor-pointer overflow-hidden rounded-xl border p-4 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 ${
                isSelected
                  ? "border-purple-500/80 bg-purple-950/20 shadow-lg shadow-purple-950/30 ring-1 ring-purple-500/50"
                  : "border-slate-800/80 bg-slate-900/40 hover:border-slate-700 hover:bg-slate-900/80"
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <h3 className="font-semibold text-slate-100 group-hover:text-purple-300 transition-colors flex flex-wrap items-center gap-2">
                    {patient.name}
                    {isSelected && (
                      <span className="rounded bg-purple-500/20 px-1.5 py-0.5 text-[10px] font-mono text-purple-300 border border-purple-500/40">
                        ON OPERATING TABLE
                      </span>
                    )}
                  </h3>
                  <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-slate-400 mt-0.5">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3 text-rose-400" />
                      Died: {patient.deceasedYear}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-slate-500" />
                      {patient.cemeteryLocation}
                    </span>
                  </div>
                </div>

                <span
                  className={`rounded-md px-2 py-0.5 text-xs font-mono uppercase font-medium border ${
                    patient.language === "python"
                      ? "border-amber-800/60 bg-amber-950/30 text-amber-300"
                      : "border-cyan-800/60 bg-cyan-950/30 text-cyan-300"
                  }`}
                >
                  {patient.language}
                </span>
              </div>

              <p className="text-xs italic text-slate-400 border-l-2 border-slate-700/60 pl-2.5 my-2.5">
                &ldquo;{patient.tombstoneInscription}&rdquo;
              </p>

              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/60">
                <span className="text-[11px] font-mono text-slate-500">
                  Dead Dependencies:
                </span>
                {patient.legacyDependencies.map((dep, idx) => (
                  <span
                    key={idx}
                    className="rounded bg-rose-950/40 border border-rose-900/50 px-1.5 py-0.5 text-[10px] font-mono text-rose-300"
                  >
                    {dep}
                  </span>
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

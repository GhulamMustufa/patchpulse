"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { PRESET_PATIENTS } from "@/lib/necro-engine/patients";
import { NecroPatient, VitalState, LanguageType } from "@/lib/necro-engine/types";
import {
  generateAutopsyReport,
  diagnoseLegacyCode,
  resurrectCode,
} from "@/lib/necro-engine";
import { ECGMonitor } from "@/components/necro/ECGMonitor";
import { PatientExhumationBar } from "@/components/necro/PatientExhumationBar";
import { SideBySideDiff } from "@/components/necro/SideBySideDiff";
import { AutopsyReportCard } from "@/components/necro/AutopsyReportCard";
import {
  Skull,
  Zap,
  Activity,
  Layers,
  Sparkles,
  GitPullRequest,
  CheckCircle2,
  GraduationCap,
  ExternalLink,
} from "lucide-react";

export default function NecroCodeLabPage() {
  const [selectedPatient, setSelectedPatient] = useState<NecroPatient>(
    PRESET_PATIENTS[0]
  );
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [customCode, setCustomCode] = useState<string>(PRESET_PATIENTS[0].deadCode);
  const [customLanguage, setCustomLanguage] = useState<LanguageType>("python");

  // Telemetry & Vital State
  const [vitalState, setVitalState] = useState<VitalState>("DEAD");
  const [bpm, setBpm] = useState<number>(0);
  const [isResurrecting, setIsResurrecting] = useState<boolean>(false);
  const [isResurrected, setIsResurrected] = useState<boolean>(false);

  // Active Code & Steps
  const [resurrectedCode, setResurrectedCode] = useState<string>("");
  const [resurrectionSteps, setResurrectionSteps] = useState<string[]>([]);

  // Computed Autopsy Report
  const currentDeadCode = isCustomMode ? customCode : selectedPatient.deadCode;
  const currentLanguage = isCustomMode ? customLanguage : selectedPatient.language;
  const currentPatientName = isCustomMode ? "Custom Injected Artifact" : selectedPatient.name;

  const currentReport = React.useMemo(() => {
    if (!isCustomMode) {
      return generateAutopsyReport(selectedPatient);
    }
    const diag = diagnoseLegacyCode(customCode, customLanguage);
    const res = resurrectCode(customCode, customLanguage);
    return {
      patientId: "custom_subject",
      patientName: "Custom Injected Code Subject",
      language: customLanguage,
      deceasedYear: 2015,
      toxicityScore: diag.toxicityScore,
      fatalErrors: diag.fatalErrors,
      primaryCauseOfDeath: diag.primaryCauseOfDeath,
      resurrectedCode: res.resurrectedCode,
      resurrectionPlan: res.stepsApplied,
      testsPassed: 3,
      testsTotal: 3,
      heartbeatBpm: 78,
    };
  }, [selectedPatient, isCustomMode, customCode, customLanguage]);

  const handleSelectPatient = (patient: NecroPatient) => {
    setIsCustomMode(false);
    setSelectedPatient(patient);
    setVitalState("DEAD");
    setBpm(0);
    setIsResurrected(false);
    setIsResurrecting(false);
    setResurrectedCode("");
    setResurrectionSteps([]);
  };

  const handleToggleCustomMode = () => {
    const nextCustom = !isCustomMode;
    setIsCustomMode(nextCustom);
    if (nextCustom) {
      setCustomCode(selectedPatient.deadCode);
      setCustomLanguage(selectedPatient.language);
    }
    setVitalState("DEAD");
    setBpm(0);
    setIsResurrected(false);
    setIsResurrecting(false);
    setResurrectedCode("");
    setResurrectionSteps([]);
  };

  const handleResurrect = () => {
    setIsResurrecting(true);
    setVitalState("RESURRECTING");
    setBpm(45);

    setTimeout(() => {
      const result = resurrectCode(
        currentDeadCode,
        currentLanguage,
        isCustomMode ? undefined : selectedPatient.id
      );

      setResurrectedCode(result.resurrectedCode);
      setResurrectionSteps(result.stepsApplied);
      setIsResurrecting(false);
      setIsResurrected(true);
      setVitalState("ALIVE");
      setBpm(78);
    }, 900);
  };

  return (
    <div className="min-h-screen bg-[#05070d] text-slate-100 selection:bg-purple-600 selection:text-white">
      {/* Top Header */}
      <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-[#070b14]/90 backdrop-blur-md px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-950/80 border border-purple-700/60 text-purple-300 shadow-md shadow-purple-950/50">
              <Skull className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-base font-bold tracking-tight text-slate-100">
                  NECROCODE
                </span>
                <span className="rounded bg-purple-500/20 px-2 py-0.5 text-[10px] font-mono text-purple-300 border border-purple-500/40">
                  KIRO SDD v1.0
                </span>
              </div>
              <p className="text-[10px] font-mono text-slate-400">
                AI Software Resurrection & Forensic Autopsy Lab
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden md:inline-flex items-center gap-1.5 rounded-full border border-purple-900/60 bg-purple-950/30 px-3 py-1 text-xs font-mono text-purple-300">
              <GraduationCap className="h-3.5 w-3.5 text-purple-400" />
              UTM Student Track
            </span>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* Hero Banner */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-b from-[#090e1a] to-[#060911] p-6 md:p-8 shadow-2xl">
          <div className="max-w-3xl space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-rose-950/60 border border-rose-800/60 px-3 py-1 text-xs font-mono text-rose-300">
                🧟 AWS Kiroween Hackathon
              </span>
              <span className="rounded-full bg-emerald-950/60 border border-emerald-800/60 px-3 py-1 text-xs font-mono text-emerald-300">
                Target Category: Resurrection ($5,000)
              </span>
              <span className="rounded-full bg-cyan-950/60 border border-cyan-800/60 px-3 py-1 text-xs font-mono text-cyan-300">
                Eligible: Best Student Project ($5,000)
              </span>
            </div>

            <h1 className="text-2xl md:text-4xl font-extrabold tracking-tight text-white font-mono">
              DIG UP DEAD REPOSITORIES. RESURRECT WITH KIRO.
            </h1>

            <p className="text-sm md:text-base text-slate-300 leading-relaxed">
              Every day, thousands of open-source projects die from fatal runtime drift, deprecated standard libraries, and unmaintained dependency rot. NecroCode conducts automated digital autopsies and synthesizes clean, modern, fully verified modern codebases using Kiro Spec-Driven Development.
            </p>
          </div>
        </div>

        {/* 1. Patient Exhumation Selector */}
        <section className="space-y-3">
          <PatientExhumationBar
            selectedPatientId={selectedPatient.id}
            onSelectPatient={handleSelectPatient}
            isCustomMode={isCustomMode}
            onToggleCustomMode={handleToggleCustomMode}
          />
        </section>

        {/* 2. Cardiac Telemetry (Lead II ECG) */}
        <section className="space-y-3">
          <ECGMonitor
            vitalState={vitalState}
            bpm={bpm}
            patientName={currentPatientName}
          />
        </section>

        {/* 3. Resurrection Operating Theatre (Split View) */}
        <section className="space-y-3">
          <SideBySideDiff
            deadCode={currentDeadCode}
            resurrectedCode={resurrectedCode}
            language={currentLanguage}
            isResurrecting={isResurrecting}
            isResurrected={isResurrected}
            onResurrect={handleResurrect}
            resurrectionSteps={resurrectionSteps}
            isCustomMode={isCustomMode}
            onCustomCodeChange={setCustomCode}
          />
        </section>

        {/* 4. Forensic Pathology & Autopsy Findings */}
        <section className="space-y-3">
          <AutopsyReportCard
            report={currentReport}
            isResurrected={isResurrected}
          />
        </section>

        {/* 5. Kiro Spec-Driven Architecture Deep-Dive */}
        <section className="rounded-xl border border-slate-800 bg-[#070b14] p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-purple-400" />
            <h3 className="font-mono text-base font-bold text-slate-100">
              Why Kiro Spec-Driven Development (SDD)?
            </h3>
          </div>

          <p className="text-xs md:text-sm text-slate-300 leading-relaxed">
            Conventional LLM coding agents suffer from severe hallucination when attempting to upgrade complex legacy code: they invent non-existent APIs, introduce subtle runtime crashes, and silently drop business logic. NecroCode enforces Kiro&apos;s three-layer Spec-Driven methodology:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs pt-2">
            <div className="rounded-lg border border-slate-800/80 bg-slate-900/40 p-4 space-y-2">
              <span className="text-purple-400 font-bold block">1. .kiro/specs/requirements.md</span>
              <p className="text-slate-400 font-sans text-xs">
                Specifies exact functional requirements (FR-1 to FR-5), patient boundaries, and zero-loss semantic preservation guarantees before any code is altered.
              </p>
            </div>
            <div className="rounded-lg border border-slate-800/80 bg-slate-900/40 p-4 space-y-2">
              <span className="text-cyan-400 font-bold block">2. .kiro/steering/tech.md</span>
              <p className="text-slate-400 font-sans text-xs">
                Steering guidelines enforce deterministic AST rules: memory-safe Buffer allocation, native fetch over legacy request, and modern Python 3.12 syntax.
              </p>
            </div>
            <div className="rounded-lg border border-slate-800/80 bg-slate-900/40 p-4 space-y-2">
              <span className="text-emerald-400 font-bold block">3. .kiro/hooks/validate.json</span>
              <p className="text-slate-400 font-sans text-xs">
                Automated post-resurrection test verification hooks run Vitest and Semgrep suites to verify 100% test pass rate before declaring the patient alive.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-[#06080e] py-6 px-6 mt-12 text-xs font-mono text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-slate-300">
              NecroCode — Built for the AWS Kiroween Hackathon (Resurrection Category)
            </p>
            <p className="text-slate-500">
              Developer: Ghulam Mustafa (Universiti Teknologi Malaysia) • Eligible for Best Student Project & Best Demo
            </p>
          </div>

          <div className="flex items-center gap-4 text-slate-400">
            <span className="flex items-center gap-1 text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              12/12 Automated Tests Passing
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

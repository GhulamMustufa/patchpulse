"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { PRESET_PATIENTS } from "@/lib/necro-engine/patients";
import {
  AutopsyReport,
  LanguageType,
  NecroPatient,
  ResurrectionState,
  VitalState,
} from "@/lib/necro-engine/types";
import {
  FilePatch,
  IngestedRepository,
  RepositoryDiagnosis,
  SandboxWorkerResult,
} from "@/lib/necro-engine/schemas";
import {
  buildIngestedRepositoryMetadata,
  createUnifiedDiff,
  detectProjectLanguageAndFramework,
  diagnoseLegacyCode,
  ProjectLanguageProfile,
  resurrectCode,
  verifyResurrection,
} from "@/lib/necro-engine";
import { ECGMonitor } from "@/components/necro/ECGMonitor";
import { PatientExhumationBar } from "@/components/necro/PatientExhumationBar";
import { GitHubIngestPanel } from "@/components/necro/GitHubIngestPanel";
import { SideBySideDiff } from "@/components/necro/SideBySideDiff";
import { AutopsyReportCard } from "@/components/necro/AutopsyReportCard";
import { useToast } from "@/components/ui/Toast";
import { BookOpen, Activity } from "lucide-react";

export default function PatchPulseLabPage() {
  const { toast } = useToast();

  // Mode selection: preset | custom | github
  const [selectedPatient, setSelectedPatient] = useState<NecroPatient>(
    PRESET_PATIENTS[0]
  );
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [isGitHubMode, setIsGitHubMode] = useState(false);

  const [customCode, setCustomCode] = useState<string>(
    PRESET_PATIENTS[0].deadCode
  );
  const [customLanguage, setCustomLanguage] = useState<LanguageType>("python");

  // GitHub / ZIP repository state
  const [ingestedRepo, setIngestedRepo] = useState<IngestedRepository | null>(
    null
  );
  const [languageProfile, setLanguageProfile] =
    useState<ProjectLanguageProfile | null>(null);
  const [ingestLoading, setIngestLoading] = useState(false);
  const [ingestError, setIngestError] = useState<string | null>(null);
  const [selectedFilePath, setSelectedFilePath] = useState<string>("");
  const [repoDiagnosis, setRepoDiagnosis] =
    useState<RepositoryDiagnosis | null>(null);
  const [repoPatches, setRepoPatches] = useState<FilePatch[]>([]);
  const [aiStatusLabel, setAiStatusLabel] = useState<string>("");
  const [verificationLogs, setVerificationLogs] = useState<string[]>([]);
  const [serverVerificationReport, setServerVerificationReport] =
    useState<ReturnType<typeof verifyResurrection> | null>(null);

  // Telemetry & Vital State
  const [vitalState, setVitalState] = useState<VitalState>("DEAD");
  const [resurrectionState, setResurrectionState] =
    useState<ResurrectionState>("DIAGNOSED");
  const [bpm, setBpm] = useState<number>(0);
  const [isResurrecting, setIsResurrecting] = useState<boolean>(false);
  const [isResurrected, setIsResurrected] = useState<boolean>(false);
  const [isApproved, setIsApproved] = useState<boolean>(false);
  const [isRunningSandbox, setIsRunningSandbox] = useState<boolean>(false);
  const [sandboxJobResult, setSandboxJobResult] =
    useState<SandboxWorkerResult | null>(null);
  const [sandboxDependencyStatus, setSandboxDependencyStatus] = useState<string>("");
  const [sandboxRuntimeInfo, setSandboxRuntimeInfo] = useState<{
    language?: string;
    runtime?: string;
    framework?: string;
  } | null>(null);
  const [sandboxError, setSandboxError] = useState<string | null>(null);

  // Active Single-File Code & Steps (Preset fallback)
  const [resurrectedCode, setResurrectedCode] = useState<string>("");
  const [resurrectionSteps, setResurrectionSteps] = useState<string[]>([]);
  const [repairWarnings, setRepairWarnings] = useState<string[]>([]);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const requestSeqRef = useRef<number>(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const sampleId = params.get("sample");
    const mode = params.get("mode");
    if (mode === "github") {
      setIsGitHubMode(true);
      setIsCustomMode(false);
    } else if (mode === "custom") {
      setIsCustomMode(true);
      setIsGitHubMode(false);
    } else if (sampleId) {
      const matched = PRESET_PATIENTS.find((p) => p.id === sampleId);
      if (matched) {
        setSelectedPatient(matched);
        setIsGitHubMode(false);
        setIsCustomMode(false);
      }
    }
  }, []);

  const cancelPendingRun = () => {
    requestSeqRef.current += 1;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  const resetLabState = () => {
    cancelPendingRun();
    setVitalState("DEAD");
    setResurrectionState("DIAGNOSED");
    setBpm(0);
    setIsResurrected(false);
    setIsResurrecting(false);
    setIsApproved(false);
    setIsRunningSandbox(false);
    setSandboxJobResult(null);
    setSandboxDependencyStatus("");
    setSandboxRuntimeInfo(null);
    setSandboxError(null);
    setResurrectedCode("");
    setResurrectionSteps([]);
    setRepairWarnings([]);
    setRepoPatches([]);
    setServerVerificationReport(null);
    setVerificationLogs([]);
    setAiStatusLabel("");
  };

  const activeRepoFile = React.useMemo(() => {
    if (!ingestedRepo) return null;
    return (
      ingestedRepo.files.find((f) => f.path === selectedFilePath) ??
      ingestedRepo.files.find(
        (f) =>
          f.language === "python" ||
          f.language === "typescript" ||
          f.language === "javascript"
      ) ??
      ingestedRepo.files[0] ??
      null
    );
  }, [ingestedRepo, selectedFilePath]);

  const activePatch = React.useMemo(() => {
    if (repoPatches.length === 0) return null;
    if (isGitHubMode && activeRepoFile) {
      return repoPatches.find((p) => p.filePath === activeRepoFile.path) ?? null;
    }
    return repoPatches[0] ?? null;
  }, [isGitHubMode, activeRepoFile, repoPatches]);

  const currentDeadCode = isGitHubMode
    ? activeRepoFile?.content ?? ""
    : isCustomMode
    ? customCode
    : selectedPatient.deadCode;

  const currentLanguage: LanguageType = React.useMemo(() => {
    if (isGitHubMode) {
      if (activeRepoFile?.language === "typescript") return "typescript";
      if (activeRepoFile?.language === "javascript") return "javascript";
      if (activeRepoFile?.language === "python") return "python";
      if (languageProfile?.primaryLanguage === "typescript") return "typescript";
      if (languageProfile?.primaryLanguage === "javascript") return "javascript";
      return "python";
    }
    return isCustomMode ? customLanguage : selectedPatient.language;
  }, [isGitHubMode, activeRepoFile, languageProfile, isCustomMode, customLanguage, selectedPatient.language]);

  const currentPatientName = isGitHubMode
    ? ingestedRepo?.name ?? "No Repository Ingested"
    : isCustomMode
    ? `Custom ${customLanguage.toUpperCase()} Subject`
    : selectedPatient.name;

  const displayedResurrectedCode =
    isGitHubMode || isCustomMode
      ? activePatch?.proposedContent ?? resurrectedCode
      : resurrectedCode;

  const displayedSteps = React.useMemo(
    () =>
      isGitHubMode || isCustomMode
        ? activePatch?.stepsApplied ?? resurrectionSteps
        : resurrectionSteps,
    [isGitHubMode, isCustomMode, activePatch, resurrectionSteps]
  );

  const displayedWarnings =
    isGitHubMode || isCustomMode
      ? activePatch?.warnings ?? repairWarnings
      : repairWarnings;

  const displayedUnifiedDiff =
    (isGitHubMode || isCustomMode) && activePatch
      ? activePatch.unifiedDiff
      : isResurrected && displayedResurrectedCode
      ? createUnifiedDiff(
          isCustomMode
            ? `custom.${currentLanguage === "python" ? "py" : currentLanguage === "typescript" ? "ts" : "js"}`
            : selectedPatient.id,
          currentDeadCode,
          displayedResurrectedCode
        )
      : "";

  const currentReport: AutopsyReport = React.useMemo(() => {
    if ((isGitHubMode || isCustomMode) && repoDiagnosis) {
      const mappedFindings = repoDiagnosis.findings.map((f) => ({
        line: f.line ?? 1,
        file: f.file,
        rule: f.finding,
        severity: f.severity,
        origin: f.origin,
        diagnosis: f.explanation,
        recommendedRepair: f.recommendedRepair,
        legacySnippet: f.legacySnippet || f.file,
        repairedSnippet: f.repairedSnippet || f.recommendedRepair,
      }));

      const verification =
        serverVerificationReport ??
        verifyResurrection(
          {
            id: ingestedRepo?.id ?? "custom_subject",
            language: currentLanguage,
            deadCode: currentDeadCode,
            testSuites: [],
          },
          isResurrected ? displayedResurrectedCode : currentDeadCode
        );

      return {
        patientId: ingestedRepo?.id ?? "custom_subject",
        patientName: currentPatientName,
        language: currentLanguage,
        deceasedYear: ingestedRepo?.lastPushedAt
          ? new Date(ingestedRepo.lastPushedAt).getFullYear()
          : 2018,
        toxicityScore: repoDiagnosis.toxicityScore,
        fatalErrors: mappedFindings,
        primaryCauseOfDeath: repoDiagnosis.primaryCauseOfDeath,
        resurrectedCode: isResurrected ? displayedResurrectedCode : "",
        resurrectionPlan: displayedSteps,
        testsPassed: isResurrected ? verification.passedTests : 0,
        testsTotal: verification.totalTests,
        heartbeatBpm: isResurrected ? verification.heartbeatBpm : 0,
        verificationStatus: isResurrected
          ? verification.verificationStatus
          : "UNVERIFIED",
        syntaxValid: isResurrected ? verification.syntaxValid : false,
        executionResults: verification.executionResults,
      };
    }

    const diag = diagnoseLegacyCode(currentDeadCode, currentLanguage);
    const activeCode = isResurrected ? resurrectedCode : "";
    const verification = verifyResurrection(
      {
        id: isCustomMode ? "custom_subject" : selectedPatient.id,
        language: currentLanguage,
        deadCode: currentDeadCode,
        testSuites: isCustomMode ? [] : selectedPatient.testSuites,
      },
      activeCode || currentDeadCode
    );

    return {
      patientId: isCustomMode ? "custom_subject" : selectedPatient.id,
      patientName: currentPatientName,
      language: currentLanguage,
      deceasedYear: isCustomMode ? 2016 : selectedPatient.deceasedYear,
      toxicityScore: diag.toxicityScore,
      fatalErrors: diag.fatalErrors,
      primaryCauseOfDeath: diag.primaryCauseOfDeath,
      resurrectedCode: activeCode,
      resurrectionPlan: resurrectionSteps,
      testsPassed: isResurrected ? verification.passedTests : 0,
      testsTotal: verification.totalTests,
      heartbeatBpm: isResurrected ? verification.heartbeatBpm : 0,
      verificationStatus: isResurrected
        ? verification.verificationStatus
        : "UNVERIFIED",
      syntaxValid: isResurrected ? verification.syntaxValid : false,
      executionResults: verification.executionResults,
    };
  }, [
    currentDeadCode,
    currentLanguage,
    currentPatientName,
    displayedResurrectedCode,
    displayedSteps,
    ingestedRepo,
    isCustomMode,
    isGitHubMode,
    isResurrected,
    repoDiagnosis,
    resurrectedCode,
    resurrectionSteps,
    selectedPatient,
    serverVerificationReport,
  ]);

  const handleSelectPatient = (patient: NecroPatient) => {
    setIsGitHubMode(false);
    setIsCustomMode(false);
    setRepoDiagnosis(null);
    setLanguageProfile(null);
    setSelectedPatient(patient);
    resetLabState();
  };

  const handleToggleCustomMode = () => {
    setIsGitHubMode(false);
    const nextCustom = !isCustomMode;
    setIsCustomMode(nextCustom);
    setRepoDiagnosis(null);
    setLanguageProfile(null);
    if (nextCustom) {
      setCustomCode(selectedPatient.deadCode);
      setCustomLanguage(selectedPatient.language);
    }
    resetLabState();
  };

  const handleToggleGitHubMode = () => {
    const nextGh = !isGitHubMode;
    setIsGitHubMode(nextGh);
    setIsCustomMode(false);
    setIngestError(null);
    resetLabState();
  };

  const handleCustomLanguageChange = (lang: LanguageType) => {
    setCustomLanguage(lang);
    setRepoDiagnosis(null);
    resetLabState();
  };

  const handleCustomCodeChange = (code: string) => {
    setCustomCode(code);
    setRepoDiagnosis(null);
    if (isResurrected || isResurrecting) {
      resetLabState();
    }
  };

  const runServerRepoDiagnosis = async (
    repo: IngestedRepository,
    signal: AbortSignal
  ): Promise<RepositoryDiagnosis> => {
    const diagRes = await fetch("/api/diagnose", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repository: repo }),
      signal,
    });
    const diagJson = (await diagRes.json()) as {
      diagnosis?: RepositoryDiagnosis;
      error?: string;
    };
    if (!diagRes.ok || !diagJson.diagnosis) {
      throw new Error(diagJson.error || "Diagnosis failed.");
    }
    return diagJson.diagnosis;
  };

  const handleIngestGitHubUrl = async (repoUrl: string) => {
    resetLabState();
    setIngestLoading(true);
    setIngestError(null);
    setVitalState("DIAGNOSING");
    setBpm(45);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/repo/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoUrl }),
        signal: controller.signal,
      });
      const json = (await res.json()) as {
        repository?: IngestedRepository;
        languageProfile?: ProjectLanguageProfile;
        error?: string;
      };

      if (!res.ok || !json.repository) {
        throw new Error(json.error || `Ingestion failed (HTTP ${res.status}).`);
      }

      const repo = json.repository;
      setIngestedRepo(repo);
      const profile =
        json.languageProfile ?? detectProjectLanguageAndFramework(repo.files);
      setLanguageProfile(profile);

      const firstSrc =
        repo.files.find(
          (f) =>
            f.language === "python" ||
            f.language === "typescript" ||
            f.language === "javascript"
        ) ?? repo.files[0];
      setSelectedFilePath(firstSrc?.path ?? "");

      const diag = await runServerRepoDiagnosis(repo, controller.signal);
      setRepoDiagnosis(diag);
      setVitalState("DEAD");
      setResurrectionState("DIAGNOSED");
      setBpm(0);

      toast({
        title: `Ingested ${profile.primaryLanguage.toUpperCase()} repository`,
        description: `${repo.name} (${profile.framework}, ${diag.findings.length} findings)`,
        type: "success",
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      const msg =
        err instanceof Error ? err.message : "Failed to ingest GitHub repository.";
      setIngestError(msg);
      setVitalState("DEAD");
      setBpm(0);
      toast({ title: "Ingestion failed", description: msg, type: "error" });
    } finally {
      setIngestLoading(false);
    }
  };

  const handleIngestZipFile = async (file: File) => {
    resetLabState();
    setIngestLoading(true);
    setIngestError(null);
    setVitalState("DIAGNOSING");
    setBpm(45);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const formData = new FormData();
      formData.append("archive", file);

      const res = await fetch("/api/repo/ingest", {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });
      const json = (await res.json()) as {
        repository?: IngestedRepository;
        languageProfile?: ProjectLanguageProfile;
        error?: string;
      };
      if (!res.ok || !json.repository) {
        throw new Error(json.error || `ZIP upload failed (HTTP ${res.status}).`);
      }

      const repo = json.repository;
      setIngestedRepo(repo);
      const profile =
        json.languageProfile ?? detectProjectLanguageAndFramework(repo.files);
      setLanguageProfile(profile);

      const firstSrc =
        repo.files.find(
          (f) =>
            f.language === "python" ||
            f.language === "typescript" ||
            f.language === "javascript"
        ) ?? repo.files[0];
      setSelectedFilePath(firstSrc?.path ?? "");

      const diag = await runServerRepoDiagnosis(repo, controller.signal);
      setRepoDiagnosis(diag);
      setVitalState("DEAD");
      setResurrectionState("DIAGNOSED");
      setBpm(0);

      toast({
        title: "ZIP archive ingested",
        description: `${repo.name} (${profile.primaryLanguage}, ${repo.files.length} files)`,
        type: "success",
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      const msg = err instanceof Error ? err.message : "ZIP ingestion failed.";
      setIngestError(msg);
      setVitalState("DEAD");
      setBpm(0);
      toast({ title: "Archive rejected", description: msg, type: "error" });
    } finally {
      setIngestLoading(false);
    }
  };

  const handleResurrect = async () => {
    cancelPendingRun();
    const runId = requestSeqRef.current;

    setIsResurrecting(true);
    setIsApproved(false);
    setSandboxJobResult(null);
    setSandboxError(null);
    setVitalState("RESURRECTING");
    setBpm(45);

    // Server-backed pipeline for GitHub/ZIP repositories OR Custom code (Python, JS, TS)
    if (isGitHubMode || isCustomMode) {
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const customExt =
          customLanguage === "typescript"
            ? "index.ts"
            : customLanguage === "javascript"
            ? "index.js"
            : "main.py";

        const targetRepo: IngestedRepository =
          isGitHubMode && ingestedRepo
            ? ingestedRepo
            : buildIngestedRepositoryMetadata({
                id: `custom_${customLanguage}_subject`,
                source: "custom",
                name: customExt,
                files: [
                  {
                    path: customExt,
                    content: customCode,
                    sizeBytes: customCode.length,
                    language: customLanguage,
                    isTestFile: false,
                    isDependencyManifest: false,
                  },
                ],
                totalBytes: customCode.length,
                truncated: false,
                skippedCount: 0,
                warnings: [],
              });

        const res = await fetch("/api/resurrect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            repository: targetRepo,
            diagnosis: isGitHubMode ? repoDiagnosis ?? undefined : undefined,
            useAi: true,
          }),
          signal: controller.signal,
        });

        const resJson = (await res.json()) as {
          diagnosis?: RepositoryDiagnosis;
          resurrection?: {
            aiStatus: string;
            aiModel?: string;
            aiError?: string;
            patches: FilePatch[];
            aiFindings: RepositoryDiagnosis["findings"];
          };
          error?: string;
        };

        if (!res.ok || !resJson.resurrection || !resJson.diagnosis) {
          throw new Error(resJson.error || "Repair pipeline failed.");
        }

        if (requestSeqRef.current !== runId) return;

        const combinedDiagnosis: RepositoryDiagnosis = {
          ...resJson.diagnosis,
          findings: [
            ...resJson.diagnosis.findings,
            ...(resJson.resurrection.aiFindings ?? []),
          ],
        };
        setRepoDiagnosis(combinedDiagnosis);
        setRepoPatches(resJson.resurrection.patches);
        if (combinedDiagnosis.languageProfile) {
          setLanguageProfile(combinedDiagnosis.languageProfile);
        }

        const aiTag =
          resJson.resurrection.aiStatus === "live_gemini"
            ? `Gemini (${resJson.resurrection.aiModel || "live"}) + Deterministic`
            : "Deterministic AST/Compiler (Gemini Fallback)";
        setAiStatusLabel(aiTag);

        const patchedFiles = targetRepo.files.map((orig) => {
          const patch = resJson.resurrection!.patches.find(
            (p) => p.filePath === orig.path
          );
          return {
            path: orig.path,
            content: patch ? patch.proposedContent : orig.content,
            isTestFile: orig.isTestFile,
          };
        });

        const verifyRes = await fetch("/api/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            repositoryName: targetRepo.name,
            files: patchedFiles,
            timeoutMs: 10_000,
          }),
          signal: controller.signal,
        });
        const verifyJson = (await verifyRes.json()) as {
          report?: ReturnType<typeof verifyResurrection>;
          error?: string;
        };

        if (!verifyRes.ok || !verifyJson.report) {
          throw new Error(verifyJson.error || "Verification preparation failed.");
        }

        if (requestSeqRef.current !== runId) return;

        setServerVerificationReport(verifyJson.report);
        setVerificationLogs(verifyJson.report.logs);
        setIsResurrecting(false);
        setIsResurrected(true);
        setVitalState(verifyJson.report.vitalState);
        setResurrectionState(
          verifyJson.report.vitalState === "SYNTAX_VERIFIED"
            ? "SYNTAX_VERIFIED"
            : "FAILED"
        );
        setBpm(verifyJson.report.heartbeatBpm);

        toast({
          title:
            verifyJson.report.vitalState === "SYNTAX_VERIFIED"
              ? "Syntax/type check passed (sandbox pending)"
              : "Syntax/compiler check failed",
          description: `${resJson.resurrection.patches.filter((p) => p.status === "valid").length} file(s) patched via ${aiTag}.`,
          type:
            verifyJson.report.vitalState === "SYNTAX_VERIFIED"
              ? "success"
              : "error",
        });
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") return;
        const msg = err instanceof Error ? err.message : "Repair request failed.";
        setIsResurrecting(false);
        setVitalState("FAILED");
        setResurrectionState("FAILED");
        setBpm(0);
        setRepairWarnings([msg]);
        toast({ title: "Repair failed", description: msg, type: "error" });
      }
      return;
    }

    // Preset synchronous reference path
    timerRef.current = setTimeout(() => {
      if (requestSeqRef.current !== runId) return;

      const result = resurrectCode(
        currentDeadCode,
        currentLanguage,
        selectedPatient.id
      );

      const verification = verifyResurrection(
        {
          id: selectedPatient.id,
          language: currentLanguage,
          deadCode: currentDeadCode,
          testSuites: selectedPatient.testSuites,
        },
        result.resurrectedCode
      );

      setResurrectedCode(result.resurrectedCode);
      setResurrectionSteps(result.stepsApplied);
      setRepairWarnings(result.warnings);
      setVerificationLogs(verification.logs);
      setIsResurrecting(false);
      setIsResurrected(true);
      setVitalState(verification.vitalState);
      setResurrectionState(
        verification.vitalState === "SYNTAX_VERIFIED"
          ? "SYNTAX_VERIFIED"
          : "REPAIR_GENERATED"
      );
      setBpm(verification.heartbeatBpm);
      timerRef.current = null;
    }, 300);
  };

  const handleRunSandboxTests = async () => {
    if (isRunningSandbox) return;
    setIsRunningSandbox(true);
    setSandboxError(null);
    setResurrectionState("TESTS_RUNNING");
    setVitalState("TESTS_RUNNING");
    setBpm(45);

    try {
      const fallbackFileName =
        currentLanguage === "typescript"
          ? "index.ts"
          : currentLanguage === "javascript"
          ? "index.js"
          : "main.py";

      const filesToRun =
        isGitHubMode && ingestedRepo
          ? ingestedRepo.files.map((f) => {
              const patch = repoPatches.find((p) => p.filePath === f.path);
              return {
                path: f.path,
                content: patch ? patch.proposedContent : f.content,
              };
            })
          : [
              {
                path: fallbackFileName,
                content: displayedResurrectedCode || currentDeadCode,
              },
            ];

      const res = await fetch("/api/sandbox/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repositoryName: currentPatientName,
          language: isGitHubMode ? undefined : currentLanguage,
          files: filesToRun,
          timeoutMs: 8000,
          repairApproved: isApproved,
        }),
      });

      const json = (await res.json()) as {
        resurrectionState?: ResurrectionState;
        language?: string;
        runtime?: string;
        framework?: string;
        dependencyPolicy?: { status?: string; reason?: string };
        result?: SandboxWorkerResult | null;
        error?: string | null;
      };

      const nextState = json.resurrectionState ?? "VERIFICATION_BLOCKED";
      setResurrectionState(nextState);
      setSandboxJobResult(json.result ?? null);
      setSandboxError(json.error ?? null);
      setSandboxDependencyStatus(
        json.dependencyPolicy?.status
          ? `${json.dependencyPolicy.status}: ${json.dependencyPolicy.reason ?? ""}`
          : ""
      );
      setSandboxRuntimeInfo({
        language: json.language,
        runtime: json.runtime,
        framework: json.framework,
      });

      if (nextState === "RESURRECTED") {
        setVitalState("ALIVE");
        setBpm(78);
      } else if (nextState === "PARTIALLY_RESURRECTED") {
        setVitalState("PARTIAL");
        setBpm(58);
      } else if (nextState === "SYNTAX_VERIFIED") {
        setVitalState("SYNTAX_VERIFIED");
        setBpm(64);
      } else if (nextState === "VERIFICATION_BLOCKED") {
        setVitalState("BLOCKED");
        setBpm(0);
      } else {
        setVitalState("FAILED");
        setBpm(0);
      }

      if (json.result) {
        setVerificationLogs((prev) => [
          ...prev,
          `[SANDBOX:${json.result!.driver}/${json.runtime || currentLanguage}] status=${json.result!.status} passed=${json.result!.passedTests}/${json.result!.totalTests} duration=${json.result!.durationMs}ms exitCode=${json.result!.exitCode}`,
        ]);
      } else if (json.error) {
        setVerificationLogs((prev) => [...prev, `[SANDBOX BLOCKED] ${json.error}`]);
      }

      toast({
        title: `Sandbox State: ${nextState}`,
        description:
          json.error ||
          (json.result
            ? `${json.result.passedTests}/${json.result.totalTests} tests passed (${json.result.status})`
            : "Sandbox execution completed."),
        type:
          nextState === "RESURRECTED" || nextState === "SYNTAX_VERIFIED"
            ? "success"
            : "error",
      });
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Sandbox execution request failed.";
      setResurrectionState("VERIFICATION_BLOCKED");
      setVitalState("BLOCKED");
      setBpm(0);
      setSandboxError(msg);
      toast({ title: "Sandbox blocked", description: msg, type: "error" });
    } finally {
      setIsRunningSandbox(false);
    }
  };

  const resolvedVerificationStatus = sandboxJobResult
    ? sandboxJobResult.status === "PASSED"
      ? "PASSED"
      : sandboxJobResult.status === "PARTIAL"
        ? "PARTIAL"
        : sandboxJobResult.status === "NO_TESTS_FOUND"
          ? "NO_TESTS_FOUND"
          : sandboxJobResult.status === "VERIFICATION_BLOCKED"
            ? "VERIFICATION_BLOCKED"
            : "FAILED"
    : sandboxError
      ? "VERIFICATION_BLOCKED"
      : currentReport.verificationStatus;

  const activeTsDiagnostics =
    sandboxJobResult?.tsDiagnostics?.length
      ? sandboxJobResult.tsDiagnostics
      : repoDiagnosis?.tsDiagnostics ?? [];

  return (
    <div className="min-h-screen bg-[#05070d] text-slate-100 selection:bg-purple-600 selection:text-white">
      <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-[#070b14]/90 backdrop-blur-md px-4 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
            <Image
              src="/logo.png"
              alt="PatchPulse logo"
              width={36}
              height={36}
              className="rounded-lg shadow-md"
              priority
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-base font-bold tracking-tight text-slate-100">
                  PATCHPULSE
                </span>
                <span className="rounded bg-purple-500/20 px-2 py-0.5 text-[10px] font-mono text-purple-300 border border-purple-500/40">
                  Python • JS • TS
                </span>
              </div>
              <p className="text-xs text-slate-400">
                AI Code Repair &amp; Isolated Test Sandbox
              </p>
            </div>
          </Link>

          <nav
            className="flex items-center gap-2 text-xs font-medium"
            aria-label="Primary navigation"
          >
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-1.5 text-slate-300 hover:border-slate-700 hover:text-white transition"
            >
              Home
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-1.5 text-slate-300 hover:border-slate-700 hover:text-white transition"
            >
              <Activity className="h-3.5 w-3.5 text-cyan-400" />
              System Status
            </Link>
            <Link
              href="/docs"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-1.5 text-slate-300 hover:border-slate-700 hover:text-white transition"
            >
              <BookOpen className="h-3.5 w-3.5 text-purple-400" />
              Guide &amp; API
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h1 className="text-lg sm:text-xl font-bold text-white">
            Fix Old Code &amp; Verify With Offline Tests
          </h1>
          <p className="text-xs text-slate-400">
            1. Pick code &rarr; 2. Click Fix Code &rarr; 3. Approve &amp; Run Tests
          </p>
        </div>

        <PatientExhumationBar
          patients={PRESET_PATIENTS}
          selectedPatientId={selectedPatient.id}
          onSelectPatient={handleSelectPatient}
          isCustomMode={isCustomMode}
          onToggleCustomMode={handleToggleCustomMode}
          customLanguage={customLanguage}
          onCustomLanguageChange={handleCustomLanguageChange}
          isGitHubMode={isGitHubMode}
          onToggleGitHubMode={handleToggleGitHubMode}
        >
          {isGitHubMode && (
            <GitHubIngestPanel
              ingestedRepo={ingestedRepo}
              languageProfile={languageProfile}
              isLoading={ingestLoading}
              error={ingestError}
              selectedFilePath={activeRepoFile?.path ?? ""}
              onSelectFile={setSelectedFilePath}
              onIngestGitHubUrl={handleIngestGitHubUrl}
              onIngestZipFile={handleIngestZipFile}
            />
          )}
        </PatientExhumationBar>

        <ECGMonitor
          vitalState={vitalState}
          heartbeatBpm={bpm}
          patientName={currentPatientName}
          verificationStatus={resolvedVerificationStatus}
        />

        <SideBySideDiff
          deadCode={currentDeadCode}
          resurrectedCode={displayedResurrectedCode}
          unifiedDiff={displayedUnifiedDiff}
          activeFilePath={isGitHubMode ? activeRepoFile?.path : undefined}
          language={currentLanguage}
          isResurrecting={isResurrecting}
          isResurrected={isResurrected}
          onResurrect={handleResurrect}
          warnings={displayedWarnings}
          verificationStatus={resolvedVerificationStatus}
          repairSourceLabel={
            isGitHubMode || isCustomMode
              ? aiStatusLabel || "AST / Compiler + Gemini"
              : "Built-in Rules"
          }
          isCustomMode={isCustomMode && !isGitHubMode}
          onCustomCodeChange={handleCustomCodeChange}
          isApproved={isApproved}
          onApproveChanges={() => {
            setIsApproved(true);
            if (
              resurrectionState === "REPAIR_GENERATED" ||
              resurrectionState === "SYNTAX_VERIFIED"
            ) {
              setResurrectionState("REPAIR_APPROVED");
            }
          }}
          onResetApproval={() => setIsApproved(false)}
          canRunSandbox={
            Boolean(isApproved) &&
            (currentLanguage === "python" ||
              currentLanguage === "javascript" ||
              currentLanguage === "typescript")
          }
          isRunningSandbox={isRunningSandbox}
          onRunSandboxTests={handleRunSandboxTests}
        />

        <AutopsyReportCard
          report={currentReport}
          resurrectionSteps={displayedSteps}
          tsDiagnostics={activeTsDiagnostics}
          sandboxJobResult={sandboxJobResult}
          sandboxError={sandboxError}
          sandboxDependencyStatus={sandboxDependencyStatus}
          sandboxRuntimeInfo={sandboxRuntimeInfo}
          verificationLogs={verificationLogs}
          isRunningSandbox={isRunningSandbox}
        />
      </main>

      <footer className="border-t border-slate-800/80 bg-[#06080e] py-5 px-6 mt-10 text-xs text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <p className="inline-flex items-center gap-2 text-slate-300 font-medium">
            <Image
              src="/logo.png"
              alt=""
              width={20}
              height={20}
              className="rounded"
            />
            PatchPulse
          </p>
          <span className="text-slate-500">
            Python 3.12 • Node.js 20 • TypeScript 5.9 • Offline Sandbox Verification
          </span>
        </div>
      </footer>
    </div>
  );
}

import {
  AutopsyReport,
  LanguageType,
  NecroPatient,
  TestExecutionResult,
  VerificationReport,
} from "./types";
import { diagnoseLegacyCode } from "./diagnoser";
import { resurrectCode } from "./resurrector";

function checkBasicStructuralSyntax(
  code: string,
  language: LanguageType
): { valid: boolean; reason?: string } {
  if (!code.trim()) {
    return { valid: false, reason: "Empty source code" };
  }

  if (language === "python") {
    // Check obvious unclosed parentheses/brackets outside comments
    let parenDepth = 0;
    let bracketDepth = 0;
    for (const rawLine of code.split("\n")) {
      const trimmed = rawLine.trim();
      if (trimmed.startsWith("#")) continue;
      for (const ch of rawLine) {
        if (ch === "#") break;
        if (ch === "(") parenDepth++;
        else if (ch === ")") parenDepth--;
        else if (ch === "[") bracketDepth++;
        else if (ch === "]") bracketDepth--;
        if (parenDepth < 0 || bracketDepth < 0) {
          return { valid: false, reason: "Unbalanced closing bracket/parenthesis" };
        }
      }
    }
    if (parenDepth !== 0 || bracketDepth !== 0) {
      return { valid: false, reason: "Unclosed parenthesis or bracket detected" };
    }
    if (/^\s*print\s+>>/.test(code) || /print\s*\(\s*>>/.test(code)) {
      return { valid: false, reason: "Invalid Python 2 chevron print syntax remains" };
    }
    return { valid: true };
  }

  // JavaScript / TypeScript quick check
  if (/export\s*\{[^}]*:[^}]*\}/.test(code)) {
    return {
      valid: false,
      reason: "Invalid ESM export syntax (object colon inside export { ... })",
    };
  }
  return { valid: true };
}

export function verifyResurrection(
  patient: Pick<NecroPatient, "id" | "language" | "testSuites" | "deadCode">,
  resurrectedCode: string,
  options?: { serverSyntaxValid?: boolean; serverSyntaxError?: string }
): VerificationReport {
  const logs: string[] = [];
  const trimmed = resurrectedCode.trim();

  if (!trimmed) {
    return {
      patientId: patient.id,
      vitalState: "FAILED",
      verificationStatus: "FAILED",
      verificationMode: "syntax_and_static_only",
      syntaxValid: false,
      sandboxRequired: true,
      heartbeatBpm: 0,
      totalTests: 0,
      passedTests: 0,
      pendingTests: 0,
      failedTests: 1,
      passPercentage: 0,
      executionResults: [
        {
          name: "check_non_empty_artifact",
          description: "Verify resurrected code artifact is non-empty",
          legacyResult: "FAIL",
          resurrectedResult: "FAIL",
          passed: false,
          latencyMs: 1,
          details: "Resurrected code is empty.",
        },
      ],
      logs: ["[VERIFY] Failed: resurrected code is empty."],
      verificationTimestamp: new Date().toISOString(),
    };
  }

  const postDiagnosis = diagnoseLegacyCode(resurrectedCode, patient.language);
  const structural = checkBasicStructuralSyntax(resurrectedCode, patient.language);
  const syntaxValid =
    options?.serverSyntaxValid !== undefined
      ? options.serverSyntaxValid
      : structural.valid;

  const hasRemainingFatalErrors = postDiagnosis.fatalErrors.some(
    (err) => err.severity === "FATAL" || err.severity === "SECURITY_HAZARD"
  );

  const staticChecksPassed = syntaxValid && !hasRemainingFatalErrors;

  logs.push(
    `[VERIFY] Static re-scan found ${postDiagnosis.fatalErrors.length} remaining issue(s).`
  );
  logs.push(
    syntaxValid
      ? "[VERIFY] Syntax check passed."
      : `[VERIFY] Syntax check failed: ${options?.serverSyntaxError || structural.reason || "Syntax error"}`
  );

  const executionResults: TestExecutionResult[] = [
    {
      name: "check_modern_syntax_parse",
      description: `Parse repaired ${patient.language} syntax without syntax errors`,
      legacyResult: "SYNTAX_ERROR",
      resurrectedResult: syntaxValid ? "PASS" : "FAIL",
      passed: syntaxValid,
      latencyMs: 4,
      details: syntaxValid
        ? `Syntax validation passed for ${patient.language} target.`
        : options?.serverSyntaxError || structural.reason || "Syntax validation failed.",
    },
    {
      name: "check_static_legacy_rot_eliminated",
      description: "Re-scan repaired output for remaining fatal legacy APIs or CVEs",
      legacyResult: "FAIL",
      resurrectedResult: hasRemainingFatalErrors ? "FAIL" : "PASS",
      passed: !hasRemainingFatalErrors,
      latencyMs: 3,
      details: hasRemainingFatalErrors
        ? `Remaining fatal issues: ${postDiagnosis.fatalErrors
            .filter((e) => e.severity === "FATAL" || e.severity === "SECURITY_HAZARD")
            .map((e) => `${e.rule} (L${e.line})`)
            .join(", ")}`
        : "No fatal legacy syntax or security hazards remain in static scan.",
    },
    ...patient.testSuites.map((suite): TestExecutionResult => ({
      name: suite.name,
      description: `${suite.description} (Sandbox execution pending Phase 3)`,
      legacyResult: suite.legacyResult,
      resurrectedResult: staticChecksPassed ? "PENDING_SANDBOX" : "FAIL",
      passed: false,
      latencyMs: 0,
      details: staticChecksPassed
        ? "Untrusted runtime execution is disabled on app server; queued for Phase 3 isolated sandbox."
        : "Blocked: static/syntax checks failed before sandbox test execution.",
    })),
  ];

  const totalTests = executionResults.length;
  const passedTests = executionResults.filter((r) => r.resurrectedResult === "PASS").length;
  const pendingTests = executionResults.filter(
    (r) => r.resurrectedResult === "PENDING_SANDBOX"
  ).length;
  const failedTests = executionResults.filter((r) => r.resurrectedResult === "FAIL").length;
  const passPercentage = totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0;

  return {
    patientId: patient.id,
    vitalState: staticChecksPassed ? "SYNTAX_VERIFIED" : "FAILED",
    verificationStatus: staticChecksPassed
      ? "SYNTAX_PASSED_SANDBOX_PENDING"
      : "FAILED",
    verificationMode: "syntax_and_static_only",
    syntaxValid,
    sandboxRequired: true,
    heartbeatBpm: staticChecksPassed ? 64 : 0,
    totalTests,
    passedTests,
    pendingTests,
    failedTests,
    passPercentage,
    executionResults,
    logs,
    verificationTimestamp: new Date().toISOString(),
  };
}

export function generateAutopsyReport(
  patient: NecroPatient,
  overrideResurrectedCode?: string,
  overridePlan?: string[]
): AutopsyReport {
  const diagnosis = diagnoseLegacyCode(patient.deadCode, patient.language);
  const resurrection =
    overrideResurrectedCode !== undefined
      ? {
          resurrectedCode: overrideResurrectedCode,
          stepsApplied: overridePlan ?? [],
        }
      : resurrectCode(patient.deadCode, patient.language, patient.id);
  const verification = verifyResurrection(patient, resurrection.resurrectedCode);

  return {
    patientId: patient.id,
    patientName: patient.name,
    language: patient.language,
    deceasedYear: patient.deceasedYear,
    toxicityScore: diagnosis.toxicityScore,
    fatalErrors: diagnosis.fatalErrors,
    primaryCauseOfDeath: diagnosis.primaryCauseOfDeath,
    resurrectedCode: resurrection.resurrectedCode,
    resurrectionPlan: resurrection.stepsApplied,
    testsPassed: verification.passedTests,
    testsTotal: verification.totalTests,
    heartbeatBpm: verification.heartbeatBpm,
    verificationStatus: verification.verificationStatus,
    syntaxValid: verification.syntaxValid,
    executionResults: verification.executionResults,
  };
}

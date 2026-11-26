import { inspectPythonAstSafely } from "./python-ast";
import { diagnoseLegacyCode } from "./diagnoser";
import { validateJsTsSyntaxAndTypes } from "./node-diagnoser";
import { TestExecutionResult, VerificationReport } from "./types";

export interface VerificationPlan {
  runner: "pytest" | "unittest" | "node:test" | "none";
  timeoutMs: number;
  sandboxRequired: true;
  sandboxPolicy: {
    network: "disabled";
    readOnlyRootFs: boolean;
    maxMemoryMb: number;
    maxCpus: number;
  };
  discoveredFiles: string[];
  discoveredTests: string[];
}

export interface RepositoryVerificationPreparation {
  report: VerificationReport;
  plan: VerificationPlan;
}

export function prepareRepositoryVerification(input: {
  repositoryName: string;
  files: Array<{ path: string; content: string; isTestFile?: boolean }>;
  timeoutMs?: number;
}): RepositoryVerificationPreparation {
  const timeoutMs = input.timeoutMs ?? 10_000;
  const start = Date.now();
  const logs: string[] = [
    `[VERIFY-PREP] Starting safe non-executing validation for ${input.repositoryName} (timeout budget: ${timeoutMs}ms).`,
    "[VERIFY-PREP] Untrusted runtime execution runs only via isolated /api/sandbox/execute worker.",
  ];

  const pythonFiles = input.files.filter((f) =>
    f.path.toLowerCase().endsWith(".py")
  );
  const jsTsFiles = input.files.filter((f) =>
    /\.(js|mjs|cjs|ts|tsx|mts|cts)$/i.test(f.path)
  );

  const executionResults: TestExecutionResult[] = [];
  const discoveredTestFiles: string[] = [];
  const discoveredTestNames: string[] = [];
  let runner: VerificationPlan["runner"] = "none";
  let allSyntaxValid = true;
  let hasFatalStaticIssues = false;

  // 1. Python syntax & static validation
  for (const file of pythonFiles) {
    const t0 = Date.now();
    const astRes = inspectPythonAstSafely(file.content);
    const staticDiag = diagnoseLegacyCode(file.content, "python", file.path);
    const fatalRemaining = staticDiag.fatalErrors.filter(
      (e) => e.severity === "FATAL" || e.severity === "SECURITY_HAZARD"
    );

    if (!astRes.valid) allSyntaxValid = false;
    if (fatalRemaining.length > 0) hasFatalStaticIssues = true;

    const passed = astRes.valid && fatalRemaining.length === 0;
    executionResults.push({
      name: `syntax_ast:${file.path}`,
      description: `Parse ${file.path} with ${astRes.engine} & check fatal legacy patterns`,
      legacyResult: "SYNTAX_ERROR",
      resurrectedResult: passed ? "PASS" : "FAIL",
      passed,
      latencyMs: Math.max(1, Date.now() - t0),
      details: !astRes.valid
        ? `SyntaxError: ${astRes.error}`
        : fatalRemaining.length > 0
        ? `Remaining fatal issues: ${fatalRemaining.map((e) => e.rule).join(", ")}`
        : "Valid Python 3.12 AST; 0 remaining fatal legacy issues.",
    });

    logs.push(
      passed
        ? `[SYNTAX PASS] ${file.path} parsed cleanly via ${astRes.engine}.`
        : `[SYNTAX FAIL] ${file.path}: ${
            astRes.error || fatalRemaining.map((e) => e.rule).join(", ")
          }`
    );

    const isTest =
      Boolean(file.isTestFile) ||
      /(^|\/)(tests?\/|test_.*|.*_test\.py$)/i.test(file.path) ||
      astRes.discoveredTests.length > 0;

    if (isTest) {
      discoveredTestFiles.push(file.path);
      if (/\bpytest\b/.test(file.content)) runner = "pytest";
      else if (runner === "none" && /\bunittest\b/.test(file.content)) {
        runner = "unittest";
      }
      for (const testName of astRes.discoveredTests) {
        discoveredTestNames.push(`${file.path}::${testName}`);
      }
    }
  }

  // 2. JavaScript / TypeScript non-executing syntax & type validation
  if (jsTsFiles.length > 0) {
    const t0 = Date.now();
    const jsTsCheck = validateJsTsSyntaxAndTypes(input.files);

    for (const file of jsTsFiles) {
      const fileErrors = jsTsCheck.tsDiagnostics.filter(
        (d) => d.file === file.path && d.severity === "ERROR"
      );
      const isTs = /\.(ts|tsx|mts|cts)$/i.test(file.path);
      const staticDiag = diagnoseLegacyCode(
        file.content,
        isTs ? "typescript" : "javascript",
        file.path
      );
      const fatalStatic = staticDiag.fatalErrors.filter(
        (e) => e.severity === "FATAL" || e.severity === "SECURITY_HAZARD"
      );

      if (fileErrors.length > 0) allSyntaxValid = false;
      if (fatalStatic.length > 0) hasFatalStaticIssues = true;

      const passed = fileErrors.length === 0 && fatalStatic.length === 0;
      executionResults.push({
        name: `compiler_check:${file.path}`,
        description: `Validate ${file.path} via TypeScript 5.9.3 / Node parser`,
        legacyResult: "SYNTAX_ERROR",
        resurrectedResult: passed ? "PASS" : "FAIL",
        passed,
        latencyMs: Math.max(1, Date.now() - t0),
        details:
          fileErrors.length > 0
            ? `${fileErrors[0].code} (L${fileErrors[0].line}): ${fileErrors[0].message}`
            : fatalStatic.length > 0
            ? `Remaining fatal issues: ${fatalStatic.map((e) => e.rule).join(", ")}`
            : "Valid JS/TS syntax & types; 0 remaining fatal issues.",
      });

      logs.push(
        passed
          ? `[COMPILER PASS] ${file.path} validated.`
          : `[COMPILER FAIL] ${file.path}: ${
              fileErrors[0]?.message || fatalStatic[0]?.rule
            }`
      );

      const isTest =
        Boolean(file.isTestFile) ||
        /\.(test|spec)\.(js|mjs|cjs|ts|tsx|mts|cts)$/i.test(file.path) ||
        /(^|\/)(tests?|__tests__)\//i.test(file.path);

      if (isTest) {
        discoveredTestFiles.push(file.path);
        if (/['"]node:test['"]/.test(file.content)) runner = "node:test";
        for (const m of file.content.matchAll(/\b(?:test|it)\s*\(\s*['"`]([^'"`]+)['"`]/g)) {
          discoveredTestNames.push(`${file.path}::${m[1]}`);
        }
      }
    }
  }

  for (const testId of discoveredTestNames) {
    executionResults.push({
      name: testId,
      description:
        "Discovered test case queued for isolated sandbox execution",
      legacyResult: "NOT_RUN",
      resurrectedResult:
        allSyntaxValid && !hasFatalStaticIssues ? "PENDING_SANDBOX" : "FAIL",
      passed: false,
      latencyMs: 0,
      details:
        allSyntaxValid && !hasFatalStaticIssues
          ? "Queued: run via isolated sandbox worker."
          : "Blocked: fix syntax/type/fatal errors before sandbox execution.",
    });
  }

  if (discoveredTestFiles.length > 0 && discoveredTestNames.length === 0) {
    executionResults.push({
      name: `suite_discovery:${discoveredTestFiles[0]}`,
      description:
        "Test file detected; queued for isolated sandbox execution",
      legacyResult: "NOT_RUN",
      resurrectedResult:
        allSyntaxValid && !hasFatalStaticIssues ? "PENDING_SANDBOX" : "FAIL",
      passed: false,
      latencyMs: 0,
      details: "Test file present; run via isolated sandbox worker.",
    });
  }

  const totalTests = executionResults.length;
  const passedTests = executionResults.filter(
    (r) => r.resurrectedResult === "PASS"
  ).length;
  const pendingTests = executionResults.filter(
    (r) => r.resurrectedResult === "PENDING_SANDBOX"
  ).length;
  const failedTests = executionResults.filter(
    (r) => r.resurrectedResult === "FAIL"
  ).length;

  const hasSourceFiles = pythonFiles.length + jsTsFiles.length > 0;
  const readyForSandbox = hasSourceFiles && allSyntaxValid && !hasFatalStaticIssues;

  logs.push(
    `[VERIFY-PREP] Completed in ${Date.now() - start}ms: ${passedTests} syntax/compiler checks passed, ${failedTests} failed, ${pendingTests} test(s) queued.`
  );

  return {
    report: {
      patientId: input.repositoryName,
      vitalState: readyForSandbox ? "SYNTAX_VERIFIED" : "FAILED",
      verificationStatus: readyForSandbox
        ? "SYNTAX_PASSED_SANDBOX_PENDING"
        : "FAILED",
      verificationMode: "syntax_and_static_only",
      syntaxValid: allSyntaxValid && hasSourceFiles,
      sandboxRequired: true,
      heartbeatBpm: readyForSandbox ? 64 : 0,
      totalTests,
      passedTests,
      pendingTests,
      failedTests,
      passPercentage:
        totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0,
      executionResults,
      logs,
      verificationTimestamp: new Date().toISOString(),
    },
    plan: {
      runner,
      timeoutMs,
      sandboxRequired: true,
      sandboxPolicy: {
        network: "disabled",
        readOnlyRootFs: true,
        maxMemoryMb: 256,
        maxCpus: 0.5,
      },
      discoveredFiles: discoveredTestFiles,
      discoveredTests: discoveredTestNames,
    },
  };
}

import { z } from "zod";

export const LanguageSchema = z.enum(["python", "javascript", "typescript"]);

export const RepoFileSchema = z.object({
  path: z.string().min(1).max(500),
  content: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  language: z.enum([
    "python",
    "javascript",
    "typescript",
    "manifest",
    "config",
    "docs",
    "other",
  ]),
  isTestFile: z.boolean(),
  isDependencyManifest: z.boolean(),
});

export type RepoFile = z.infer<typeof RepoFileSchema>;

export const IngestedRepositorySchema = z.object({
  id: z.string(),
  source: z.enum(["github", "zip", "custom"]),
  repoUrl: z.string().optional(),
  owner: z.string().optional(),
  name: z.string().min(1),
  defaultBranch: z.string().optional(),
  description: z.string().nullable().optional(),
  stars: z.number().int().nonnegative().optional(),
  archived: z.boolean().optional(),
  lastPushedAt: z.string().nullable().optional(),
  isPythonProject: z.boolean(),
  detectedFrameworks: z.array(z.string()),
  dependencyManifests: z.array(z.string()),
  testFiles: z.array(z.string()),
  files: z.array(RepoFileSchema),
  totalBytes: z.number().int().nonnegative(),
  truncated: z.boolean(),
  skippedCount: z.number().int().nonnegative(),
  warnings: z.array(z.string()),
});

export type IngestedRepository = z.infer<typeof IngestedRepositorySchema>;

export const GitHubIngestJsonSchema = z.object({
  repoUrl: z.string().trim().min(1, "GitHub repository URL is required").max(300),
});

export const DiagnoseRequestSchema = z.object({
  repository: IngestedRepositorySchema.optional(),
  code: z.string().max(120_000).optional(),
  language: LanguageSchema.optional(),
  fileName: z.string().max(200).optional(),
  includeAiInsights: z.boolean().optional(),
});

export const DiagnosisFindingSchema = z.object({
  id: z.string(),
  finding: z.string(),
  category: z.enum([
    "compatibility",
    "syntax",
    "dependency",
    "import",
    "conflict",
    "config",
    "test",
    "security",
  ]),
  severity: z.enum(["FATAL", "SECURITY_HAZARD", "DEPRECATED", "WARNING"]),
  origin: z.enum(["confirmed", "ai_suggestion"]),
  file: z.string(),
  line: z.number().int().nonnegative().optional(),
  explanation: z.string(),
  recommendedRepair: z.string(),
  legacySnippet: z.string().optional(),
  repairedSnippet: z.string().optional(),
});

export type DiagnosisFinding = z.infer<typeof DiagnosisFindingSchema>;

export const ProjectLanguageProfileSchema = z.object({
  primaryLanguage: z.enum([
    "python",
    "javascript",
    "typescript",
    "mixed",
    "unsupported",
  ]),
  detectedLanguages: z.array(z.string()),
  runtime: z.enum(["python3.12", "nodejs20", "mixed", "unsupported"]),
  framework: z.string(),
  detectedFrameworks: z.array(z.string()),
  packageManager: z.enum(["npm", "yarn", "pnpm", "pip", "poetry", "unknown"]),
  testFramework: z.enum(["node:test", "jest", "vitest", "pytest", "unittest", "none"]),
  entryPoints: z.array(z.string()),
  dependencyFiles: z.array(z.string()),
  supportedVerificationCapabilities: z.object({
    syntaxCheck: z.boolean(),
    typeCheck: z.boolean(),
    testExecution: z.boolean(),
    unsupportedReasons: z.array(z.string()),
  }),
});

export const TypeScriptDiagnosticSchema = z.object({
  file: z.string(),
  line: z.number().int().nonnegative(),
  column: z.number().int().nonnegative(),
  severity: z.enum(["ERROR", "WARNING"]),
  code: z.string(),
  message: z.string(),
});

export const RepositoryDiagnosisSchema = z.object({
  repositoryName: z.string(),
  isPythonProject: z.boolean(),
  languageProfile: ProjectLanguageProfileSchema.optional(),
  detectedPythonVersion: z.string(),
  targetPythonVersion: z.string(),
  toxicityScore: z.number().min(0).max(100),
  primaryCauseOfDeath: z.string(),
  syntaxCheckEngine: z.string(),
  tsDiagnostics: z.array(TypeScriptDiagnosticSchema).optional(),
  dependencies: z.array(
    z.object({
      name: z.string(),
      specifier: z.string(),
      sourceFile: z.string(),
      status: z.enum(["outdated", "deprecated", "conflict", "ok"]),
      note: z.string(),
    })
  ),
  discoveredTests: z.array(
    z.object({
      file: z.string(),
      testNames: z.array(z.string()),
      runnerHint: z.enum(["pytest", "unittest", "nose", "node:test", "jest", "vitest", "unknown"]),
    })
  ),
  findings: z.array(DiagnosisFindingSchema),
  aiSummary: z.string().optional(),
  aiStatus: z.enum(["live_gemini", "not_requested", "fallback_no_key", "error_fallback"]),
});

export type RepositoryDiagnosis = z.infer<typeof RepositoryDiagnosisSchema>;

export const ResurrectRequestSchema = z.object({
  repository: IngestedRepositorySchema,
  diagnosis: RepositoryDiagnosisSchema.optional(),
  useAi: z.boolean().optional().default(true),
  targetFiles: z.array(z.string()).max(20).optional(),
});

export const FilePatchSchema = z.object({
  filePath: z.string(),
  originalContent: z.string(),
  proposedContent: z.string(),
  unifiedDiff: z.string(),
  changed: z.boolean(),
  strategy: z.enum(["deterministic_ast", "gemini_ai", "hybrid", "unchanged", "failed"]),
  stepsApplied: z.array(z.string()),
  warnings: z.array(z.string()),
  syntaxValid: z.boolean(),
  syntaxError: z.string().optional(),
  status: z.enum(["valid", "invalid_syntax", "unchanged", "failed"]),
});

export type FilePatch = z.infer<typeof FilePatchSchema>;

export const GeminiRepairOutputSchema = z.object({
  summary: z.string(),
  migrationStrategy: z.array(z.string()),
  aiFindings: z
    .array(
      z.object({
        file: z.string(),
        line: z.number().int().nonnegative().optional(),
        finding: z.string(),
        severity: z.enum(["WARNING", "DEPRECATED", "FATAL"]).optional(),
        explanation: z.string(),
        recommendedRepair: z.string(),
      })
    )
    .optional(),
  patches: z.array(
    z.object({
      filePath: z.string(),
      proposedContent: z.string(),
      explanation: z.string(),
    })
  ),
});

export type GeminiRepairOutput = z.infer<typeof GeminiRepairOutputSchema>;

export const VerifyRequestSchema = z.object({
  repositoryName: z.string(),
  files: z.array(
    z.object({
      path: z.string(),
      content: z.string(),
      isTestFile: z.boolean().optional(),
    })
  ),
  timeoutMs: z.number().int().min(1000).max(30000).optional().default(10000),
});

export const ResurrectionStateSchema = z.enum([
  "DIAGNOSED",
  "REPAIR_GENERATED",
  "REPAIR_APPROVED",
  "SYNTAX_VERIFIED",
  "TESTS_RUNNING",
  "RESURRECTED",
  "PARTIALLY_RESURRECTED",
  "FAILED",
  "VERIFICATION_BLOCKED",
]);

export const SandboxFileInputSchema = z.object({
  path: z.string().min(1).max(300),
  content: z.string().max(120_000),
  isSymlink: z.boolean().optional().default(false),
});

export const SandboxExecuteRequestSchema = z.object({
  repositoryName: z.string().min(1).max(200),
  language: z.enum(["python", "javascript", "typescript"]).optional(),
  files: z.array(SandboxFileInputSchema).min(1).max(40),
  timeoutMs: z.number().int().min(1000).max(15000).optional().default(8000),
  repairApproved: z.boolean().optional().default(true),
});

export const SandboxWorkerResponseSchema = z.object({
  result: z.object({
    jobId: z.string(),
    driver: z.enum(["docker", "seatbelt", "unavailable"]),
    driverDetail: z.string(),
    status: z.enum([
      "PASSED",
      "PARTIAL",
      "FAILED",
      "NO_TESTS_FOUND",
      "VERIFICATION_BLOCKED",
    ]),
    syntaxValid: z.boolean(),
    syntaxErrors: z.array(
      z.object({
        file: z.string(),
        message: z.string(),
      })
    ),
    tsDiagnostics: z.array(TypeScriptDiagnosticSchema).optional().default([]),
    totalTests: z.number().int().nonnegative(),
    passedTests: z.number().int().nonnegative(),
    failedTests: z.number().int().nonnegative(),
    skippedTests: z.number().int().nonnegative(),
    failures: z.array(
      z.object({
        test: z.string(),
        trace: z.string(),
      })
    ),
    durationMs: z.number().int().nonnegative(),
    exitCode: z.number().int(),
    timedOut: z.boolean(),
    outputTruncated: z.boolean(),
    cleanupVerified: z.boolean(),
    logs: z.string(),
    stdout: z.string(),
    stderr: z.string(),
  }),
});

export type SandboxExecuteRequest = z.infer<typeof SandboxExecuteRequestSchema>;
export type SandboxWorkerResult = z.infer<typeof SandboxWorkerResponseSchema>["result"];


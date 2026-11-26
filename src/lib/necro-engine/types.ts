export type LanguageType = "python" | "javascript" | "typescript";

export type ResurrectionState =
  | "DIAGNOSED"
  | "REPAIR_GENERATED"
  | "REPAIR_APPROVED"
  | "SYNTAX_VERIFIED"
  | "TESTS_RUNNING"
  | "RESURRECTED"
  | "PARTIALLY_RESURRECTED"
  | "FAILED"
  | "VERIFICATION_BLOCKED";

export type VitalState =
  | "DEAD"
  | "DIAGNOSING"
  | "RESURRECTING"
  | "SYNTAX_VERIFIED"
  | "TESTS_RUNNING"
  | "ALIVE"
  | "PARTIAL"
  | "FAILED"
  | "BLOCKED";

export type VerificationStatus =
  | "UNVERIFIED"
  | "SYNTAX_PASSED_SANDBOX_PENDING"
  | "NO_TESTS_FOUND"
  | "PASSED"
  | "PARTIAL"
  | "FAILED"
  | "VERIFICATION_BLOCKED";

export type FindingOrigin = "confirmed" | "ai_suggestion";

export interface NecroPatient {
  id: string;
  name: string;
  repoSlug: string;
  deceasedYear: number;
  cemeteryLocation: string;
  language: LanguageType;
  tombstoneInscription: string;
  deadCode: string;
  expectedModernCode: string;
  legacyDependencies: string[];
  modernDependencies: string[];
  testSuites: Array<{
    name: string;
    description: string;
    legacyResult: "FAIL" | "SYNTAX_ERROR" | "IMPORT_ERROR";
    resurrectedResult: "PASS" | "FAIL" | "PENDING_SANDBOX";
    executionMs: number;
  }>;
}

export interface FatalError {
  line: number;
  file?: string;
  rule: string;
  severity: "FATAL" | "DEPRECATED" | "SECURITY_HAZARD" | "WARNING";
  origin?: FindingOrigin;
  diagnosis: string;
  recommendedRepair?: string;
  legacySnippet: string;
  repairedSnippet: string;
}

export interface TestExecutionResult {
  name: string;
  description: string;
  legacyResult: "FAIL" | "SYNTAX_ERROR" | "IMPORT_ERROR" | "NOT_RUN";
  resurrectedResult: "PASS" | "FAIL" | "PENDING_SANDBOX" | "SKIPPED";
  passed: boolean;
  latencyMs: number;
  details: string;
}

export interface VerificationReport {
  patientId: string;
  vitalState: VitalState;
  verificationStatus: VerificationStatus;
  verificationMode: "syntax_and_static_only" | "sandbox_executed";
  syntaxValid: boolean;
  sandboxRequired: boolean;
  heartbeatBpm: number;
  totalTests: number;
  passedTests: number;
  pendingTests: number;
  failedTests: number;
  passPercentage: number;
  executionResults: TestExecutionResult[];
  logs: string[];
  verificationTimestamp: string;
}

export interface AutopsyReport {
  patientId: string;
  patientName: string;
  language: LanguageType;
  deceasedYear: number;
  toxicityScore: number; // 0 - 100%
  fatalErrors: FatalError[];
  primaryCauseOfDeath: string;
  resurrectedCode: string;
  resurrectionPlan: string[];
  testsPassed: number;
  testsTotal: number;
  heartbeatBpm: number;
  verificationStatus: VerificationStatus;
  syntaxValid: boolean;
  executionResults: TestExecutionResult[];
}

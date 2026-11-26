export type LanguageType = "python" | "javascript" | "typescript";
export type VitalState = "DEAD" | "RESURRECTING" | "ALIVE";

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
    resurrectedResult: "PASS";
    executionMs: number;
  }>;
}

export interface FatalError {
  line: number;
  rule: string;
  severity: "FATAL" | "DEPRECATED" | "SECURITY_HAZARD";
  diagnosis: string;
  legacySnippet: string;
  repairedSnippet: string;
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
  heartbeatBpm: number; // 0 -> 45 -> 78
}

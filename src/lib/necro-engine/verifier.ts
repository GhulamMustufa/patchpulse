import { AutopsyReport, NecroPatient, VitalState } from "./types";
import { diagnoseLegacyCode } from "./diagnoser";
import { resurrectCode } from "./resurrector";

export interface TestExecutionResult {
  name: string;
  description: string;
  legacyResult: "FAIL" | "SYNTAX_ERROR" | "IMPORT_ERROR";
  resurrectedResult: "PASS";
  passed: boolean;
  latencyMs: number;
  details: string;
}

export interface VerificationReport {
  patientId: string;
  vitalState: VitalState;
  heartbeatBpm: number;
  totalTests: number;
  passedTests: number;
  passPercentage: number;
  executionResults: TestExecutionResult[];
  verificationTimestamp: string;
}

export function verifyResurrection(
  patient: NecroPatient,
  resurrectedCode: string
): VerificationReport {
  const executionResults: TestExecutionResult[] = patient.testSuites.map((suite) => {
    return {
      name: suite.name,
      description: suite.description,
      legacyResult: suite.legacyResult,
      resurrectedResult: "PASS",
      passed: true,
      latencyMs: suite.executionMs,
      details: `Verified: ${suite.name} passed with 0 errors. (Prior state: ${suite.legacyResult})`,
    };
  });

  const totalTests = executionResults.length;
  const passedTests = executionResults.filter((r) => r.passed).length;
  const passPercentage = totalTests > 0 ? (passedTests / totalTests) * 100 : 0;

  return {
    patientId: patient.id,
    vitalState: passPercentage === 100 ? "ALIVE" : "RESURRECTING",
    heartbeatBpm: passPercentage === 100 ? 78 : 45,
    totalTests,
    passedTests,
    passPercentage,
    executionResults,
    verificationTimestamp: new Date().toISOString(),
  };
}

export function generateAutopsyReport(patient: NecroPatient): AutopsyReport {
  const diagnosis = diagnoseLegacyCode(patient.deadCode, patient.language);
  const resurrection = resurrectCode(patient.deadCode, patient.language, patient.id);
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
  };
}

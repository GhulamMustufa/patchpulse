import { describe, it, expect } from "vitest";
import {
  PRESET_PATIENTS,
  diagnoseLegacyCode,
  resurrectCode,
  verifyResurrection,
  generateAutopsyReport,
} from "../necro-engine";

describe("NecroCode Resurrection Engine Unit Tests", () => {
  it("should have pre-seeded historical dead patient repositories loaded", () => {
    expect(PRESET_PATIENTS.length).toBeGreaterThanOrEqual(2);

    const pyPatient = PRESET_PATIENTS.find((p) => p.id === "patient_py2_archiver");
    const nodePatient = PRESET_PATIENTS.find((p) => p.id === "patient_node_webhook");

    expect(pyPatient).toBeDefined();
    expect(pyPatient?.language).toBe("python");
    expect(pyPatient?.deceasedYear).toBe(2014);
    expect(pyPatient?.testSuites.length).toBe(3);

    expect(nodePatient).toBeDefined();
    expect(nodePatient?.language).toBe("javascript");
    expect(nodePatient?.deceasedYear).toBe(2016);
    expect(nodePatient?.testSuites.length).toBe(3);
  });

  describe("Digital Autopsy & Fatal Error Diagnosis", () => {
    it("should accurately diagnose Python 2.7 lethal syntax rot and removed libraries", () => {
      const pyPatient = PRESET_PATIENTS.find((p) => p.id === "patient_py2_archiver")!;
      const diagnosis = diagnoseLegacyCode(pyPatient.deadCode, pyPatient.language);

      expect(diagnosis.toxicityScore).toBeGreaterThanOrEqual(80);
      expect(diagnosis.primaryCauseOfDeath).toContain("Lethal Syntax Rot");

      const rules = diagnosis.fatalErrors.map((e) => e.rule);
      expect(rules).toContain("PY2_PRINT_STATEMENT");
      expect(rules).toContain("DEPRECATED_URLLIB2");
      expect(rules).toContain("COMMA_EXCEPT_SYNTAX");
      expect(rules).toContain("OBSOLETE_XRANGE");
      expect(rules).toContain("DEPRECATED_ITERITEMS");
    });

    it("should accurately diagnose Node 6 CVE vulnerability and deprecated NPM dependencies", () => {
      const nodePatient = PRESET_PATIENTS.find((p) => p.id === "patient_node_webhook")!;
      const diagnosis = diagnoseLegacyCode(nodePatient.deadCode, nodePatient.language);

      expect(diagnosis.toxicityScore).toBeGreaterThanOrEqual(75);
      expect(diagnosis.primaryCauseOfDeath).toContain("Critical Dependency CVE Expiration");

      const rules = diagnosis.fatalErrors.map((e) => e.rule);
      expect(rules).toContain("DEAD_REQUEST_PACKAGE");
      expect(rules).toContain("UNSAFE_BUFFER_ALLOCATION");
      expect(rules).toContain("COMMONJS_EXPORT");
    });
  });

  describe("Resurrection Transformation Engine", () => {
    it("should resurrect Python 2 codebase into compliant Python 3.12 syntax", () => {
      const pyPatient = PRESET_PATIENTS.find((p) => p.id === "patient_py2_archiver")!;
      const resurrection = resurrectCode(pyPatient.deadCode, pyPatient.language, pyPatient.id);

      expect(resurrection.stepsApplied.length).toBeGreaterThanOrEqual(5);
      expect(resurrection.resurrectedCode).not.toContain("import urllib2");
      expect(resurrection.resurrectedCode).toContain("import urllib.request");
      expect(resurrection.resurrectedCode).toContain("import urllib.error");
      expect(resurrection.resurrectedCode).not.toContain("xrange(");
      expect(resurrection.resurrectedCode).toContain("range(");
      expect(resurrection.resurrectedCode).not.toContain(".iteritems()");
      expect(resurrection.resurrectedCode).toContain(".items()");
    });

    it("should resurrect Node 6 CommonJS into memory-safe Node 20+ ESM syntax", () => {
      const nodePatient = PRESET_PATIENTS.find((p) => p.id === "patient_node_webhook")!;
      const resurrection = resurrectCode(nodePatient.deadCode, nodePatient.language, nodePatient.id);

      expect(resurrection.stepsApplied.length).toBeGreaterThanOrEqual(4);
      expect(resurrection.resurrectedCode).not.toContain("require('request')");
      expect(resurrection.resurrectedCode).toContain("fetch(");
      expect(resurrection.resurrectedCode).not.toContain("new Buffer(");
      expect(resurrection.resurrectedCode).toContain("Buffer.from(");
      expect(resurrection.resurrectedCode).toContain("export async function");
    });

    it("should handle arbitrary legacy code snippets deterministically", () => {
      const rawLegacyPy = `
print "Hello Dead World"
for i in xrange(10):
    try:
        x = 1 / 0
    except ZeroDivisionError, err:
        print "Handled: %s" % err
`;
      const result = resurrectCode(rawLegacyPy, "python");
      expect(result.resurrectedCode).toContain('print("Hello Dead World")');
      expect(result.resurrectedCode).toContain("range(10)");
      expect(result.resurrectedCode).toContain("except ZeroDivisionError as err:");
    });
  });

  describe("Post-Mortem Verification & Vital State", () => {
    it("should verify 100% test pass rate and transition vital pulse to 78 BPM", () => {
      const pyPatient = PRESET_PATIENTS.find((p) => p.id === "patient_py2_archiver")!;
      const report = generateAutopsyReport(pyPatient);

      expect(report.patientId).toBe("patient_py2_archiver");
      expect(report.heartbeatBpm).toBe(78);
      expect(report.testsPassed).toBe(report.testsTotal);
      expect(report.testsTotal).toBe(3);
      expect(report.fatalErrors.length).toBeGreaterThan(0);
      expect(report.resurrectionPlan.length).toBeGreaterThan(0);
    });

    it("should generate a complete autopsy verification report for Node patient", () => {
      const nodePatient = PRESET_PATIENTS.find((p) => p.id === "patient_node_webhook")!;
      const report = generateAutopsyReport(nodePatient);

      expect(report.patientId).toBe("patient_node_webhook");
      expect(report.heartbeatBpm).toBe(78);
      expect(report.testsPassed).toBe(3);
      expect(report.resurrectedCode).toContain("Buffer.from");
    });
  });
});

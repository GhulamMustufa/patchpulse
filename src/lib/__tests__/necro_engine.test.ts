import { describe, it, expect } from "vitest";
import {
  PRESET_PATIENTS,
  diagnoseLegacyCode,
  resurrectCode,
  verifyResurrection,
  generateAutopsyReport,
} from "../necro-engine";

describe("PatchPulse Resurrection Engine Unit Tests", () => {
  it("should load pre-seeded historical dead patient repositories", () => {
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

  describe("Digital Autopsy & Diagnosis", () => {
    it("should diagnose Python 2.7 lethal syntax rot and removed libraries", () => {
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

    it("should return 0% toxicity for clean modern Python 3 code", () => {
      const cleanPy = `def greet(name: str) -> str:\n    # import urllib2 (comment should be ignored)\n    print(f"Hello {name}")\n    return name\n`;
      const diagnosis = diagnoseLegacyCode(cleanPy, "python");

      expect(diagnosis.fatalErrors).toHaveLength(0);
      expect(diagnosis.toxicityScore).toBe(0);
    });

    it("should diagnose Node 6 CVE vulnerability and deprecated NPM dependencies", () => {
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
    it("should resurrect Python 2 preset into modern Python 3.12 syntax", () => {
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

    it("should handle custom Python edge cases (inline comments, chevron print, from urllib2)", () => {
      const rawLegacyPy = [
        "from urllib2 import urlopen, URLError",
        'print "Hello Dead World" # trailing comment',
        'print >> sys.stderr, "error msg"',
        "for i in xrange(10):",
        "    try:",
        "        name = raw_input('Name: ')",
        "    except URLError, err:",
        '        print "Handled: %s" % err',
      ].join("\n");

      const result = resurrectCode(rawLegacyPy, "python");
      expect(result.resurrectedCode).toContain("from urllib.request import urlopen");
      expect(result.resurrectedCode).toContain("from urllib.error import URLError");
      expect(result.resurrectedCode).toContain('print("Hello Dead World")  # trailing comment');
      expect(result.resurrectedCode).toContain('print("error msg", file=sys.stderr)');
      expect(result.resurrectedCode).toContain("range(10)");
      expect(result.resurrectedCode).toContain("input('Name: ')");
      expect(result.resurrectedCode).toContain("except URLError as err:");
    });

    it("should convert CommonJS module.exports without producing invalid ESM export colons", () => {
      const legacyJs = [
        "const buf1 = new Buffer(16);",
        "const buf2 = new Buffer('hello', 'utf8');",
        "function send() { return buf1.length + buf2.length; }",
        "module.exports = { send: send };",
      ].join("\n");

      const result = resurrectCode(legacyJs, "javascript");
      expect(result.resurrectedCode).toContain("Buffer.alloc(16)");
      expect(result.resurrectedCode).toContain("Buffer.from('hello', 'utf8')");
      expect(result.resurrectedCode).toContain("export { send };");
      expect(result.resurrectedCode).not.toContain("export { send: send }");
    });

    it("should warn honestly when custom JS uses deprecated request() calls", () => {
      const legacyJs = `var request = require('request');\nrequest('https://example.com', function(e, r) {});`;
      const result = resurrectCode(legacyJs, "javascript");
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe("Truthful Verification Logic (No False PASS / 78 BPM)", () => {
    it("should fail verification when resurrectedCode is empty or still contains fatal errors", () => {
      const pyPatient = PRESET_PATIENTS.find((p) => p.id === "patient_py2_archiver")!;

      const emptyCheck = verifyResurrection(pyPatient, "");
      expect(emptyCheck.vitalState).toBe("FAILED");
      expect(emptyCheck.heartbeatBpm).toBe(0);
      expect(emptyCheck.syntaxValid).toBe(false);

      const unrepairedCheck = verifyResurrection(pyPatient, pyPatient.deadCode);
      expect(unrepairedCheck.vitalState).toBe("FAILED");
      expect(unrepairedCheck.heartbeatBpm).toBe(0);
      expect(unrepairedCheck.failedTests).toBeGreaterThan(0);
    });

    it("should report SYNTAX_PASSED_SANDBOX_PENDING instead of fabricated runtime PASS", () => {
      const pyPatient = PRESET_PATIENTS.find((p) => p.id === "patient_py2_archiver")!;
      const report = generateAutopsyReport(pyPatient);

      expect(report.patientId).toBe("patient_py2_archiver");
      expect(report.syntaxValid).toBe(true);
      expect(report.verificationStatus).toBe("SYNTAX_PASSED_SANDBOX_PENDING");
      expect(report.heartbeatBpm).toBe(64);
      expect(
        report.executionResults.some((r) => r.resurrectedResult === "PENDING_SANDBOX")
      ).toBe(true);
    });
  });
});

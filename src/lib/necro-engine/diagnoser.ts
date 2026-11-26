import { FatalError, LanguageType } from "./types";

export interface DiagnosisResult {
  toxicityScore: number;
  fatalErrors: FatalError[];
  primaryCauseOfDeath: string;
}

export function diagnoseLegacyCode(
  code: string,
  language: LanguageType,
  fileName = "main"
): DiagnosisResult {
  const lines = code.split("\n");
  const fatalErrors: FatalError[] = [];

  if (!code.trim()) {
    return {
      toxicityScore: 0,
      fatalErrors: [],
      primaryCauseOfDeath: "No source code provided for diagnosis",
    };
  }

  if (language === "python") {
    lines.forEach((line, idx) => {
      const lineNum = idx + 1;
      const trimmed = line.trim();

      // Skip empty lines and pure comments
      if (!trimmed || trimmed.startsWith("#")) {
        return;
      }

      // Check Python 2 print statement (exclude Python 3 print(...) and print_ identifiers)
      if (
        !trimmed.startsWith("print(") &&
        (/^print\s+["'`]/.test(trimmed) ||
          /^print\s+[a-zA-Z_(>]/.test(trimmed) ||
          trimmed === "print")
      ) {
        fatalErrors.push({
          line: lineNum,
          file: fileName,
          rule: "PY2_PRINT_STATEMENT",
          severity: "FATAL",
          origin: "confirmed",
          diagnosis:
            "Python 2 print statement without parentheses causes SyntaxError in Python 3.",
          recommendedRepair: "Convert to parenthesized print(...) function call.",
          legacySnippet: trimmed,
          repairedSnippet:
            trimmed === "print"
              ? "print()"
              : trimmed.replace(/^print\s+(.*)$/, "print($1)"),
        });
      }

      // Check urllib2 (both import urllib2 and from urllib2 import ...)
      if (
        /\bimport\s+urllib2\b/.test(trimmed) ||
        /\bfrom\s+urllib2\s+import\b/.test(trimmed)
      ) {
        fatalErrors.push({
          line: lineNum,
          file: fileName,
          rule: "DEPRECATED_URLLIB2",
          severity: "FATAL",
          origin: "confirmed",
          diagnosis:
            "urllib2 was removed in Python 3. Standard library moved to urllib.request and urllib.error.",
          recommendedRepair:
            "Replace urllib2 imports and references with urllib.request / urllib.error.",
          legacySnippet: trimmed,
          repairedSnippet: trimmed.includes("from urllib2")
            ? trimmed.replace(/\bfrom\s+urllib2\b/, "from urllib.request")
            : "import urllib.request\nimport urllib.error",
        });
      }

      // Check except Exception, e:
      if (/except\s+([A-Za-z0-9_.]+)\s*,\s*([a-zA-Z0-9_]+)\s*:/.test(trimmed)) {
        fatalErrors.push({
          line: lineNum,
          file: fileName,
          rule: "COMMA_EXCEPT_SYNTAX",
          severity: "FATAL",
          origin: "confirmed",
          diagnosis:
            "Legacy comma-based exception catching syntax is rejected by Python 3.",
          recommendedRepair: "Use 'except <Exception> as <var>:' syntax.",
          legacySnippet: trimmed,
          repairedSnippet: trimmed.replace(
            /except\s+([A-Za-z0-9_.]+)\s*,\s*([a-zA-Z0-9_]+)\s*:/,
            "except $1 as $2:"
          ),
        });
      }

      // Check xrange
      if (/\bxrange\s*\(/.test(trimmed)) {
        fatalErrors.push({
          line: lineNum,
          file: fileName,
          rule: "OBSOLETE_XRANGE",
          severity: "DEPRECATED",
          origin: "confirmed",
          diagnosis:
            "xrange() was removed in Python 3 and replaced by range().",
          recommendedRepair: "Replace xrange(...) with range(...).",
          legacySnippet: trimmed,
          repairedSnippet: trimmed.replace(/\bxrange\s*\(/g, "range("),
        });
      }

      // Check iteritems / itervalues / iterkeys
      if (/\.(iteritems|itervalues|iterkeys)\s*\(\)/.test(trimmed)) {
        fatalErrors.push({
          line: lineNum,
          file: fileName,
          rule: "DEPRECATED_ITERITEMS",
          severity: "DEPRECATED",
          origin: "confirmed",
          diagnosis:
            "dict.iteritems()/itervalues()/iterkeys() were removed in Python 3.",
          recommendedRepair: "Replace with .items()/.values()/.keys().",
          legacySnippet: trimmed,
          repairedSnippet: trimmed
            .replace(/\.iteritems\s*\(\)/g, ".items()")
            .replace(/\.itervalues\s*\(\)/g, ".values()")
            .replace(/\.iterkeys\s*\(\)/g, ".keys()"),
        });
      }

      // Check raw_input()
      if (/\braw_input\s*\(/.test(trimmed)) {
        fatalErrors.push({
          line: lineNum,
          file: fileName,
          rule: "OBSOLETE_RAW_INPUT",
          severity: "FATAL",
          origin: "confirmed",
          diagnosis:
            "raw_input() was removed in Python 3 and replaced by input().",
          recommendedRepair: "Replace raw_input(...) with input(...).",
          legacySnippet: trimmed,
          repairedSnippet: trimmed.replace(/\braw_input\s*\(/g, "input("),
        });
      }
    });

    const toxicityScore =
      fatalErrors.length === 0 ? 0 : Math.min(100, fatalErrors.length * 20);

    const primaryCauseOfDeath =
      fatalErrors.length === 0
        ? "No fatal Python 2 legacy syntax or standard-library rot detected"
        : fatalErrors.some(
            (e) =>
              e.rule === "PY2_PRINT_STATEMENT" ||
              e.rule === "DEPRECATED_URLLIB2" ||
              e.rule === "COMMA_EXCEPT_SYNTAX"
          )
        ? "Lethal Syntax Rot & Python 2.7 Standard Library Extinction"
        : "Accumulated Python Dependency & API Decay";

    return { toxicityScore, fatalErrors, primaryCauseOfDeath };
  }

  // JavaScript / TypeScript
  lines.forEach((line, idx) => {
    const lineNum = idx + 1;
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("/*")) {
      return;
    }

    if (/require\s*\(\s*['"]request['"]\s*\)/.test(trimmed)) {
      fatalErrors.push({
        line: lineNum,
        file: fileName,
        rule: "DEAD_REQUEST_PACKAGE",
        severity: "FATAL",
        origin: "confirmed",
        diagnosis:
          "The 'request' npm package was officially deprecated in 2020 and introduces unpatched supply-chain risk.",
        recommendedRepair: "Migrate HTTP requests to native fetch().",
        legacySnippet: trimmed,
        repairedSnippet: "// Migrate to native global fetch() in Node 20+",
      });
    }

    if (/new\s+Buffer\s*\(/.test(trimmed)) {
      fatalErrors.push({
        line: lineNum,
        file: fileName,
        rule: "UNSAFE_BUFFER_ALLOCATION",
        severity: "SECURITY_HAZARD",
        origin: "confirmed",
        diagnosis:
          "new Buffer() is deprecated due to uninitialized memory disclosure vulnerabilities (CVE-2018-7166).",
        recommendedRepair:
          "Use Buffer.from(...) for data or Buffer.alloc(size) for zero-filled allocations.",
        legacySnippet: trimmed,
        repairedSnippet: trimmed.replace(
          /new\s+Buffer\s*\(\s*(\d+)\s*\)/g,
          "Buffer.alloc($1)"
        ).replace(
          /new\s+Buffer\s*\(([^,)]+)\)/g,
          "Buffer.from($1, 'utf-8')"
        ),
      });
    }

    if (/module\.exports\s*=/.test(trimmed)) {
      fatalErrors.push({
        line: lineNum,
        file: fileName,
        rule: "COMMONJS_EXPORT",
        severity: "DEPRECATED",
        origin: "confirmed",
        diagnosis:
          "Legacy CommonJS exports block modern ESM module loaders.",
        recommendedRepair: "Convert module.exports to ES Module export syntax.",
        legacySnippet: trimmed,
        repairedSnippet: "export { ... } / export default ...",
      });
    }
  });

  const toxicityScore =
    fatalErrors.length === 0 ? 0 : Math.min(100, fatalErrors.length * 25);

  const primaryCauseOfDeath =
    fatalErrors.length === 0
      ? "No fatal legacy Node.js / CommonJS patterns detected"
      : fatalErrors.some(
          (e) =>
            e.rule === "DEAD_REQUEST_PACKAGE" ||
            e.rule === "UNSAFE_BUFFER_ALLOCATION"
        )
      ? "Critical Dependency CVE Expiration & Abandoned CommonJS Architecture"
      : "Legacy NPM Supply-Chain Rot";

  return { toxicityScore, fatalErrors, primaryCauseOfDeath };
}

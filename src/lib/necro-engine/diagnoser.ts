import { FatalError, LanguageType } from "./types";

export function diagnoseLegacyCode(code: string, language: LanguageType): {
  toxicityScore: number;
  fatalErrors: FatalError[];
  primaryCauseOfDeath: string;
} {
  const lines = code.split("\n");
  const fatalErrors: FatalError[] = [];

  if (language === "python") {
    lines.forEach((line, idx) => {
      const lineNum = idx + 1;
      const trimmed = line.trim();

      // Check Python 2 print statement
      if (/^print\s+["'].*["']/.test(trimmed) || /^print\s+[a-zA-Z_]/.test(trimmed)) {
        if (!trimmed.startsWith("print(")) {
          fatalErrors.push({
            line: lineNum,
            rule: "PY2_PRINT_STATEMENT",
            severity: "FATAL",
            diagnosis: "Python 2 print statement without parentheses causes instant SyntaxError in Python 3.",
            legacySnippet: trimmed,
            repairedSnippet: trimmed.replace(/^print\s+(.*)$/, "print($1)"),
          });
        }
      }

      // Check urllib2
      if (/import\s+urllib2\b/.test(trimmed)) {
        fatalErrors.push({
          line: lineNum,
          rule: "DEPRECATED_URLLIB2",
          severity: "FATAL",
          diagnosis: "urllib2 was removed in Python 3. Standard library moved to urllib.request and urllib.error.",
          legacySnippet: trimmed,
          repairedSnippet: "import urllib.request\nimport urllib.error",
        });
      }

      // Check except Exception, e:
      if (/except\s+([A-Za-z0-9_\.]+)\s*,\s*([a-zA-Z0-9_]+)\s*:/.test(trimmed)) {
        fatalErrors.push({
          line: lineNum,
          rule: "COMMA_EXCEPT_SYNTAX",
          severity: "FATAL",
          diagnosis: "Legacy comma-based exception catching syntax rejected by modern Python compiler.",
          legacySnippet: trimmed,
          repairedSnippet: trimmed.replace(/except\s+([A-Za-z0-9_\.]+)\s*,\s*([a-zA-Z0-9_]+)\s*:/, "except $1 as $2:"),
        });
      }

      // Check xrange
      if (/\bxrange\s*\(/.test(trimmed)) {
        fatalErrors.push({
          line: lineNum,
          rule: "OBSOLETE_XRANGE",
          severity: "DEPRECATED",
          diagnosis: "xrange() removed in Python 3. Replaced by unified memory-efficient range().",
          legacySnippet: trimmed,
          repairedSnippet: trimmed.replace(/\bxrange\s*\(/g, "range("),
        });
      }

      // Check iteritems
      if (/\.iteritems\s*\(\)/.test(trimmed)) {
        fatalErrors.push({
          line: lineNum,
          rule: "DEPRECATED_ITERITEMS",
          severity: "DEPRECATED",
          diagnosis: "dict.iteritems() deprecated. Modern Python 3 uses dict.items().",
          legacySnippet: trimmed,
          repairedSnippet: trimmed.replace(/\.iteritems\s*\(\)/g, ".items()"),
        });
      }
    });

    const toxicityScore = Math.min(100, Math.max(30, fatalErrors.length * 20));
    const primaryCauseOfDeath = fatalErrors.some(e => e.rule === "PY2_PRINT_STATEMENT" || e.rule === "DEPRECATED_URLLIB2")
      ? "Lethal Syntax Rot & Python 2.7 Standard Library Extinction"
      : "Accumulated Dependency Decay";

    return { toxicityScore, fatalErrors, primaryCauseOfDeath };
  } else {
    // JavaScript / Node.js
    lines.forEach((line, idx) => {
      const lineNum = idx + 1;
      const trimmed = line.trim();

      // Check deprecated request package
      if (/require\s*\(\s*['"]request['"]\s*\)/.test(trimmed)) {
        fatalErrors.push({
          line: lineNum,
          rule: "DEAD_REQUEST_PACKAGE",
          severity: "FATAL",
          diagnosis: "The 'request' npm package was officially fully deprecated in 2020. Causes supply-chain deadlocks.",
          legacySnippet: trimmed,
          repairedSnippet: "// Replaced with native global fetch() in Node 20+",
        });
      }

      // Check unsafe Buffer allocation
      if (/new\s+Buffer\s*\(/.test(trimmed)) {
        fatalErrors.push({
          line: lineNum,
          rule: "UNSAFE_BUFFER_ALLOCATION",
          severity: "SECURITY_HAZARD",
          diagnosis: "new Buffer() has been deprecated due to CVE security vulnerabilities. Uninitialized memory leak risk.",
          legacySnippet: trimmed,
          repairedSnippet: trimmed.replace(/new\s+Buffer\s*\((.*?)\)/g, "Buffer.from($1, 'utf-8')"),
        });
      }

      // Check CommonJS export
      if (/module\.exports\s*=/.test(trimmed)) {
        fatalErrors.push({
          line: lineNum,
          rule: "COMMONJS_EXPORT",
          severity: "DEPRECATED",
          diagnosis: "Legacy CommonJS exports block modern browser and ESM module loaders.",
          legacySnippet: trimmed,
          repairedSnippet: "export default ... (converted to standard ESM)",
        });
      }
    });

    const toxicityScore = Math.min(100, Math.max(35, fatalErrors.length * 25));
    const primaryCauseOfDeath = fatalErrors.some(e => e.rule === "DEAD_REQUEST_PACKAGE" || e.rule === "UNSAFE_BUFFER_ALLOCATION")
      ? "Critical Dependency CVE Expiration & Abandoned CommonJS Architecture"
      : "Legacy NPM Supply-Chain Rot";

    return { toxicityScore, fatalErrors, primaryCauseOfDeath };
  }
}

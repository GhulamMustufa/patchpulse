import { diagnoseLegacyCode } from "./diagnoser";
import { detectProjectLanguageAndFramework } from "./language-detector";
import { diagnoseNodeRepository } from "./node-diagnoser";
import { inspectPythonAstSafely } from "./python-ast";
import {
  DiagnosisFinding,
  IngestedRepository,
  RepositoryDiagnosis,
} from "./schemas";

interface ParsedDependency {
  name: string;
  specifier: string;
  sourceFile: string;
  status: "outdated" | "deprecated" | "conflict" | "ok";
  note: string;
}

const DEPRECATED_OR_OUTDATED_PACKAGES: Record<
  string,
  { status: "deprecated" | "outdated"; note: string; repair: string }
> = {
  nose: {
    status: "deprecated",
    note: "nose is unmaintained and fails on Python 3.10+ (collections.Callable).",
    repair: "Migrate test suite to pytest.",
  },
  distribute: {
    status: "deprecated",
    note: "distribute was merged back into setuptools in 2013.",
    repair: "Replace distribute with modern setuptools.",
  },
  typing: {
    status: "deprecated",
    note: "PyPI 'typing' backport breaks Python 3.7+ stdlib typing.",
    repair: "Remove 'typing' from requirements for Python 3.8+.",
  },
  futures: {
    status: "deprecated",
    note: "futures is a Python 2 backport of concurrent.futures.",
    repair: "Remove 'futures'; use standard library concurrent.futures.",
  },
  pyyaml: {
    status: "outdated",
    note: "Legacy PyYAML (<5.4) has known yaml.load arbitrary code execution CVEs.",
    repair: "Upgrade PyYAML>=6.0.1 and use yaml.safe_load().",
  },
  urllib3: {
    status: "outdated",
    note: "Legacy urllib3 pins (<1.26) lack TLS/security fixes and Python 3.12 support.",
    repair: "Upgrade urllib3>=2.2.0.",
  },
  requests: {
    status: "outdated",
    note: "Old requests versions (<2.25) fail against modern urllib3/OpenSSL.",
    repair: "Upgrade requests>=2.32.0.",
  },
  django: {
    status: "outdated",
    note: "Django <4.2 is End-of-Life and incompatible with Python 3.12.",
    repair: "Upgrade to Django>=4.2 LTS or 5.x.",
  },
  flask: {
    status: "outdated",
    note: "Flask <2.0 relies on deprecated Werkzeug/Jinja APIs incompatible with Python 3.12.",
    repair: "Upgrade to Flask>=3.0.0.",
  },
};

const EXTENDED_PY_IMPORT_RULES: Array<{
  pattern: RegExp;
  rule: string;
  severity: DiagnosisFinding["severity"];
  explanation: string;
  repair: string;
  replacement: string;
}> = [
  {
    pattern: /\b(import\s+ConfigParser|from\s+ConfigParser\s+import)\b/,
    rule: "PY2_CONFIGPARSER_MODULE",
    severity: "FATAL",
    explanation: "ConfigParser was renamed to configparser in Python 3.",
    repair: "Rename ConfigParser import to configparser.",
    replacement: "import configparser",
  },
  {
    pattern: /\b(import\s+Queue|from\s+Queue\s+import)\b/,
    rule: "PY2_QUEUE_MODULE",
    severity: "FATAL",
    explanation: "Queue module was renamed to queue in Python 3.",
    repair: "Rename Queue import to queue.",
    replacement: "import queue",
  },
  {
    pattern: /\b(import\s+c?StringIO|from\s+c?StringIO\s+import)\b/,
    rule: "PY2_STRINGIO_MODULE",
    severity: "FATAL",
    explanation: "StringIO / cStringIO were replaced by io.StringIO in Python 3.",
    repair: "Use 'from io import StringIO' or 'from io import BytesIO'.",
    replacement: "from io import StringIO",
  },
  {
    pattern: /\b(basestring|unicode)\b/,
    rule: "PY2_STRING_TYPES",
    severity: "FATAL",
    explanation: "basestring and unicode built-ins were removed in Python 3.",
    repair: "Replace basestring/unicode references with str.",
    replacement: "str",
  },
  {
    pattern: /\bexecfile\s*\(/,
    rule: "PY2_EXECFILE",
    severity: "FATAL",
    explanation: "execfile() was removed in Python 3.",
    repair: "Replace with importlib or explicit file read.",
    replacement: "# Refactor execfile() to explicit module import",
  },
];

function parseRequirementsTxt(
  content: string,
  filePath: string
): ParsedDependency[] {
  const deps: ParsedDependency[] = [];
  for (const rawLine of content.split("\n")) {
    const line = rawLine.split("#")[0].trim();
    if (!line || line.startsWith("-")) continue;
    const match = line.match(/^([A-Za-z0-9_.-]+)\s*(.*)$/);
    if (!match) continue;
    const name = match[1].toLowerCase();
    const specifier = match[2].trim() || "unpinned";

    const known = DEPRECATED_OR_OUTDATED_PACKAGES[name];
    let status: ParsedDependency["status"] = "ok";
    let note = "No known legacy constraint issue.";

    if (known) {
      const majorMatch = specifier.match(/(\d+)/);
      const major = majorMatch ? Number(majorMatch[1]) : null;
      if (known.status === "deprecated") {
        status = "deprecated";
        note = known.note;
      } else if (
        specifier.includes("<") ||
        (name === "django" && major !== null && major < 4) ||
        (name === "flask" && major !== null && major < 2) ||
        (name === "requests" && major !== null && major < 2) ||
        (name === "pyyaml" && major !== null && major < 5) ||
        (name === "urllib3" && major !== null && major < 2)
      ) {
        status = "outdated";
        note = known.note;
      }
    }

    deps.push({ name, specifier, sourceFile: filePath, status, note });
  }
  return deps;
}

function detectPythonVersionTarget(repo: IngestedRepository): string {
  for (const file of repo.files) {
    if (file.path.endsWith(".python-version") || file.path.endsWith("runtime.txt")) {
      const val = file.content.trim();
      if (val) return val;
    }
    if (file.path.endsWith("pyproject.toml") || file.path.endsWith("setup.py")) {
      const reqMatch = file.content.match(
        /(?:requires-python|python_requires)\s*=\s*["']([^"']+)["']/
      );
      if (reqMatch) return reqMatch[1];
      if (/Programming Language :: Python :: 2/.test(file.content)) {
        return "Python 2.x (detected in setup.py classifiers)";
      }
    }
    if (file.language === "python" && file.content.includes("python2")) {
      return "Python 2.x (shebang)";
    }
  }
  return "Unspecified (target Python 3.12)";
}

export function diagnoseRepository(repo: IngestedRepository): RepositoryDiagnosis {
  const languageProfile = detectProjectLanguageAndFramework(repo.files);
  const findings: DiagnosisFinding[] = [];
  const dependencies: ParsedDependency[] = [];
  const discoveredTests: RepositoryDiagnosis["discoveredTests"] = [];
  const tsDiagnostics: NonNullable<RepositoryDiagnosis["tsDiagnostics"]> = [];
  let syntaxCheckEngine = "static";
  let findingIdx = 1;

  const nextId = () => `finding_${findingIdx++}`;

  const hasPythonFiles = repo.files.some((f) => f.language === "python");
  const hasJsTsFiles = repo.files.some(
    (f) =>
      f.language === "javascript" ||
      f.language === "typescript" ||
      f.path.toLowerCase() === "package.json" ||
      f.path.toLowerCase() === "tsconfig.json"
  );

  // 1. Python analysis (when Python files/manifests present)
  if (hasPythonFiles || repo.isPythonProject) {
    for (const file of repo.files) {
      if (file.path.toLowerCase().includes("requirements") && file.path.endsWith(".txt")) {
        dependencies.push(...parseRequirementsTxt(file.content, file.path));
      } else if (file.path.endsWith("pyproject.toml") || file.path.endsWith("setup.py")) {
        const matches = file.content.matchAll(/["']([A-Za-z0-9_.-]+)\s*([<>=!~][^"']*)["']/g);
        for (const m of matches) {
          const name = m[1].toLowerCase();
          if (name === "python" || name.includes("::")) continue;
          const known = DEPRECATED_OR_OUTDATED_PACKAGES[name];
          dependencies.push({
            name,
            specifier: m[2].trim(),
            sourceFile: file.path,
            status: known ? known.status : "ok",
            note: known ? known.note : "Declared in project manifest.",
          });
        }
      }
    }

    const seenSpecs = new Map<string, ParsedDependency[]>();
    for (const dep of dependencies) {
      const list = seenSpecs.get(dep.name) ?? [];
      list.push(dep);
      seenSpecs.set(dep.name, list);

      if (dep.status === "deprecated" || dep.status === "outdated") {
        const known = DEPRECATED_OR_OUTDATED_PACKAGES[dep.name];
        findings.push({
          id: nextId(),
          finding: `${dep.status === "deprecated" ? "Deprecated" : "Outdated"} dependency: ${dep.name} (${dep.specifier})`,
          category: "dependency",
          severity: dep.status === "deprecated" ? "FATAL" : "WARNING",
          origin: "confirmed",
          file: dep.sourceFile,
          explanation: dep.note,
          recommendedRepair:
            known?.repair || `Update ${dep.name} to a Python 3.12 compatible release.`,
        });
      }
    }

    for (const [pkgName, entries] of seenSpecs.entries()) {
      const distinctSpecs = new Set(entries.map((e) => e.specifier));
      if (distinctSpecs.size > 1) {
        entries.forEach((e) => (e.status = "conflict"));
        findings.push({
          id: nextId(),
          finding: `Conflicting dependency constraints for ${pkgName}`,
          category: "conflict",
          severity: "FATAL",
          origin: "confirmed",
          file: entries.map((e) => e.sourceFile).join(", "),
          explanation: `Package '${pkgName}' has conflicting specifiers: ${Array.from(distinctSpecs).join(" vs ")}.`,
          recommendedRepair: `Unify ${pkgName} version specifier across manifests.`,
        });
      }
    }

    for (const file of repo.files) {
      if (file.language !== "python") continue;

      const astRes = inspectPythonAstSafely(file.content);
      syntaxCheckEngine = astRes.engine;

      if (!astRes.valid && astRes.error) {
        findings.push({
          id: nextId(),
          finding: "Python 3.12 SyntaxError",
          category: "syntax",
          severity: "FATAL",
          origin: "confirmed",
          file: file.path,
          line: astRes.errorLine ?? 1,
          explanation: `Python 3.12 ast.parse rejected this file: ${astRes.error}.`,
          recommendedRepair:
            "Migrate legacy syntax (e.g., Python 2 print/except) to valid Python 3 syntax.",
        });
      }

      for (const astIssue of astRes.astIssues) {
        findings.push({
          id: nextId(),
          finding: astIssue.rule,
          category: "compatibility",
          severity: astIssue.severity,
          origin: "confirmed",
          file: file.path,
          line: astIssue.line,
          explanation: astIssue.explanation,
          recommendedRepair: astIssue.recommendedRepair,
        });
      }

      const lineDiag = diagnoseLegacyCode(file.content, "python", file.path);
      for (const err of lineDiag.fatalErrors) {
        findings.push({
          id: nextId(),
          finding: err.rule,
          category: err.rule.includes("URLLIB") ? "import" : "syntax",
          severity: err.severity,
          origin: "confirmed",
          file: file.path,
          line: err.line,
          explanation: err.diagnosis,
          recommendedRepair: err.recommendedRepair || "Apply Python 3 migration transform.",
          legacySnippet: err.legacySnippet,
          repairedSnippet: err.repairedSnippet,
        });
      }

      const lines = file.content.split("\n");
      lines.forEach((rawLine, idx) => {
        const trimmed = rawLine.trim();
        if (!trimmed || trimmed.startsWith("#")) return;
        for (const rule of EXTENDED_PY_IMPORT_RULES) {
          if (rule.pattern.test(trimmed)) {
            findings.push({
              id: nextId(),
              finding: rule.rule,
              category: "import",
              severity: rule.severity,
              origin: "confirmed",
              file: file.path,
              line: idx + 1,
              explanation: rule.explanation,
              recommendedRepair: rule.repair,
              legacySnippet: trimmed,
              repairedSnippet: rule.replacement,
            });
          }
        }
      });

      if (file.isTestFile || astRes.discoveredTests.length > 0) {
        const runnerHint = /\bpytest\b/.test(file.content)
          ? "pytest"
          : /\bnose\b/.test(file.content)
          ? "nose"
          : /\bunittest\b/.test(file.content)
          ? "unittest"
          : "unknown";
        discoveredTests.push({
          file: file.path,
          testNames: astRes.discoveredTests,
          runnerHint,
        });
      }
    }

    if (repo.dependencyManifests.length === 0) {
      findings.push({
        id: nextId(),
        finding: "Missing dependency manifest",
        category: "config",
        severity: "WARNING",
        origin: "confirmed",
        file: "(repository root)",
        explanation:
          "No requirements.txt, pyproject.toml, setup.py, or Pipfile found.",
        recommendedRepair: "Add a pyproject.toml or pinned requirements.txt.",
      });
    }
  }

  // 2. JavaScript / TypeScript analysis
  if (hasJsTsFiles) {
    const nodeDiag = diagnoseNodeRepository(repo);
    syntaxCheckEngine =
      languageProfile.primaryLanguage === "mixed"
        ? `${syntaxCheckEngine} + TypeScript 5.9.3`
        : "TypeScript 5.9.3 + Node.js 20";
    findings.push(...nodeDiag.findings);
    tsDiagnostics.push(...nodeDiag.tsDiagnostics);
    discoveredTests.push(...nodeDiag.discoveredTests);

    for (const pkg of nodeDiag.dependencyPolicy.declaredPackages) {
      dependencies.push({
        name: pkg.name,
        specifier: pkg.specifier,
        sourceFile: "package.json",
        status: pkg.name === "request" ? "deprecated" : "ok",
        note:
          pkg.name === "request"
            ? "Deprecated HTTP client package."
            : `Declared in ${pkg.section}`,
      });
    }
  }

  if (discoveredTests.length === 0) {
    findings.push({
      id: nextId(),
      finding: "No automated test suite discovered",
      category: "test",
      severity: "WARNING",
      origin: "confirmed",
      file: "(repository root)",
      explanation:
        "No test files were detected. Behavioral parity cannot be automatically verified.",
      recommendedRepair: "Add unit tests using pytest/unittest (Python) or node:test (JS/TS).",
    });
  }

  const detectedPythonVersion = hasPythonFiles
    ? detectPythonVersionTarget(repo)
    : languageProfile.runtime === "nodejs20"
    ? `Node.js 20 LTS (${languageProfile.primaryLanguage})`
    : "Unspecified";

  const targetPythonVersion = hasPythonFiles
    ? "Python 3.12"
    : languageProfile.primaryLanguage === "typescript"
    ? "Node.js 20 + TypeScript 5.9"
    : "Node.js 20 ESM";

  const toxicityScore = Math.min(
    100,
    findings.reduce((sum, f) => {
      if (f.origin !== "confirmed") return sum;
      if (f.severity === "FATAL") return sum + 25;
      if (f.severity === "SECURITY_HAZARD") return sum + 20;
      if (f.severity === "DEPRECATED") return sum + 10;
      return sum + 5;
    }, 0)
  );

  const fatalCount = findings.filter(
    (f) => f.severity === "FATAL" || f.severity === "SECURITY_HAZARD"
  ).length;
  const primaryCauseOfDeath =
    findings.length === 0
      ? `No confirmed ${languageProfile.primaryLanguage} compatibility or dependency failures detected`
      : fatalCount > 0
      ? `${fatalCount} fatal compatibility, syntax, type, or dependency failure(s) blocking ${targetPythonVersion}`
      : "Non-fatal deprecation or missing project configuration warnings";

  return {
    repositoryName: repo.name,
    isPythonProject: repo.isPythonProject,
    languageProfile,
    detectedPythonVersion,
    targetPythonVersion,
    toxicityScore,
    primaryCauseOfDeath,
    syntaxCheckEngine,
    tsDiagnostics,
    dependencies,
    discoveredTests,
    findings,
    aiStatus: "not_requested",
  };
}

import path from "node:path";
import ts from "typescript";
import { diagnoseLegacyCode } from "./diagnoser";
import { evaluateNodeDependencyPolicy } from "./node-dependency-policy";
import { DiagnosisFinding, IngestedRepository } from "./schemas";

export interface TypeScriptDiagnosticItem {
  file: string;
  line: number;
  column: number;
  severity: "ERROR" | "WARNING";
  code: string;
  message: string;
}

export interface NodeDiagnosisSummary {
  findings: DiagnosisFinding[];
  tsDiagnostics: TypeScriptDiagnosticItem[];
  discoveredTests: Array<{
    file: string;
    testNames: string[];
    runnerHint: "node:test" | "jest" | "vitest" | "unknown";
  }>;
  dependencyPolicy: ReturnType<typeof evaluateNodeDependencyPolicy>;
}

export function validateJsTsSyntaxAndTypes(
  files: Array<{ path: string; content: string }>
): {
  syntaxValid: boolean;
  tsDiagnostics: TypeScriptDiagnosticItem[];
} {
  const tsDiagnostics: TypeScriptDiagnosticItem[] = [];
  const fileMap = new Map<string, string>();
  for (const f of files) {
    fileMap.set(f.path, f.content);
  }

  // 1. Parse-level syntax diagnostics on every JS/TS file
  const sourceFiles: string[] = [];
  for (const f of files) {
    if (!/\.(js|mjs|cjs|ts|tsx|mts|cts)$/i.test(f.path)) continue;
    sourceFiles.push(f.path);

    const scriptKind = f.path.endsWith(".tsx")
      ? ts.ScriptKind.TSX
      : /\.(ts|mts|cts)$/i.test(f.path)
      ? ts.ScriptKind.TS
      : ts.ScriptKind.JS;

    const sf = ts.createSourceFile(
      f.path,
      f.content,
      ts.ScriptTarget.ES2022,
      true,
      scriptKind
    );

    const parseDiags =
      (sf as unknown as { parseDiagnostics?: ts.DiagnosticWithLocation[] })
        .parseDiagnostics ?? [];

    for (const d of parseDiags) {
      const pos = sf.getLineAndCharacterOfPosition(d.start ?? 0);
      tsDiagnostics.push({
        file: f.path,
        line: pos.line + 1,
        column: pos.character + 1,
        severity: "ERROR",
        code: `TS${d.code}`,
        message: ts.flattenDiagnosticMessageText(d.messageText, " "),
      });
    }
  }

  // 2. Semantic type-checking for TypeScript files using an in-memory virtual host
  const tsOnlyFiles = sourceFiles.filter((p) => /\.(ts|tsx|mts|cts)$/i.test(p));
  if (tsOnlyFiles.length > 0) {
    let compilerOptions: ts.CompilerOptions = {
      noEmit: true,
      strict: true,
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      esModuleInterop: true,
      skipLibCheck: true,
      jsx: ts.JsxEmit.ReactJSX,
    };

    const tsconfigRaw = fileMap.get("tsconfig.json");
    if (tsconfigRaw) {
      const parsedCfg = ts.parseConfigFileTextToJson("tsconfig.json", tsconfigRaw);
      if (parsedCfg.config?.compilerOptions) {
        const converted = ts.convertCompilerOptionsFromJson(
          parsedCfg.config.compilerOptions,
          "."
        );
        if (converted.errors.length === 0) {
          compilerOptions = {
            ...converted.options,
            noEmit: true,
            skipLibCheck: true,
          };
        }
      }
    }

    const defaultHost = ts.createCompilerHost(compilerOptions);
    const virtualHost: ts.CompilerHost = {
      ...defaultHost,
      fileExists: (fileName) => {
        const clean = fileName.replace(/^\.\//, "");
        if (fileMap.has(clean) || fileMap.has(fileName)) return true;
        // Only fall back to disk for TypeScript standard lib.*.d.ts
        if (fileName.includes("typescript/lib/")) {
          return defaultHost.fileExists(fileName);
        }
        return false;
      },
      readFile: (fileName) => {
        const clean = fileName.replace(/^\.\//, "");
        if (fileMap.has(clean)) return fileMap.get(clean);
        if (fileMap.has(fileName)) return fileMap.get(fileName);
        if (fileName.includes("typescript/lib/")) {
          return defaultHost.readFile(fileName);
        }
        return undefined;
      },
      getSourceFile: (fileName, languageVersion) => {
        const clean = fileName.replace(/^\.\//, "");
        const memContent = fileMap.get(clean) ?? fileMap.get(fileName);
        if (memContent !== undefined) {
          return ts.createSourceFile(fileName, memContent, languageVersion);
        }
        if (fileName.includes("typescript/lib/")) {
          return defaultHost.getSourceFile(fileName, languageVersion);
        }
        return undefined;
      },
    };

    const program = ts.createProgram(tsOnlyFiles, compilerOptions, virtualHost);
    const semanticDiags = program.getSemanticDiagnostics();

    for (const d of semanticDiags) {
      if (!d.file) continue;
      // Ignore missing @types/node declarations in virtual memory unless local import
      const msg = ts.flattenDiagnosticMessageText(d.messageText, " ");
      if (
        d.code === 2307 &&
        /Cannot find module '(node:|fs|path|http|crypto|os|net)/.test(msg)
      ) {
        continue;
      }
      const pos = d.file.getLineAndCharacterOfPosition(d.start ?? 0);
      const rel = d.file.fileName.replace(/^\.\//, "");
      if (!fileMap.has(rel)) continue;
      tsDiagnostics.push({
        file: rel,
        line: pos.line + 1,
        column: pos.character + 1,
        severity:
          d.category === ts.DiagnosticCategory.Warning ? "WARNING" : "ERROR",
        code: `TS${d.code}`,
        message: msg,
      });
    }
  }

  return {
    syntaxValid: !tsDiagnostics.some((d) => d.severity === "ERROR"),
    tsDiagnostics,
  };
}

export function diagnoseNodeRepository(
  repo: IngestedRepository
): NodeDiagnosisSummary {
  const findings: DiagnosisFinding[] = [];
  const discoveredTests: NodeDiagnosisSummary["discoveredTests"] = [];
  let idx = 1;
  const nextId = () => `node_finding_${idx++}`;

  const dependencyPolicy = evaluateNodeDependencyPolicy(repo.files);
  for (const blocked of dependencyPolicy.blockedDirectives) {
    findings.push({
      id: nextId(),
      finding: "UNSAFE_NODE_DEPENDENCY_POLICY",
      category: "security",
      severity: "SECURITY_HAZARD",
      origin: "confirmed",
      file: "package.json",
      explanation: blocked,
      recommendedRepair:
        "Remove lifecycle scripts, custom registries, or git/URL/file dependencies.",
    });
  }

  const pkgFile = repo.files.find((f) => f.path.toLowerCase() === "package.json");
  let isEsmPackage = false;
  if (pkgFile) {
    try {
      const parsed = JSON.parse(pkgFile.content) as { type?: string };
      isEsmPackage = parsed.type === "module";
    } catch {
      findings.push({
        id: nextId(),
        finding: "INVALID_PACKAGE_JSON",
        category: "config",
        severity: "FATAL",
        origin: "confirmed",
        file: pkgFile.path,
        explanation: "package.json is not valid JSON.",
        recommendedRepair: "Fix JSON syntax errors in package.json.",
      });
    }
  }

  const allPaths = new Set(repo.files.map((f) => f.path));
  const compilerCheck = validateJsTsSyntaxAndTypes(repo.files);

  for (const d of compilerCheck.tsDiagnostics) {
    findings.push({
      id: nextId(),
      finding: `COMPILER_${d.code}`,
      category: "syntax",
      severity: d.severity === "ERROR" ? "FATAL" : "WARNING",
      origin: "confirmed",
      file: d.file,
      line: d.line,
      explanation: `${d.code} (col ${d.column}): ${d.message}`,
      recommendedRepair: "Resolve compiler syntax or type mismatch.",
    });
  }

  for (const file of repo.files) {
    if (file.language !== "javascript" && file.language !== "typescript") continue;

    // Run line-based JS/Node legacy rules (request, new Buffer, module.exports)
    const legacy = diagnoseLegacyCode(file.content, file.language, file.path);
    for (const err of legacy.fatalErrors) {
      findings.push({
        id: nextId(),
        finding: err.rule,
        category:
          err.rule === "DEAD_REQUEST_PACKAGE"
            ? "dependency"
            : err.rule === "UNSAFE_BUFFER_ALLOCATION"
            ? "security"
            : "compatibility",
        severity: err.severity,
        origin: "confirmed",
        file: file.path,
        line: err.line,
        explanation: err.diagnosis,
        recommendedRepair: err.recommendedRepair || "Migrate to Node 20+ ESM standard.",
        legacySnippet: err.legacySnippet,
        repairedSnippet: err.repairedSnippet,
      });
    }

    // Detect CJS/ESM mismatch & missing local relative imports
    if (file.path.endsWith(".js")) {
      if (isEsmPackage && /\b(require\s*\(|module\.exports\s*=)/.test(file.content)) {
        findings.push({
          id: nextId(),
          finding: "ESM_COMMONJS_MISMATCH",
          category: "compatibility",
          severity: "FATAL",
          origin: "confirmed",
          file: file.path,
          line: 1,
          explanation:
            "CommonJS require()/module.exports used in a .js file while package.json specifies \"type\": \"module\".",
          recommendedRepair: "Convert file to ESM import/export or rename to .cjs.",
        });
      }
    }

    const dir = path.posix.dirname(file.path);
    const lines = file.content.split("\n");
    lines.forEach((line, lineIdx) => {
      const m = line.match(
        /(?:import\s+[^'"]*from\s*|require\s*\()\s*['"](\.[^'"]+)['"]/
      );
      if (m) {
        const spec = m[1];
        const norm = path.posix.normalize(dir === "." ? spec : `${dir}/${spec}`);
        const candidates = [
          norm,
          `${norm}.js`,
          `${norm}.mjs`,
          `${norm}.cjs`,
          `${norm}.ts`,
          `${norm}.tsx`,
          `${norm}.json`,
          `${norm}/index.js`,
          `${norm}/index.ts`,
        ];
        if (norm.endsWith(".js")) {
          candidates.push(`${norm.slice(0, -3)}.ts`, `${norm.slice(0, -3)}.tsx`);
        }
        if (!candidates.some((c) => allPaths.has(c))) {
          findings.push({
            id: nextId(),
            finding: "MISSING_LOCAL_IMPORT",
            category: "import",
            severity: "FATAL",
            origin: "confirmed",
            file: file.path,
            line: lineIdx + 1,
            explanation: `Relative import '${spec}' does not resolve to any file in the repository.`,
            recommendedRepair: "Fix import path or restore missing module file.",
            legacySnippet: line.trim(),
          });
        }
      }
    });

    if (file.isTestFile) {
      const testNames: string[] = [];
      for (const m of file.content.matchAll(/\b(?:test|it)\s*\(\s*['"`]([^'"`]+)['"`]/g)) {
        testNames.push(m[1]);
      }
      const runnerHint = /\bfrom\s+['"]vitest['"]/.test(file.content)
        ? "vitest"
        : /\bfrom\s+['"]@jest\/globals['"]/.test(file.content)
        ? "jest"
        : /['"]node:test['"]/.test(file.content)
        ? "node:test"
        : "unknown";
      discoveredTests.push({
        file: file.path,
        testNames,
        runnerHint,
      });
    }
  }

  return {
    findings,
    tsDiagnostics: compilerCheck.tsDiagnostics,
    discoveredTests,
    dependencyPolicy,
  };
}

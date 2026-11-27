#!/usr/bin/env node
/**
 * PatchPulse Isolated Node.js 20 LTS & TypeScript 5.9.3 Verification Runner.
 * Executes strictly inside an ephemeral Docker container or macOS Seatbelt sandbox.
 * Never runs arbitrary package.json scripts or shell-concatenated commands.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const WORKSPACE = path.resolve(process.cwd());
const RESULT_PREFIX = "__NECRO_SANDBOX_RESULT__:";
const TSC_BIN = process.env.NECRO_TSC_BIN || "/usr/local/lib/node_modules/typescript/bin/tsc";

function walkWorkspaceFiles(dir, relBase = "") {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (
      entry.name === "node_modules" ||
      entry.name === ".git" ||
      entry.name === "__necro_dist__"
    ) {
      continue;
    }
    const fullPath = path.join(dir, entry.name);
    const relPath = relBase ? `${relBase}/${entry.name}` : entry.name;
    const stat = fs.lstatSync(fullPath);
    if (stat.isSymbolicLink()) {
      throw new Error(`Unsafe symlink encountered in workspace: ${relPath}`);
    }
    if (entry.isDirectory()) {
      results.push(...walkWorkspaceFiles(fullPath, relPath));
    } else if (entry.isFile()) {
      results.push(relPath);
    }
  }
  return results.sort();
}

function isJsFile(p) {
  return /\.(js|mjs|cjs)$/i.test(p);
}

function isTsFile(p) {
  return /\.(ts|tsx|mts|cts)$/i.test(p) && !/\.d\.ts$/i.test(p);
}

function isTestFile(p) {
  const lower = p.toLowerCase();
  const base = path.basename(lower);
  const parts = lower.split("/");
  const validExt = /\.(js|mjs|cjs|ts|mts|cts)$/i.test(base);
  if (!validExt) return false;
  return (
    /\.(test|spec)\.(js|mjs|cjs|ts|mts|cts)$/i.test(base) ||
    parts.includes("test") ||
    parts.includes("tests") ||
    parts.includes("__tests__")
  );
}

function readPackageJson() {
  const pkgPath = path.join(WORKSPACE, "package.json");
  if (!fs.existsSync(pkgPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  } catch {
    return { __invalidJson: true };
  }
}

function checkRelativeImports(relPath, content, allFilesSet) {
  const errors = [];
  const dir = path.posix.dirname(relPath);
  const rx = /(?:import\s+[^'"]*from\s*|import\s*\(|require\s*\()\s*['"](\.[^'"]+)['"]/g;
  for (const m of content.matchAll(rx)) {
    const spec = m[1];
    const resolvedBase = path.posix.normalize(
      dir === "." ? spec : `${dir}/${spec}`
    );
    if (resolvedBase.startsWith("..")) {
      errors.push({
        file: relPath,
        message: `Relative import '${spec}' escapes workspace root.`,
      });
      continue;
    }
    const candidates = [
      resolvedBase,
      `${resolvedBase}.js`,
      `${resolvedBase}.mjs`,
      `${resolvedBase}.cjs`,
      `${resolvedBase}.ts`,
      `${resolvedBase}.tsx`,
      `${resolvedBase}.json`,
      `${resolvedBase}/index.js`,
      `${resolvedBase}/index.ts`,
    ];
    // TypeScript NodeNext maps ./foo.js -> ./foo.ts
    if (resolvedBase.endsWith(".js")) {
      const stem = resolvedBase.slice(0, -3);
      candidates.push(`${stem}.ts`, `${stem}.tsx`);
    }
    if (!candidates.some((c) => allFilesSet.has(c))) {
      errors.push({
        file: relPath,
        message: `Missing local import target '${spec}'.`,
      });
    }
  }
  return errors;
}

function validateJavaScriptFiles(jsFiles, allFilesSet, pkg) {
  const syntaxErrors = [];
  const diagnostics = [];

  for (const rel of jsFiles) {
    const full = path.join(WORKSPACE, rel);
    const proc = spawnSync(process.execPath, ["--check", full], {
      encoding: "utf8",
      timeout: 3000,
    });

    if (proc.status !== 0) {
      syntaxErrors.push({
        file: rel,
        message: (proc.stderr || proc.stdout || "JavaScript syntax error").trim().slice(0, 1200),
      });
    }

    const content = fs.readFileSync(full, "utf8");
    const importErrors = checkRelativeImports(rel, content, allFilesSet);
    for (const ie of importErrors) {
      diagnostics.push({ ...ie, severity: "ERROR", code: "MISSING_LOCAL_IMPORT" });
    }

    const isEsmProject = pkg?.type === "module";
    if (rel.endsWith(".js")) {
      if (isEsmProject && /\b(require\s*\(|module\.exports\s*=|exports\.)/.test(content)) {
        diagnostics.push({
          file: rel,
          code: "ESM_COMMONJS_MISMATCH",
          severity: "ERROR",
          message: "CommonJS require/module.exports used in a package.json 'type: module' .js file.",
        });
      } else if (!isEsmProject && /^\s*(import\s+[\s\S]*?from\s+['"]|export\s+(default|const|function|async|class|\{))/m.test(content)) {
        diagnostics.push({
          file: rel,
          code: "CJS_ESM_MISMATCH",
          severity: "WARNING",
          message: "ES module import/export syntax used in a .js file without package.json 'type: module'.",
        });
      }
    }
  }

  return { syntaxErrors, diagnostics };
}

function validateTsConfigSafety() {
  const tsconfigPath = path.join(WORKSPACE, "tsconfig.json");
  if (!fs.existsSync(tsconfigPath)) return { exists: false, safe: true };
  try {
    const raw = fs.readFileSync(tsconfigPath, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed.extends && (String(parsed.extends).includes("..") || path.isAbsolute(String(parsed.extends)))) {
      return {
        exists: true,
        safe: false,
        reason: `Unsafe tsconfig.json extends path rejected: ${parsed.extends}`,
      };
    }
    return { exists: true, safe: true, config: parsed };
  } catch {
    return {
      exists: true,
      safe: false,
      reason: "Invalid JSON syntax in tsconfig.json.",
    };
  }
}

function parseTscDiagnostics(outputText) {
  const tsDiagnostics = [];
  const lineRx = /^(.+?)\((\d+),(\d+)\):\s+(error|warning)\s+(TS\d+):\s+(.+)$/gm;
  for (const m of outputText.matchAll(lineRx)) {
    const code = m[5];
    const message = m[6].trim();
    // Node.js built-in modules (node:test, node:assert, etc.) are present in Node 20 runtime
    // even when @types/node is not installed inside an offline sandbox workspace.
    if (
      code === "TS2307" &&
      /Cannot find module '(node:[^']+|fs|path|http|https|crypto|os|net|child_process|assert|util|events|url)'/.test(
        message
      )
    ) {
      continue;
    }
    const rawFile = m[1].trim();
    const relFile = rawFile.startsWith(WORKSPACE)
      ? path.relative(WORKSPACE, rawFile).replace(/\\/g, "/")
      : rawFile;
    tsDiagnostics.push({
      file: relFile,
      line: Number(m[2]),
      column: Number(m[3]),
      severity: m[4].toUpperCase(),
      code,
      message,
    });
  }
  return tsDiagnostics;
}

function runTypeScriptCheck(tsFiles, hasTsConfig) {
  if (!fs.existsSync(TSC_BIN)) {
    return {
      ran: false,
      passed: false,
      tsDiagnostics: [
        {
          file: "(compiler)",
          line: 1,
          column: 1,
          severity: "ERROR",
          code: "TSC_MISSING",
          message: `Pinned TypeScript compiler binary not found at ${TSC_BIN}.`,
        },
      ],
      rawOutput: "tsc binary missing",
    };
  }

  const args = hasTsConfig
    ? [TSC_BIN, "--noEmit", "--pretty", "false", "-p", path.join(WORKSPACE, "tsconfig.json")]
    : [
        TSC_BIN,
        "--noEmit",
        "--pretty",
        "false",
        "--strict",
        "--target",
        "ES2022",
        "--module",
        "NodeNext",
        "--moduleResolution",
        "NodeNext",
        "--esModuleInterop",
        "--skipLibCheck",
        ...tsFiles.map((f) => path.join(WORKSPACE, f)),
      ];

  const proc = spawnSync(process.execPath, args, {
    cwd: WORKSPACE,
    encoding: "utf8",
    timeout: 8000,
  });

  const combined = `${proc.stdout || ""}\n${proc.stderr || ""}`.trim();
  const tsDiagnostics = parseTscDiagnostics(combined);
  const hasRealErrors = tsDiagnostics.some((d) => d.severity === "ERROR");
  return {
    ran: true,
    passed: proc.status === 0 || (!hasRealErrors && combined.includes("TS2307")),
    tsDiagnostics,
    rawOutput: combined,
  };
}

function compileTypeScriptForTestRun(tsFiles) {
  let outDir;
  try {
    outDir = fs.mkdtempSync(path.join(os.tmpdir(), "necro-ts-out-"));
  } catch {
    outDir = path.join(WORKSPACE, "__necro_dist__");
    fs.mkdirSync(outDir, { recursive: true });
  }
  // Emit CommonJS cleanly into outDir under /tmp (writable in Seatbelt/Docker tmpfs)
  const proc = spawnSync(
    process.execPath,
    [
      TSC_BIN,
      "--pretty",
      "false",
      "--target",
      "ES2022",
      "--module",
      "CommonJS",
      "--moduleResolution",
      "Node",
      "--esModuleInterop",
      "--skipLibCheck",
      "--outDir",
      outDir,
      "--rootDir",
      WORKSPACE,
      ...tsFiles.map((f) => path.join(WORKSPACE, f)),
    ],
    {
      cwd: WORKSPACE,
      encoding: "utf8",
      timeout: 8000,
    }
  );

  // Add package.json { "type": "commonjs" } in outDir so .js files load cleanly as CJS
  fs.writeFileSync(
    path.join(outDir, "package.json"),
    JSON.stringify({ type: "commonjs" }),
    "utf8"
  );

  const combined = `${proc.stdout || ""}\n${proc.stderr || ""}`.trim();
  const remainingErrors = parseTscDiagnostics(combined).filter((d) => d.severity === "ERROR");

  return {
    ok: proc.status === 0 || remainingErrors.length === 0,
    outDir,
    output: combined,
  };
}

function parseTapOutput(tapText) {
  let total = 0;
  let passed = 0;
  let failed = 0;
  let skipped = 0;
  const failures = [];

  const testsMatch = tapText.match(/^#\s+tests\s+(\d+)/m);
  const passMatch = tapText.match(/^#\s+pass\s+(\d+)/m);
  const failMatch = tapText.match(/^#\s+fail\s+(\d+)/m);
  const skipMatch = tapText.match(/^#\s+skipped\s+(\d+)/m);

  if (testsMatch) total = Number(testsMatch[1]);
  if (passMatch) passed = Number(passMatch[1]);
  if (failMatch) failed = Number(failMatch[1]);
  if (skipMatch) skipped = Number(skipMatch[1]);

  const notOkRx = /^not ok \d+ - (.+)$/gm;
  for (const m of tapText.matchAll(notOkRx)) {
    const startIdx = m.index ?? 0;
    const slice = tapText.slice(startIdx, startIdx + 1200);
    failures.push({
      test: m[1].trim(),
      trace: slice,
    });
  }

  return { total, passed, failed, skipped, failures };
}

function emitResult(payload, exitCode) {
  process.stdout.write(`${RESULT_PREFIX}${JSON.stringify(payload)}\n`);
  process.exit(exitCode);
}

function main() {
  const t0 = Date.now();
  let allFiles = [];

  try {
    allFiles = walkWorkspaceFiles(WORKSPACE);
  } catch (err) {
    emitResult(
      {
        status: "FAILED",
        syntaxValid: false,
        syntaxErrors: [{ file: "(workspace)", message: err.message }],
        tsDiagnostics: [],
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        skippedTests: 0,
        failures: [],
        durationMs: Date.now() - t0,
        exitCode: 2,
        runner: "node20+tsc5.9",
        logs: err.message,
      },
      2
    );
    return;
  }

  const pkg = readPackageJson();
  if (pkg?.__invalidJson) {
    emitResult(
      {
        status: "FAILED",
        syntaxValid: false,
        syntaxErrors: [{ file: "package.json", message: "Malformed JSON in package.json." }],
        tsDiagnostics: [],
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        skippedTests: 0,
        failures: [],
        durationMs: Date.now() - t0,
        exitCode: 1,
        runner: "node20+tsc5.9",
        logs: "package.json failed JSON parsing.",
      },
      1
    );
    return;
  }

  const allFilesSet = new Set(allFiles);
  const jsFiles = allFiles.filter(isJsFile);
  const tsFiles = allFiles.filter(isTsFile);
  const testFiles = allFiles.filter(isTestFile);

  const jsCheck = validateJavaScriptFiles(jsFiles, allFilesSet, pkg);
  const syntaxErrors = [...jsCheck.syntaxErrors];
  const tsDiagnostics = [...jsCheck.diagnostics];

  // TypeScript check
  const tsconfigSafety = validateTsConfigSafety();
  if (!tsconfigSafety.safe) {
    emitResult(
      {
        status: "FAILED",
        syntaxValid: false,
        syntaxErrors: [{ file: "tsconfig.json", message: tsconfigSafety.reason }],
        tsDiagnostics: [],
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        skippedTests: 0,
        failures: [],
        durationMs: Date.now() - t0,
        exitCode: 1,
        runner: "tsc5.9.3",
        logs: tsconfigSafety.reason,
      },
      1
    );
    return;
  }

  let tsPassed = true;
  if (tsFiles.length > 0) {
    const tsRes = runTypeScriptCheck(tsFiles, tsconfigSafety.exists);
    tsPassed = tsRes.passed;
    tsDiagnostics.push(...tsRes.tsDiagnostics);
    if (!tsRes.passed && tsRes.tsDiagnostics.length === 0) {
      syntaxErrors.push({ file: "tsconfig.json", message: tsRes.rawOutput || "TypeScript check failed." });
    }
  }

  const hasFatalDiag = tsDiagnostics.some((d) => d.severity === "ERROR");
  const syntaxValid = syntaxErrors.length === 0 && tsPassed && !hasFatalDiag;

  if (!syntaxValid) {
    emitResult(
      {
        status: "FAILED",
        syntaxValid: false,
        syntaxErrors,
        tsDiagnostics,
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        skippedTests: 0,
        failures: tsDiagnostics
          .filter((d) => d.severity === "ERROR")
          .slice(0, 10)
          .map((d) => ({
            test: `${d.file}:${d.line || 1}`,
            trace: `${d.code}: ${d.message}`,
          })),
        durationMs: Date.now() - t0,
        exitCode: 1,
        runner: tsFiles.length > 0 ? "node20+tsc5.9.3" : "node20 --check",
        logs: "Syntax or TypeScript compiler check failed.",
      },
      1
    );
    return;
  }

  if (testFiles.length === 0) {
    emitResult(
      {
        status: "NO_TESTS_FOUND",
        syntaxValid: true,
        syntaxErrors: [],
        tsDiagnostics,
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        skippedTests: 0,
        failures: [],
        durationMs: Date.now() - t0,
        exitCode: 0,
        runner: tsFiles.length > 0 ? "node20+tsc5.9.3" : "node20 --check",
        logs: "Syntax/type validation passed. No test files discovered.",
      },
      0
    );
    return;
  }

  // Check if tests rely on unsupported external test runners (Jest/Vitest)
  const usesUnsupportedRunner = testFiles.some((tf) => {
    const src = fs.readFileSync(path.join(WORKSPACE, tf), "utf8");
    return /\bfrom\s+['"]vitest['"]|\bfrom\s+['"]@jest\/globals['"]/.test(src);
  });

  if (usesUnsupportedRunner) {
    emitResult(
      {
        status: "VERIFICATION_BLOCKED",
        syntaxValid: true,
        syntaxErrors: [],
        tsDiagnostics,
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        skippedTests: 0,
        failures: [
          {
            test: "test_runner_policy",
            trace: "Detected Vitest/Jest test imports which require unbundled third-party test packages in offline sandbox.",
          },
        ],
        durationMs: Date.now() - t0,
        exitCode: 1,
        runner: "node:test",
        logs: "Verification blocked: Jest/Vitest test dependencies are not available in offline sandbox.",
      },
      1
    );
    return;
  }

  // Execute node:test / assertion tests
  let runnableTestPaths = [];
  let compiledTmpDir = null;

  try {
    if (tsFiles.length > 0) {
      const compiled = compileTypeScriptForTestRun(tsFiles);
      compiledTmpDir = compiled.outDir;
      if (!compiled.ok) {
        emitResult(
          {
            status: "FAILED",
            syntaxValid: false,
            syntaxErrors: [{ file: "(tsc emit)", message: compiled.output }],
            tsDiagnostics,
            totalTests: 0,
            passedTests: 0,
            failedTests: 0,
            skippedTests: 0,
            failures: [],
            durationMs: Date.now() - t0,
            exitCode: 1,
            runner: "tsc5.9.3",
            logs: "Failed to compile TypeScript files for test execution.",
          },
          1
        );
        return;
      }

      for (const tf of testFiles) {
        if (isTsFile(tf)) {
          const compiledRel = tf.replace(/\.(ts|tsx|mts|cts)$/i, ".js");
          const candidate = path.join(compiledTmpDir, compiledRel);
          if (fs.existsSync(candidate)) runnableTestPaths.push(candidate);
        } else {
          runnableTestPaths.push(path.join(WORKSPACE, tf));
        }
      }
    } else {
      runnableTestPaths = testFiles.map((tf) => path.join(WORKSPACE, tf));
    }

    const testProc = spawnSync(
      process.execPath,
      ["--max-old-space-size=128", "--test", "--test-reporter=tap", ...runnableTestPaths],
      {
        cwd: WORKSPACE,
        encoding: "utf8",
        timeout: 10_000,
        maxBuffer: 256 * 1024,
      }
    );

    const tapOutput = `${testProc.stdout || ""}\n${testProc.stderr || ""}`.trim();
    if (Buffer.byteLength(tapOutput, "utf8") > 64 * 1024) {
      emitResult(
        {
          status: "FAILED",
          syntaxValid: true,
          syntaxErrors: [],
          tsDiagnostics,
          totalTests: 0,
          passedTests: 0,
          failedTests: 0,
          skippedTests: 0,
          failures: [
            {
              test: "output_limit_exceeded",
              trace: "Test output exceeded 64 KB cap and was terminated.",
            },
          ],
          outputTruncated: true,
          durationMs: Date.now() - t0,
          exitCode: 1,
          runner: tsFiles.length > 0 ? "tsc5.9.3+node:test" : "node:test",
          logs: tapOutput.slice(0, 4000),
        },
        1
      );
      return;
    }
    const parsedTap = parseTapOutput(tapOutput);

    if (parsedTap.total === 0) {
      emitResult(
        {
          status: "NO_TESTS_FOUND",
          syntaxValid: true,
          syntaxErrors: [],
          tsDiagnostics,
          totalTests: 0,
          passedTests: 0,
          failedTests: 0,
          skippedTests: 0,
          failures: [],
          durationMs: Date.now() - t0,
          exitCode: 0,
          runner: "node:test",
          logs: tapOutput || "No tests executed by node:test.",
        },
        0
      );
      return;
    }

    const status =
      parsedTap.failed === 0 && parsedTap.passed > 0
        ? "PASSED"
        : parsedTap.passed > 0 && parsedTap.failed > 0
        ? "PARTIAL"
        : "FAILED";

    emitResult(
      {
        status,
        syntaxValid: true,
        syntaxErrors: [],
        tsDiagnostics,
        totalTests: parsedTap.total,
        passedTests: parsedTap.passed,
        failedTests: parsedTap.failed,
        skippedTests: parsedTap.skipped,
        failures: parsedTap.failures,
        durationMs: Date.now() - t0,
        exitCode: typeof testProc.status === "number" ? testProc.status : 1,
        runner: tsFiles.length > 0 ? "tsc5.9.3+node:test" : "node:test",
        logs: tapOutput.slice(-8000),
      },
      testProc.status === 0 ? 0 : 1
    );
  } finally {
    if (compiledTmpDir) {
      try {
        fs.rmSync(compiledTmpDir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
  }
}

main();

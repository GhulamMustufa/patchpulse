export interface ProjectLanguageProfile {
  primaryLanguage: "python" | "javascript" | "typescript" | "mixed" | "unsupported";
  detectedLanguages: string[];
  runtime: "python3.12" | "nodejs20" | "mixed" | "unsupported";
  framework: string;
  detectedFrameworks: string[];
  packageManager: "npm" | "yarn" | "pnpm" | "pip" | "poetry" | "unknown";
  testFramework: "node:test" | "jest" | "vitest" | "pytest" | "unittest" | "none";
  entryPoints: string[];
  dependencyFiles: string[];
  supportedVerificationCapabilities: {
    syntaxCheck: boolean;
    typeCheck: boolean;
    testExecution: boolean;
    unsupportedReasons: string[];
  };
}

interface DetectFileInput {
  path: string;
  content: string;
}

export function detectProjectLanguageAndFramework(
  files: DetectFileInput[]
): ProjectLanguageProfile {
  const lowerPaths = files.map((f) => f.path.toLowerCase());
  const pyFiles = files.filter((f) => /\.py$/i.test(f.path));
  const jsFiles = files.filter(
    (f) =>
      /\.(js|mjs|cjs)$/i.test(f.path) &&
      !/^(?:next|vite|vitest|jest|eslint|postcss|tailwind)\.config\./i.test(
        f.path.split("/").pop() || ""
      )
  );
  const tsFiles = files.filter(
    (f) => /\.(ts|tsx|mts|cts)$/i.test(f.path) && !/\.d\.ts$/i.test(f.path)
  );

  const pkgFile = files.find((f) => f.path.toLowerCase() === "package.json");
  const tsconfigFile = files.find((f) => f.path.toLowerCase() === "tsconfig.json");
  const hasPkgJson = Boolean(pkgFile);

  let parsedPkg: Record<string, unknown> | null = null;
  if (pkgFile) {
    try {
      parsedPkg = JSON.parse(pkgFile.content) as Record<string, unknown>;
    } catch {
      parsedPkg = null;
    }
  }

  const allDeps: Record<string, string> = {
    ...((parsedPkg?.dependencies as Record<string, string> | undefined) ?? {}),
    ...((parsedPkg?.devDependencies as Record<string, string> | undefined) ?? {}),
  };

  const detectedLanguages: string[] = [];
  if (pyFiles.length > 0) detectedLanguages.push("Python");
  if (tsFiles.length > 0 || tsconfigFile) detectedLanguages.push("TypeScript");
  if (jsFiles.length > 0 || (hasPkgJson && tsFiles.length === 0)) {
    detectedLanguages.push("JavaScript");
  }

  let primaryLanguage: ProjectLanguageProfile["primaryLanguage"] = "unsupported";
  let runtime: ProjectLanguageProfile["runtime"] = "unsupported";

  const hasPy = pyFiles.length > 0;
  const hasTs = tsFiles.length > 0;
  const hasJs = jsFiles.length > 0 || (hasPkgJson && !hasTs);

  if (hasPy && (hasTs || hasJs)) {
    primaryLanguage = "mixed";
    runtime = "mixed";
  } else if (hasPy) {
    primaryLanguage = "python";
    runtime = "python3.12";
  } else if (hasTs && hasJs) {
    primaryLanguage = "mixed";
    runtime = "nodejs20";
  } else if (hasTs) {
    primaryLanguage = "typescript";
    runtime = "nodejs20";
  } else if (hasJs) {
    primaryLanguage = "javascript";
    runtime = "nodejs20";
  }

  // Detect frameworks from config files + package dependencies + Python imports
  const frameworks = new Set<string>();
  if (lowerPaths.some((p) => /^next\.config\./.test(p)) || "next" in allDeps) {
    frameworks.add("Next.js");
  }
  if (lowerPaths.some((p) => /^vite\.config\./.test(p)) || "vite" in allDeps) {
    frameworks.add("Vite");
  }
  if (lowerPaths.includes("nest-cli.json") || "@nestjs/core" in allDeps) {
    frameworks.add("NestJS");
  }
  if ("express" in allDeps) frameworks.add("Express");
  if ("react" in allDeps || tsFiles.some((f) => f.path.endsWith(".tsx"))) {
    frameworks.add("React");
  }

  const combinedText = files.map((f) => f.content).join("\n");
  if (/\bdjango\b/i.test(combinedText)) frameworks.add("Django");
  if (/\bflask\b/i.test(combinedText)) frameworks.add("Flask");
  if (/\bfastapi\b/i.test(combinedText)) frameworks.add("FastAPI");

  // Package manager
  let packageManager: ProjectLanguageProfile["packageManager"] = "unknown";
  if (lowerPaths.includes("pnpm-lock.yaml")) packageManager = "pnpm";
  else if (lowerPaths.includes("yarn.lock")) packageManager = "yarn";
  else if (lowerPaths.includes("package-lock.json") || hasPkgJson) packageManager = "npm";
  else if (lowerPaths.includes("poetry.lock") || lowerPaths.includes("pyproject.toml")) {
    packageManager = "poetry";
  } else if (lowerPaths.some((p) => p.includes("requirements") || p === "setup.py")) {
    packageManager = "pip";
  }

  // Test framework
  let testFramework: ProjectLanguageProfile["testFramework"] = "none";
  if ("vitest" in allDeps || lowerPaths.some((p) => /^vitest\.config\./.test(p)) || /\bfrom\s+['"]vitest['"]/.test(combinedText)) {
    testFramework = "vitest";
  } else if ("jest" in allDeps || lowerPaths.some((p) => /^jest\.config\./.test(p)) || /\bfrom\s+['"]@jest\/globals['"]/.test(combinedText)) {
    testFramework = "jest";
  } else if (/['"]node:test['"]/.test(combinedText)) {
    testFramework = "node:test";
  } else if (/\bpytest\b/.test(combinedText)) {
    testFramework = "pytest";
  } else if (/\bunittest\b/.test(combinedText)) {
    testFramework = "unittest";
  }

  // Entry points & dependency files
  const entryCandidates = [
    "src/index.ts",
    "src/index.js",
    "src/app.ts",
    "src/app.js",
    "index.ts",
    "index.js",
    "index.mjs",
    "server.js",
    "server.mjs",
    "app.py",
    "main.py",
  ];
  const entryPoints = files
    .map((f) => f.path)
    .filter((p) => entryCandidates.includes(p.toLowerCase()));
  if (typeof parsedPkg?.main === "string" && !entryPoints.includes(parsedPkg.main)) {
    entryPoints.unshift(parsedPkg.main);
  }

  const dependencyFiles = files
    .map((f) => f.path)
    .filter((p) =>
      /^(package\.json|package-lock\.json|yarn\.lock|pnpm-lock\.yaml|tsconfig\.json|requirements.*\.txt|pyproject\.toml|setup\.py|pipfile)$/i.test(
        p.split("/").pop() || ""
      )
    );

  // Verification capabilities (honest assessment)
  const unsupportedReasons: string[] = [];
  if (primaryLanguage === "unsupported") {
    unsupportedReasons.push("No Python, JavaScript, or TypeScript source files detected.");
  }
  if (testFramework === "vitest" || testFramework === "jest") {
    unsupportedReasons.push(
      `Test framework '${testFramework}' requires third-party packages not available in offline sandbox.`
    );
  }
  const externalNodeDeps = Object.keys(parsedPkg?.dependencies ?? {});
  if (externalNodeDeps.length > 0) {
    unsupportedReasons.push(
      `Runtime npm dependencies (${externalNodeDeps.slice(0, 5).join(", ")}) require offline dependency preparation.`
    );
  }
  if (runtime === "mixed") {
    unsupportedReasons.push(
      "Mixed Python + Node.js repositories require separate per-runtime verification."
    );
  }

  const syntaxCheck = primaryLanguage !== "unsupported";
  const typeCheck = hasTs;
  const testExecution =
    primaryLanguage !== "unsupported" &&
    testFramework !== "jest" &&
    testFramework !== "vitest" &&
    externalNodeDeps.length === 0;

  const detectedFrameworks = Array.from(frameworks);
  const framework =
    detectedFrameworks[0] ??
    (primaryLanguage === "python"
      ? "Python Standard Library"
      : primaryLanguage === "typescript"
      ? "Node.js TypeScript"
      : primaryLanguage === "javascript"
      ? "Node.js JavaScript"
      : primaryLanguage === "mixed"
      ? "Multi-Runtime"
      : "Unsupported");

  return {
    primaryLanguage,
    detectedLanguages,
    runtime,
    framework,
    detectedFrameworks,
    packageManager,
    testFramework,
    entryPoints,
    dependencyFiles,
    supportedVerificationCapabilities: {
      syntaxCheck,
      typeCheck,
      testExecution,
      unsupportedReasons,
    },
  };
}

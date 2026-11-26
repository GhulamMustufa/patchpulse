import { IngestedRepository, RepoFile } from "./schemas";
import { detectProjectLanguageAndFramework } from "./language-detector";

export const INGEST_LIMITS = {
  maxArchiveBytes: 5 * 1024 * 1024, // 5 MB
  maxFiles: 35,
  maxFileBytes: 100 * 1024, // 100 KB per file
  maxTotalExtractedBytes: 1_000_000, // 1 MB extracted text
} as const;

export function isUnsafeArchivePath(rawPath: string): boolean {
  if (!rawPath || rawPath.includes("\0")) return true;
  if (rawPath.startsWith("/") || rawPath.startsWith("\\")) return true;
  if (/^[A-Za-z]:/.test(rawPath)) return true;
  const normalized = rawPath.replace(/\\/g, "/");
  const segments = normalized.split("/");
  return segments.some((seg) => seg === ".." || seg === ".");
}

export function classifyRepoFile(filePath: string): {
  include: boolean;
  language: RepoFile["language"];
  isTestFile: boolean;
  isDependencyManifest: boolean;
} {
  const lower = filePath.toLowerCase();
  const segments = lower.split("/");
  if (
    segments.some(
      (s) =>
        s === ".git" ||
        s === "node_modules" ||
        s === "__pycache__" ||
        s === ".venv" ||
        s === "venv" ||
        s === ".next" ||
        s === "dist" ||
        s === "build" ||
        s === "coverage"
    )
  ) {
    return {
      include: false,
      language: "other",
      isTestFile: false,
      isDependencyManifest: false,
    };
  }

  const base = segments[segments.length - 1] || "";

  const isPyManifest =
    base === "requirements.txt" ||
    /^requirements[-_].*\.txt$/.test(base) ||
    base === "setup.py" ||
    base === "setup.cfg" ||
    base === "pyproject.toml" ||
    base === "pipfile" ||
    base === "runtime.txt";

  const isNodeManifest =
    base === "package.json" ||
    base === "package-lock.json" ||
    base === "yarn.lock" ||
    base === "pnpm-lock.yaml";

  const isDependencyManifest = isPyManifest || isNodeManifest;

  const isPyTest =
    lower.endsWith(".py") &&
    (base.startsWith("test_") ||
      base.endsWith("_test.py") ||
      segments.includes("tests") ||
      segments.includes("test"));

  const isNodeTest =
    /\.(js|mjs|cjs|ts|tsx|mts|cts)$/i.test(base) &&
    (/\.(test|spec)\.(js|mjs|cjs|ts|tsx|mts|cts)$/i.test(base) ||
      segments.includes("tests") ||
      segments.includes("test") ||
      segments.includes("__tests__"));

  if (lower.endsWith(".py")) {
    return {
      include: true,
      language: "python",
      isTestFile: isPyTest,
      isDependencyManifest: base === "setup.py",
    };
  }

  if (/\.(ts|tsx|mts|cts)$/i.test(lower)) {
    return {
      include: true,
      language: "typescript",
      isTestFile: isNodeTest,
      isDependencyManifest: false,
    };
  }

  if (/\.(js|mjs|cjs)$/i.test(lower)) {
    return {
      include: true,
      language: "javascript",
      isTestFile: isNodeTest,
      isDependencyManifest: false,
    };
  }

  if (isDependencyManifest) {
    return {
      include: true,
      language: "manifest",
      isTestFile: false,
      isDependencyManifest: true,
    };
  }

  if (
    base === "tsconfig.json" ||
    /^next\.config\./.test(base) ||
    /^vite\.config\./.test(base) ||
    /^vitest\.config\./.test(base) ||
    /^jest\.config\./.test(base) ||
    base === "nest-cli.json" ||
    base === ".npmrc" ||
    base === "tox.ini" ||
    base === ".python-version" ||
    base === ".flake8"
  ) {
    return {
      include: true,
      language: "config",
      isTestFile: false,
      isDependencyManifest: false,
    };
  }

  if (base === "readme.md" || base === "readme.rst" || base === "readme.txt") {
    return {
      include: true,
      language: "docs",
      isTestFile: false,
      isDependencyManifest: false,
    };
  }

  return {
    include: false,
    language: "other",
    isTestFile: false,
    isDependencyManifest: false,
  };
}

export function buildIngestedRepositoryMetadata(input: {
  id: string;
  source: "github" | "zip" | "custom";
  repoUrl?: string;
  owner?: string;
  name: string;
  defaultBranch?: string;
  description?: string | null;
  stars?: number;
  archived?: boolean;
  lastPushedAt?: string | null;
  files: RepoFile[];
  totalBytes: number;
  truncated: boolean;
  skippedCount: number;
  warnings: string[];
}): IngestedRepository {
  const pythonFiles = input.files.filter((f) => f.language === "python");
  const dependencyManifests = input.files
    .filter((f) => f.isDependencyManifest)
    .map((f) => f.path);
  const testFiles = input.files
    .filter((f) => f.isTestFile)
    .map((f) => f.path);

  const profile = detectProjectLanguageAndFramework(input.files);
  const isPythonProject =
    pythonFiles.length > 0 ||
    dependencyManifests.some((m) =>
      /requirements|setup\.py|pyproject\.toml|pipfile/i.test(m)
    );

  return {
    ...input,
    isPythonProject,
    detectedFrameworks: profile.detectedFrameworks,
    dependencyManifests,
    testFiles,
  };
}

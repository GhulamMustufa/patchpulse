import { spawnSync } from "node:child_process";
import fs from "node:fs";

export interface PythonSyntaxCheckResult {
  valid: boolean;
  engine: string;
  error?: string;
  errorLine?: number;
  discoveredTests: string[];
  astIssues: Array<{
    line: number;
    rule: string;
    severity: "FATAL" | "DEPRECATED" | "WARNING";
    explanation: string;
    recommendedRepair: string;
  }>;
}

const PY_AST_INSPECT_SCRIPT = `
import ast, json, re, sys

source = sys.stdin.read()
result = {
    "valid": False,
    "error": None,
    "errorLine": None,
    "discoveredTests": [],
    "astIssues": []
}

try:
    tree = ast.parse(source)
    result["valid"] = True
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            if node.name.startswith("test_"):
                result["discoveredTests"].append(node.name)
        elif isinstance(node, ast.Import):
            for alias in node.names:
                if alias.name in ("imp", "distutils", "asynchat", "asyncore", "cgi", "cgitb"):
                    result["astIssues"].append({
                        "line": node.lineno,
                        "rule": "REMOVED_STDLIB_" + alias.name.upper(),
                        "severity": "FATAL",
                        "explanation": f"Module '{alias.name}' was removed in Python 3.12.",
                        "recommendedRepair": f"Replace '{alias.name}' with modern stdlib equivalent (e.g. importlib, packaging, email/urllib)."
                    })
        elif isinstance(node, ast.ImportFrom):
            mod = node.module or ""
            root = mod.split(".")[0]
            if root in ("imp", "distutils", "asynchat", "asyncore", "cgi", "cgitb"):
                result["astIssues"].append({
                    "line": node.lineno,
                    "rule": "REMOVED_STDLIB_" + root.upper(),
                    "severity": "FATAL",
                    "explanation": f"Module '{mod}' was removed in Python 3.12.",
                    "recommendedRepair": f"Migrate imports from '{mod}' to supported Python 3.12 modules."
                })
        elif isinstance(node, ast.Attribute):
            if isinstance(node.value, ast.Name) and node.value.id == "collections":
                if node.attr in ("Iterable", "Mapping", "MutableMapping", "Sequence", "Callable", "Set"):
                    result["astIssues"].append({
                        "line": node.lineno,
                        "rule": "COLLECTIONS_ABC_MOVED",
                        "severity": "FATAL",
                        "explanation": f"collections.{node.attr} was removed in Python 3.10+ (moved to collections.abc).",
                        "recommendedRepair": f"Use collections.abc.{node.attr}."
                    })
            if node.attr == "assertEquals":
                result["astIssues"].append({
                    "line": node.lineno,
                    "rule": "REMOVED_ASSERT_EQUALS",
                    "severity": "FATAL",
                    "explanation": "unittest.TestCase.assertEquals was removed in Python 3.12.",
                    "recommendedRepair": "Use assertEqual() instead of assertEquals()."
                })
except SyntaxError as exc:
    result["valid"] = False
    result["error"] = f"{exc.msg} (line {exc.lineno})"
    result["errorLine"] = exc.lineno or 1
    # Fallback regex test discovery when Python 2 syntax prevents AST parse
    for m in re.finditer(r"^\\s*def\\s+(test_[A-Za-z0-9_]+)\\s*\\(", source, re.MULTILINE):
        result["discoveredTests"].append(m.group(1))

print(json.dumps(result))
`;

function resolvePythonBinary(): string | null {
  const candidates = ["/opt/homebrew/bin/python3.12", "python3.12", "python3"];
  for (const bin of candidates) {
    if (bin.startsWith("/") && !fs.existsSync(bin)) continue;
    const probe = spawnSync(bin, ["--version"], {
      encoding: "utf8",
      timeout: 2000,
    });
    if (probe.status === 0) return bin;
  }
  return null;
}

export function inspectPythonAstSafely(source: string): PythonSyntaxCheckResult {
  if (!source.trim()) {
    return {
      valid: false,
      engine: "static_fallback",
      error: "Empty Python source file",
      errorLine: 1,
      discoveredTests: [],
      astIssues: [],
    };
  }

  const pythonBin = resolvePythonBinary();
  if (!pythonBin) {
    // Fallback static test discovery if no python binary is available
    const discoveredTests: string[] = [];
    for (const match of source.matchAll(/^\s*def\s+(test_[A-Za-z0-9_]+)\s*\(/gm)) {
      discoveredTests.push(match[1]);
    }
    return {
      valid: true,
      engine: "js_static_fallback (no python binary)",
      discoveredTests,
      astIssues: [],
    };
  }

  // Safe non-executing AST parse only (shell: false, stdin input)
  const proc = spawnSync(pythonBin, ["-c", PY_AST_INSPECT_SCRIPT], {
    input: source,
    encoding: "utf8",
    timeout: 3000,
    maxBuffer: 1024 * 1024,
  });

  if (proc.status !== 0 || !proc.stdout) {
    return {
      valid: false,
      engine: pythonBin,
      error: proc.stderr?.trim() || "Python AST inspection failed",
      errorLine: 1,
      discoveredTests: [],
      astIssues: [],
    };
  }

  try {
    const parsed = JSON.parse(proc.stdout) as {
      valid: boolean;
      error: string | null;
      errorLine: number | null;
      discoveredTests: string[];
      astIssues: PythonSyntaxCheckResult["astIssues"];
    };
    return {
      valid: parsed.valid,
      engine: `${pythonBin} (ast.parse)`,
      error: parsed.error ?? undefined,
      errorLine: parsed.errorLine ?? undefined,
      discoveredTests: parsed.discoveredTests ?? [],
      astIssues: parsed.astIssues ?? [],
    };
  } catch {
    return {
      valid: false,
      engine: pythonBin,
      error: "Failed to parse AST inspection output",
      errorLine: 1,
      discoveredTests: [],
      astIssues: [],
    };
  }
}

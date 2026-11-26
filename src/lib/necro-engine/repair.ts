import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { generateGeminiRepairProposal } from "@/lib/ai";
import { createUnifiedDiff } from "./diff";
import { applyDeterministicJsTsRepair, validateSingleJsTsFile } from "./node-repair";
import { inspectPythonAstSafely } from "./python-ast";
import { resurrectCode } from "./resurrector";
import {
  DiagnosisFinding,
  FilePatch,
  IngestedRepository,
  RepositoryDiagnosis,
} from "./schemas";

export { createUnifiedDiff };

const PY_AST_TRANSFORM_SCRIPT = `
import ast, json, sys

src = sys.stdin.read()
steps = []
try:
    tree = ast.parse(src)
except SyntaxError:
    print(json.dumps({"changed": False, "code": src, "steps": []}))
    sys.exit(0)

lines = src.splitlines(keepends=True)
edits = []

for node in ast.walk(tree):
    if isinstance(node, ast.Attribute) and isinstance(node.value, ast.Name) and node.value.id == "collections":
        if node.attr in ("Iterable", "Mapping", "MutableMapping", "Sequence", "Callable", "Set"):
            edits.append((node.lineno, "collections." + node.attr, "collections.abc." + node.attr))
            steps.append(f"AST: Upgraded collections.{node.attr} -> collections.abc.{node.attr}")
    elif isinstance(node, ast.Attribute) and node.attr == "assertEquals":
        edits.append((node.lineno, ".assertEquals(", ".assertEqual("))
        steps.append("AST: Replaced deprecated unittest assertEquals() with assertEqual()")

if not edits:
    print(json.dumps({"changed": False, "code": src, "steps": []}))
    sys.exit(0)

for lineno, old, new in edits:
    idx = lineno - 1
    if 0 <= idx < len(lines) and old in lines[idx]:
        lines[idx] = lines[idx].replace(old, new)

print(json.dumps({"changed": True, "code": "".join(lines), "steps": list(dict.fromkeys(steps))}))
`;

function applyPythonAstTransforms(source: string): {
  code: string;
  steps: string[];
} {
  const candidates = ["/opt/homebrew/bin/python3.12", "python3.12", "python3"];
  const pythonBin = candidates.find(
    (b) => !b.startsWith("/") || fs.existsSync(b)
  );
  if (!pythonBin) return { code: source, steps: [] };

  const proc = spawnSync(pythonBin, ["-c", PY_AST_TRANSFORM_SCRIPT], {
    input: source,
    encoding: "utf8",
    timeout: 3000,
    maxBuffer: 1024 * 1024,
  });

  if (proc.status !== 0 || !proc.stdout) {
    return { code: source, steps: [] };
  }
  try {
    const parsed = JSON.parse(proc.stdout) as {
      changed: boolean;
      code: string;
      steps: string[];
    };
    return parsed.changed
      ? { code: parsed.code, steps: parsed.steps }
      : { code: source, steps: [] };
  } catch {
    return { code: source, steps: [] };
  }
}

function applyExtendedPythonDeterministicTransforms(source: string): {
  code: string;
  steps: string[];
  warnings: string[];
} {
  const base = resurrectCode(source, "python");
  let code = base.resurrectedCode;
  const steps = [...base.stepsApplied];
  const warnings = [...base.warnings];

  if (/\bimport\s+ConfigParser\b/.test(code)) {
    code = code.replace(/\bimport\s+ConfigParser\b/g, "import configparser");
    code = code.replace(/\bConfigParser\./g, "configparser.");
    steps.push("Migrated ConfigParser -> configparser");
  }
  if (/\bfrom\s+ConfigParser\s+import\b/.test(code)) {
    code = code.replace(
      /\bfrom\s+ConfigParser\s+import\b/g,
      "from configparser import"
    );
    steps.push("Migrated from ConfigParser import ... -> configparser");
  }
  if (/\bimport\s+Queue\b/.test(code)) {
    code = code.replace(/\bimport\s+Queue\b/g, "import queue");
    code = code.replace(/\bQueue\./g, "queue.");
    steps.push("Migrated Queue -> queue");
  }
  if (/\bfrom\s+(?:c?StringIO)\s+import\s+StringIO\b/.test(code)) {
    code = code.replace(
      /\bfrom\s+(?:c?StringIO)\s+import\s+StringIO\b/g,
      "from io import StringIO"
    );
    steps.push("Migrated StringIO/cStringIO -> io.StringIO");
  }

  const astPass = applyPythonAstTransforms(code);
  code = astPass.code;
  steps.push(...astPass.steps);

  return { code, steps, warnings };
}

export interface RepositoryResurrectionResult {
  repositoryName: string;
  aiStatus: "live_gemini" | "fallback_no_key" | "error_fallback" | "disabled";
  aiModel?: string;
  aiSummary?: string;
  aiError?: string;
  aiFindings: DiagnosisFinding[];
  migrationStrategy: string[];
  patches: FilePatch[];
  validPatchCount: number;
  invalidPatchCount: number;
  unchangedCount: number;
}

export async function resurrectRepository(input: {
  repository: IngestedRepository;
  diagnosis: RepositoryDiagnosis;
  useAi?: boolean;
  targetFiles?: string[];
}): Promise<RepositoryResurrectionResult> {
  const sourceFiles = input.repository.files.filter(
    (f) =>
      (f.language === "python" ||
        f.language === "javascript" ||
        f.language === "typescript") &&
      (!input.targetFiles || input.targetFiles.includes(f.path))
  );

  const filesToInspect = sourceFiles.slice(0, 12);
  const targetPaths = filesToInspect.map((f) => f.path);

  let aiStatus: RepositoryResurrectionResult["aiStatus"] = "disabled";
  let aiModel: string | undefined;
  let aiSummary: string | undefined;
  let aiError: string | undefined;
  let migrationStrategy: string[] = [];
  const aiFindings: DiagnosisFinding[] = [];
  const aiPatchMap = new Map<string, { content: string; explanation: string }>();

  if (input.useAi !== false && targetPaths.length > 0) {
    const aiRes = await generateGeminiRepairProposal({
      repository: input.repository,
      diagnosis: input.diagnosis,
      targetFiles: targetPaths,
    });
    aiStatus = aiRes.status;
    aiModel = aiRes.model;
    aiError = aiRes.error;

    if (aiRes.data) {
      aiSummary = aiRes.data.summary;
      migrationStrategy = aiRes.data.migrationStrategy;
      (aiRes.data.aiFindings ?? []).forEach((f, idx) => {
        aiFindings.push({
          id: `ai_finding_${idx + 1}`,
          finding: f.finding,
          category: "compatibility",
          severity: f.severity ?? "WARNING",
          origin: "ai_suggestion",
          file: f.file,
          line: f.line,
          explanation: f.explanation,
          recommendedRepair: f.recommendedRepair,
        });
      });
      for (const p of aiRes.data.patches) {
        aiPatchMap.set(p.filePath, {
          content: p.proposedContent,
          explanation: p.explanation,
        });
      }
    }
  }

  const patches: FilePatch[] = [];

  for (const file of filesToInspect) {
    const isPython = file.language === "python";
    const det = isPython
      ? applyExtendedPythonDeterministicTransforms(file.content)
      : applyDeterministicJsTsRepair(file.content, file.path);

    const aiPatch = aiPatchMap.get(file.path);

    let proposedContent = det.code;
    const stepsApplied = [...det.steps];
    const warnings = [...det.warnings];
    let strategy: FilePatch["strategy"] =
      det.code !== file.content ? "deterministic_ast" : "unchanged";

    if (aiPatch) {
      if (isPython) {
        const aiSyntax = inspectPythonAstSafely(aiPatch.content);
        if (aiSyntax.valid) {
          proposedContent = aiPatch.content;
          stepsApplied.push(`Gemini AI: ${aiPatch.explanation}`);
          strategy = det.steps.length > 0 ? "hybrid" : "gemini_ai";
        } else {
          warnings.push(
            `Rejected Gemini AI patch for ${file.path} because it failed Python 3.12 ast.parse (${aiSyntax.error || "SyntaxError"}). Kept deterministic output instead.`
          );
        }
      } else {
        const jsTsCheck = validateSingleJsTsFile(
          file.path,
          aiPatch.content,
          input.repository.files
        );
        if (jsTsCheck.valid) {
          proposedContent = aiPatch.content;
          stepsApplied.push(`Gemini AI: ${aiPatch.explanation}`);
          strategy = det.steps.length > 0 ? "hybrid" : "gemini_ai";
        } else {
          warnings.push(
            `Rejected Gemini AI patch for ${file.path} because it failed JS/TS validation (${jsTsCheck.error || "Compiler error"}). Kept deterministic output instead.`
          );
        }
      }
    }

    const postCheck = isPython
      ? inspectPythonAstSafely(proposedContent)
      : validateSingleJsTsFile(file.path, proposedContent, input.repository.files);

    const changed = proposedContent !== file.content;
    const status: FilePatch["status"] = !postCheck.valid
      ? "invalid_syntax"
      : changed
      ? "valid"
      : "unchanged";

    if (!postCheck.valid) {
      warnings.push(
        `Repaired output for ${file.path} still fails syntax/type validation: ${postCheck.error}`
      );
      if (strategy === "unchanged") strategy = "failed";
    }

    patches.push({
      filePath: file.path,
      originalContent: file.content,
      proposedContent,
      unifiedDiff: createUnifiedDiff(file.path, file.content, proposedContent),
      changed,
      strategy,
      stepsApplied,
      warnings,
      syntaxValid: postCheck.valid,
      syntaxError: postCheck.error,
      status,
    });
  }

  return {
    repositoryName: input.repository.name,
    aiStatus,
    aiModel,
    aiSummary,
    aiError,
    aiFindings,
    migrationStrategy,
    patches,
    validPatchCount: patches.filter((p) => p.status === "valid").length,
    invalidPatchCount: patches.filter(
      (p) => p.status === "invalid_syntax" || p.status === "failed"
    ).length,
    unchangedCount: patches.filter((p) => p.status === "unchanged").length,
  };
}

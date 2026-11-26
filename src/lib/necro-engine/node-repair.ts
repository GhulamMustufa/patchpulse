import ts from "typescript";
import { resurrectCode } from "./resurrector";
import { validateJsTsSyntaxAndTypes } from "./node-diagnoser";

export interface NodeDeterministicRepairResult {
  code: string;
  steps: string[];
  warnings: string[];
}

export function applyDeterministicJsTsRepair(
  source: string,
  filePath: string
): NodeDeterministicRepairResult {
  const isTs = /\.(ts|tsx|mts|cts)$/i.test(filePath);
  const base = resurrectCode(source, isTs ? "typescript" : "javascript");
  let code = base.resurrectedCode;
  const steps = [...base.stepsApplied];
  const warnings = [...base.warnings];

  // Safely convert simple `module.exports = foo;` -> `export default foo;`
  if (/module\.exports\s*=\s*([A-Za-z_$][A-Za-z0-9_$]*)\s*;?/.test(code)) {
    code = code.replace(
      /module\.exports\s*=\s*([A-Za-z_$][A-Za-z0-9_$]*)\s*;?/g,
      "export default $1;"
    );
    steps.push("Converted CommonJS default module.exports to ESM export default");
  }

  // Safely replace deprecated `require('crypto')` -> `import crypto from 'node:crypto';` when ESM export present
  if (
    /\bexport\s+/.test(code) &&
    /(?:var|const|let)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*require\s*\(\s*['"]([a-z0-9_-]+)['"]\s*\)\s*;?/i.test(
      code
    )
  ) {
    const builtins = new Set(["fs", "path", "crypto", "http", "https", "url", "os", "util", "events"]);
    code = code.replace(
      /(?:var|const|let)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*require\s*\(\s*['"]([a-z0-9_-]+)['"]\s*\)\s*;?/gi,
      (full, ident: string, mod: string) => {
        if (mod === "request") return full; // handled separately
        const spec = builtins.has(mod) ? `node:${mod}` : mod;
        steps.push(`Converted CommonJS require('${mod}') to ESM import`);
        return `import ${ident} from '${spec}';`;
      }
    );
  }

  return {
    code,
    steps,
    warnings,
  };
}

export function validateSingleJsTsFile(
  filePath: string,
  content: string,
  allFiles: Array<{ path: string; content: string }>
): { valid: boolean; error?: string } {
  const updatedFiles = allFiles.map((f) =>
    f.path === filePath ? { path: f.path, content } : f
  );
  if (!updatedFiles.some((f) => f.path === filePath)) {
    updatedFiles.push({ path: filePath, content });
  }

  const check = validateJsTsSyntaxAndTypes(updatedFiles);
  const fileErrors = check.tsDiagnostics.filter(
    (d) => d.file === filePath && d.severity === "ERROR"
  );

  // Also run strict parser check directly for single-file syntax errors
  const sf = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.ES2022,
    true,
    filePath.endsWith(".tsx")
      ? ts.ScriptKind.TSX
      : /\.(ts|mts|cts)$/i.test(filePath)
      ? ts.ScriptKind.TS
      : ts.ScriptKind.JS
  );
  const parseDiags =
    (sf as unknown as { parseDiagnostics?: ts.DiagnosticWithLocation[] })
      .parseDiagnostics ?? [];

  if (parseDiags.length > 0) {
    const first = parseDiags[0];
    const pos = sf.getLineAndCharacterOfPosition(first.start ?? 0);
    return {
      valid: false,
      error: `Line ${pos.line + 1}: ${ts.flattenDiagnosticMessageText(first.messageText, " ")}`,
    };
  }

  if (fileErrors.length > 0) {
    const first = fileErrors[0];
    return {
      valid: false,
      error: `${first.code} (L${first.line}:${first.column}): ${first.message}`,
    };
  }

  return { valid: true };
}

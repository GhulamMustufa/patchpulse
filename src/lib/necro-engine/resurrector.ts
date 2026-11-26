import { LanguageType } from "./types";
import { PRESET_PATIENTS } from "./patients";

export interface ResurrectionResult {
  resurrectedCode: string;
  stepsApplied: string[];
  warnings: string[];
  diffCount: number;
  usedPresetGolden: boolean;
}

function splitCodeAndTrailingComment(line: string): {
  codePart: string;
  commentPart: string;
} {
  let quote: string | null = null;
  let escaped = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\" && quote) {
      escaped = true;
      continue;
    }
    if (quote) {
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === "#") {
      return {
        codePart: line.slice(0, i).trimEnd(),
        commentPart: line.slice(i),
      };
    }
  }

  return { codePart: line, commentPart: "" };
}

function convertPythonPrintLine(line: string): {
  converted: string;
  changed: boolean;
} {
  const leadingWhitespace = line.match(/^\s*/)?.[0] || "";
  const { codePart, commentPart } = splitCodeAndTrailingComment(line);
  const trimmedCode = codePart.trim();

  if (!trimmedCode || trimmedCode.startsWith("print(")) {
    return { converted: line, changed: false };
  }

  const suffix = commentPart ? `  ${commentPart}` : "";

  if (trimmedCode === "print") {
    return { converted: `${leadingWhitespace}print()${suffix}`, changed: true };
  }

  if (!/^print\s+/.test(trimmedCode)) {
    return { converted: line, changed: false };
  }

  let payload = trimmedCode.replace(/^print\s+/, "").trim();

  // Handle Python 2 chevron print: print >> sys.stderr, "msg"
  const chevronMatch = payload.match(/^>>\s*([^,]+),\s*(.+)$/);
  if (chevronMatch) {
    const stream = chevronMatch[1].trim();
    const expr = chevronMatch[2].trim();
    return {
      converted: `${leadingWhitespace}print(${expr}, file=${stream})${suffix}`,
      changed: true,
    };
  }

  // Handle trailing comma suppressing newline: print "hi",
  if (payload.endsWith(",")) {
    payload = `${payload.slice(0, -1).trim()}, end=" "`;
  }

  return {
    converted: `${leadingWhitespace}print(${payload})${suffix}`,
    changed: true,
  };
}

function convertCommonJsExports(code: string): {
  code: string;
  changed: boolean;
} {
  let changed = false;
  const updated = code.replace(
    /module\.exports\s*=\s*\{([\s\S]*?)\}\s*;?/g,
    (_full, inner: string) => {
      changed = true;
      const entries = inner
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);

      const allShorthandOrPair = entries.every((entry) => {
        if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(entry)) return true;
        const pair = entry.match(
          /^([A-Za-z_$][A-Za-z0-9_$]*)\s*:\s*([A-Za-z_$][A-Za-z0-9_$]*)$/
        );
        return Boolean(pair && pair[1] === pair[2]);
      });

      if (allShorthandOrPair && entries.length > 0) {
        const names = entries.map((e) => e.split(":")[0].trim());
        return `export { ${names.join(", ")} };`;
      }

      return `export default {\n  ${entries.join(",\n  ")}\n};`;
    }
  );

  return { code: updated, changed };
}

export function resurrectCode(
  code: string,
  language: LanguageType,
  patientId?: string
): ResurrectionResult {
  const matchingPatient = PRESET_PATIENTS.find((p) => p.id === patientId);
  const stepsApplied: string[] = [];
  const warnings: string[] = [];

  if (!code.trim()) {
    return {
      resurrectedCode: "",
      stepsApplied: [],
      warnings: ["No source code provided."],
      diffCount: 0,
      usedPresetGolden: false,
    };
  }

  if (matchingPatient && code.trim() === matchingPatient.deadCode.trim()) {
    if (matchingPatient.language === "python") {
      stepsApplied.push(
        "Migrated shebang: #!/usr/bin/env python2 -> #!/usr/bin/env python3"
      );
      stepsApplied.push(
        "Replaced obsolete urllib2 with urllib.request and urllib.error"
      );
      stepsApplied.push(
        "Converted Python 2 print statements into print(...) calls"
      );
      stepsApplied.push(
        "Modernized exception syntax: 'except urllib2.HTTPError, e' -> 'except urllib.error.HTTPError as e'"
      );
      stepsApplied.push("Replaced xrange() with range() and .iteritems() with .items()");
      stepsApplied.push(
        "Added Python 3 type annotations (Optional[bytes], Dict[str, str])"
      );
    } else {
      stepsApplied.push(
        "Converted CommonJS module structure to ECMAScript standard ESM imports/exports"
      );
      stepsApplied.push(
        "Replaced deprecated 'request' package with native Node 20+ fetch()"
      );
      stepsApplied.push(
        "Patched CVE-2018-7166: new Buffer() -> Buffer.from(..., 'utf-8')"
      );
      stepsApplied.push(
        "Refactored callback handler to async/await Promise flow"
      );
    }

    return {
      resurrectedCode: matchingPatient.expectedModernCode,
      stepsApplied,
      warnings: [],
      diffCount: stepsApplied.length,
      usedPresetGolden: true,
    };
  }

  let modernized = code;

  if (language === "python") {
    if (modernized.includes("#!/usr/bin/env python2")) {
      modernized = modernized.replace(
        "#!/usr/bin/env python2",
        "#!/usr/bin/env python3"
      );
      stepsApplied.push("Upgraded shebang to python3");
    }

    if (
      /\bimport\s+urllib2\b/.test(modernized) ||
      /\bfrom\s+urllib2\s+import\b/.test(modernized)
    ) {
      modernized = modernized.replace(
        /\bimport\s+urllib2\b/g,
        "import urllib.request\nimport urllib.error"
      );
      modernized = modernized.replace(
        /\bfrom\s+urllib2\s+import\s+([^\n]+)/g,
        (_m, imported: string) => {
          const items = imported.split(",").map((s) => s.trim());
          const errorItems = items.filter((i) => /Error\b/.test(i));
          const reqItems = items.filter((i) => !/Error\b/.test(i));
          const out: string[] = [];
          if (reqItems.length > 0) {
            out.push(`from urllib.request import ${reqItems.join(", ")}`);
          }
          if (errorItems.length > 0) {
            out.push(`from urllib.error import ${errorItems.join(", ")}`);
          }
          return out.join("\n");
        }
      );
      modernized = modernized.replace(
        /\burllib2\.Request\b/g,
        "urllib.request.Request"
      );
      modernized = modernized.replace(
        /\burllib2\.urlopen\b/g,
        "urllib.request.urlopen"
      );
      modernized = modernized.replace(
        /\burllib2\.HTTPError\b/g,
        "urllib.error.HTTPError"
      );
      modernized = modernized.replace(
        /\burllib2\.URLError\b/g,
        "urllib.error.URLError"
      );
      if (/\burllib2\./.test(modernized)) {
        warnings.push(
          "Remaining urllib2.* attribute references require manual or AI migration."
        );
      }
      stepsApplied.push(
        "Replaced deprecated urllib2 imports with urllib.request / urllib.error"
      );
    }

    if (/except\s+([A-Za-z0-9_.]+)\s*,\s*([a-zA-Z0-9_]+)\s*:/.test(modernized)) {
      modernized = modernized.replace(
        /except\s+([A-Za-z0-9_.]+)\s*,\s*([a-zA-Z0-9_]+)\s*:/g,
        "except $1 as $2:"
      );
      stepsApplied.push(
        "Modernized exception syntax: 'except Ex, e:' -> 'except Ex as e:'"
      );
    }

    if (/\bxrange\s*\(/.test(modernized)) {
      modernized = modernized.replace(/\bxrange\s*\(/g, "range(");
      stepsApplied.push("Converted legacy xrange() to range()");
    }

    if (/\.(iteritems|itervalues|iterkeys)\s*\(\)/.test(modernized)) {
      modernized = modernized
        .replace(/\.iteritems\s*\(\)/g, ".items()")
        .replace(/\.itervalues\s*\(\)/g, ".values()")
        .replace(/\.iterkeys\s*\(\)/g, ".keys()");
      stepsApplied.push("Updated dict.iter*() methods to Python 3 views");
    }

    if (/\braw_input\s*\(/.test(modernized)) {
      modernized = modernized.replace(/\braw_input\s*\(/g, "input(");
      stepsApplied.push("Replaced raw_input() with input()");
    }

    let printConverted = false;
    const transformedLines = modernized.split("\n").map((line) => {
      const res = convertPythonPrintLine(line);
      if (res.changed) printConverted = true;
      return res.converted;
    });

    if (printConverted) {
      modernized = transformedLines.join("\n");
      stepsApplied.push("Converted Python 2 print statements into print(...) calls");
    }
  } else {
    // JavaScript / TypeScript
    if (/new\s+Buffer\s*\(/.test(modernized)) {
      modernized = modernized.replace(
        /new\s+Buffer\s*\(\s*(\d+)\s*\)/g,
        "Buffer.alloc($1)"
      );
      modernized = modernized.replace(
        /new\s+Buffer\s*\(([^,)]+)\)/g,
        "Buffer.from($1, 'utf-8')"
      );
      modernized = modernized.replace(
        /new\s+Buffer\s*\(([^,)]+),\s*([^)]+)\)/g,
        "Buffer.from($1, $2)"
      );
      stepsApplied.push(
        "Patched unsafe Buffer constructor with Buffer.from() / Buffer.alloc()"
      );
    }

    const exportsRes = convertCommonJsExports(modernized);
    if (exportsRes.changed) {
      modernized = exportsRes.code;
      stepsApplied.push("Converted CommonJS module.exports to valid ESM export syntax");
    }

    if (/\brequire\s*\(\s*['"]request['"]\s*\)/.test(modernized)) {
      warnings.push(
        "Detected deprecated 'request' package usage. Deterministic regexes cannot safely rewrite callback HTTP flows into async/await fetch(); use AI repair or manual refactoring."
      );
    }
  }

  return {
    resurrectedCode: modernized,
    stepsApplied,
    warnings,
    diffCount: stepsApplied.length,
    usedPresetGolden: false,
  };
}

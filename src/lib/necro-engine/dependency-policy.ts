export interface DependencyPolicyResult {
  status: "STDLIB_ONLY_READY" | "DEPENDENCY_PREPARATION_FAILED" | "UNVERIFIED_EXTERNAL_DEPS";
  safeToExecute: boolean;
  requiresThirdPartyPackages: boolean;
  declaredPackages: Array<{
    name: string;
    specifier: string;
    sourceFile: string;
    pinned: boolean;
  }>;
  blockedDirectives: string[];
  reason: string;
}

const UNSAFE_PIP_FLAGS = [
  /^\s*-e\b/i,
  /^\s*--editable\b/i,
  /--index-url\b/i,
  /--extra-index-url\b/i,
  /--find-links\b/i,
  /^\s*-f\s+/i,
  /--trusted-host\b/i,
  /--install-option\b/i,
  /--config-settings\b/i,
  /--global-option\b/i,
];

const UNSAFE_SOURCE_SCHEMES = [
  /\bgit\+/i,
  /\bhg\+/i,
  /\bsvn\+/i,
  /\bbzr\+/i,
  /\bhttps?:\/\//i,
  /\bssh:\/\//i,
  /\bfile:\/\//i,
  /(?:^|\s)\.\.[/\\]/,
];

export function evaluateDependencyPolicy(
  files: Array<{ path: string; content: string }>
): DependencyPolicyResult {
  const blockedDirectives: string[] = [];
  const declaredPackages: DependencyPolicyResult["declaredPackages"] = [];

  for (const file of files) {
    const base = file.path.split("/").pop()?.toLowerCase() || "";
    const isReqTxt = base === "requirements.txt" || /^requirements[-_].*\.txt$/.test(base);

    if (isReqTxt) {
      const lines = file.content.split("\n");
      for (const rawLine of lines) {
        const line = rawLine.split("#")[0].trim();
        if (!line) continue;

        if (UNSAFE_PIP_FLAGS.some((rx) => rx.test(line))) {
          blockedDirectives.push(`${file.path}: unsafe pip directive '${line}'`);
          continue;
        }
        if (UNSAFE_SOURCE_SCHEMES.some((rx) => rx.test(line))) {
          blockedDirectives.push(`${file.path}: unsupported VCS/URL/local source '${line}'`);
          continue;
        }

        const match = line.match(/^([A-Za-z0-9_.-]+)\s*(.*)$/);
        if (!match) {
          blockedDirectives.push(`${file.path}: unrecognized requirement '${line}'`);
          continue;
        }
        const name = match[1].toLowerCase();
        const specifier = match[2].trim() || "unpinned";
        declaredPackages.push({
          name,
          specifier,
          sourceFile: file.path,
          pinned: specifier.startsWith("=="),
        });
      }
    } else if (base === "setup.py" || base === "pyproject.toml") {
      if (UNSAFE_SOURCE_SCHEMES.some((rx) => rx.test(file.content))) {
        // Only flag inside dependency blocks, not homepage URLs
        const depLines = file.content
          .split("\n")
          .filter((l) => /install_requires|dependencies|dependency_links/i.test(l) || /\bgit\+/i.test(l));
        for (const dl of depLines) {
          if (UNSAFE_SOURCE_SCHEMES.some((rx) => rx.test(dl))) {
            blockedDirectives.push(`${file.path}: unsafe dependency source '${dl.trim()}'`);
          }
        }
      }
    }
  }

  if (blockedDirectives.length > 0) {
    return {
      status: "DEPENDENCY_PREPARATION_FAILED",
      safeToExecute: false,
      requiresThirdPartyPackages: true,
      declaredPackages,
      blockedDirectives,
      reason: `Rejected ${blockedDirectives.length} unsafe dependency directive(s): ${blockedDirectives[0]}`,
    };
  }

  // Filter out pure test-runner declarations if stdlib runner handles them
  const runtimePackages = declaredPackages.filter(
    (p) => p.name !== "pytest" && p.name !== "unittest2"
  );

  if (runtimePackages.length === 0) {
    return {
      status: "STDLIB_ONLY_READY",
      safeToExecute: true,
      requiresThirdPartyPackages: false,
      declaredPackages,
      blockedDirectives: [],
      reason: "Project relies only on Python 3.12 standard library (no external installs required).",
    };
  }

  // Network-disabled sandbox cannot install arbitrary external PyPI packages unless pre-cached offline
  return {
    status: "DEPENDENCY_PREPARATION_FAILED",
    safeToExecute: false,
    requiresThirdPartyPackages: true,
    declaredPackages,
    blockedDirectives: [],
    reason: `External packages required (${runtimePackages
      .map((p) => `${p.name}${p.specifier === "unpinned" ? "" : p.specifier}`)
      .join(", ")}), and offline wheelhouse installation is disabled in network-isolated sandbox.`,
  };
}

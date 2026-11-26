export interface NodeDependencyPolicyResult {
  status:
    | "BUILTIN_ONLY_READY"
    | "TYPESCRIPT_BUILTIN_READY"
    | "DEPENDENCY_PREPARATION_FAILED";
  safeToExecute: boolean;
  requiresThirdPartyPackages: boolean;
  packageManager: "npm" | "yarn" | "pnpm" | "unknown";
  declaredPackages: Array<{
    name: string;
    specifier: string;
    section: "dependencies" | "devDependencies";
  }>;
  blockedDirectives: string[];
  reason: string;
}

const UNSAFE_SPEC_PATTERNS = [
  /^git\+/i,
  /^github:/i,
  /^bitbucket:/i,
  /^gitlab:/i,
  /^https?:\/\//i,
  /^ssh:\/\//i,
  /^file:/i,
  /^link:/i,
  /^workspace:/i,
  /^\.\.[/\\]/,
  /^\//,
];

const DANGEROUS_LIFECYCLE_SCRIPTS = [
  "preinstall",
  "install",
  "postinstall",
  "prepare",
  "preprepare",
  "postprepare",
  "prepublish",
  "prepublishonly",
];

export function evaluateNodeDependencyPolicy(
  files: Array<{ path: string; content: string }>
): NodeDependencyPolicyResult {
  const blockedDirectives: string[] = [];
  const declaredPackages: NodeDependencyPolicyResult["declaredPackages"] = [];

  const lowerNames = files.map((f) => f.path.toLowerCase());
  const hasNpmLock = lowerNames.includes("package-lock.json");
  const hasYarnLock = lowerNames.includes("yarn.lock");
  const hasPnpmLock = lowerNames.includes("pnpm-lock.yaml");

  const lockCount = [hasNpmLock, hasYarnLock, hasPnpmLock].filter(Boolean).length;
  if (lockCount > 1) {
    blockedDirectives.push(
      "Conflicting package manager lockfiles detected (multiple of package-lock.json, yarn.lock, pnpm-lock.yaml)."
    );
  }

  const packageManager: NodeDependencyPolicyResult["packageManager"] = hasPnpmLock
    ? "pnpm"
    : hasYarnLock
    ? "yarn"
    : hasNpmLock
    ? "npm"
    : "unknown";

  // Check .npmrc for custom registries or auth overrides
  const npmrc = files.find((f) => f.path.toLowerCase().endsWith(".npmrc"));
  if (npmrc) {
    if (/registry\s*=|_authToken|always-auth/i.test(npmrc.content)) {
      blockedDirectives.push(
        ".npmrc overrides registry or auth tokens, which is blocked by security policy."
      );
    }
  }

  const pkgFile = files.find((f) => f.path.toLowerCase() === "package.json");
  if (!pkgFile) {
    const hasTs = files.some((f) => /\.(ts|tsx|mts|cts)$/i.test(f.path));
    return {
      status: hasTs ? "TYPESCRIPT_BUILTIN_READY" : "BUILTIN_ONLY_READY",
      safeToExecute: true,
      requiresThirdPartyPackages: false,
      packageManager,
      declaredPackages: [],
      blockedDirectives: [],
      reason: hasTs
        ? "No external npm dependencies; pinned TypeScript 5.9.3 and Node.js 20 built-ins ready."
        : "No package.json dependencies required; Node.js 20 built-ins ready.",
    };
  }

  let pkg: Record<string, unknown>;
  try {
    pkg = JSON.parse(pkgFile.content) as Record<string, unknown>;
  } catch {
    return {
      status: "DEPENDENCY_PREPARATION_FAILED",
      safeToExecute: false,
      requiresThirdPartyPackages: false,
      packageManager,
      declaredPackages: [],
      blockedDirectives: ["package.json contains invalid JSON."],
      reason: "package.json contains invalid JSON.",
    };
  }

  // Check dangerous lifecycle scripts
  const scripts = (pkg.scripts as Record<string, unknown> | undefined) ?? {};
  for (const scriptName of Object.keys(scripts)) {
    if (DANGEROUS_LIFECYCLE_SCRIPTS.includes(scriptName.toLowerCase())) {
      blockedDirectives.push(
        `package.json defines lifecycle script '${scriptName}', which is blocked to prevent install-time code execution.`
      );
    }
  }

  // Check publishConfig registry overrides
  const pubCfg = pkg.publishConfig as Record<string, unknown> | undefined;
  if (pubCfg?.registry) {
    blockedDirectives.push(
      `package.json publishConfig.registry override ('${String(pubCfg.registry)}') rejected.`
    );
  }

  const checkDeps = (
    section: "dependencies" | "devDependencies",
    map?: Record<string, unknown>
  ) => {
    if (!map || typeof map !== "object") return;
    for (const [name, rawSpec] of Object.entries(map)) {
      const spec = String(rawSpec ?? "").trim();
      declaredPackages.push({ name, specifier: spec || "*", section });
      if (UNSAFE_SPEC_PATTERNS.some((rx) => rx.test(spec))) {
        blockedDirectives.push(
          `Unsafe ${section} specifier for '${name}': '${spec}' (git/URL/file/path dependencies are blocked).`
        );
      }
      if (spec === "*" || spec === "latest") {
        blockedDirectives.push(
          `Unpinned wildcard dependency '${name}: ${spec}' rejected.`
        );
      }
    }
  };

  checkDeps("dependencies", pkg.dependencies as Record<string, unknown> | undefined);
  checkDeps("devDependencies", pkg.devDependencies as Record<string, unknown> | undefined);

  if (blockedDirectives.length > 0) {
    return {
      status: "DEPENDENCY_PREPARATION_FAILED",
      safeToExecute: false,
      requiresThirdPartyPackages: declaredPackages.length > 0,
      packageManager,
      declaredPackages,
      blockedDirectives,
      reason: `Rejected ${blockedDirectives.length} unsafe Node.js dependency/config policy rule(s): ${blockedDirectives[0]}`,
    };
  }

  // Allow pure built-in Node projects or projects whose only devDependency is typescript/@types/node
  const externalPackages = declaredPackages.filter(
    (d) =>
      !(
        d.section === "devDependencies" &&
        (d.name === "typescript" || d.name === "@types/node")
      )
  );

  if (externalPackages.length === 0) {
    const usesTs = declaredPackages.some((d) => d.name === "typescript");
    return {
      status: usesTs ? "TYPESCRIPT_BUILTIN_READY" : "BUILTIN_ONLY_READY",
      safeToExecute: true,
      requiresThirdPartyPackages: false,
      packageManager,
      declaredPackages,
      blockedDirectives: [],
      reason: usesTs
        ? "Uses only pinned TypeScript compiler and Node.js 20 built-ins (zero external installs required)."
        : "Project uses only Node.js 20 built-in modules (no third-party installs required).",
    };
  }

  return {
    status: "DEPENDENCY_PREPARATION_FAILED",
    safeToExecute: false,
    requiresThirdPartyPackages: true,
    packageManager,
    declaredPackages,
    blockedDirectives: [],
    reason: `External npm packages required (${externalPackages
      .map((p) => `${p.name}@${p.specifier}`)
      .join(", ")}), and arbitrary npm install is blocked in the network-isolated sandbox.`,
  };
}

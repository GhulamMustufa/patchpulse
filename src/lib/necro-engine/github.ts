import { IngestedRepository, RepoFile } from "./schemas";
import {
  buildIngestedRepositoryMetadata,
  classifyRepoFile,
  INGEST_LIMITS,
  isUnsafeArchivePath,
} from "./repo-metadata";

export { buildIngestedRepositoryMetadata };

export interface ParsedGitHubRepoRef {
  owner: string;
  repo: string;
  canonicalUrl: string;
}

const VALID_SEGMENT = /^[A-Za-z0-9_.-]{1,100}$/;

export function parsePublicGitHubUrl(rawUrl: string): ParsedGitHubRepoRef {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new Error("Invalid URL format. Expected https://github.com/<owner>/<repo>.");
  }

  if (parsed.protocol !== "https:") {
    throw new Error("Only HTTPS GitHub URLs are supported.");
  }

  if (parsed.hostname.toLowerCase() !== "github.com") {
    throw new Error("Hostname must be github.com.");
  }

  if (parsed.username || parsed.password || parsed.port) {
    throw new Error("URL must not contain credentials or custom ports.");
  }

  const segments = parsed.pathname
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean);

  if (segments.length < 2) {
    throw new Error("GitHub URL must include both owner and repository name.");
  }

  const owner = segments[0];
  const repo = segments[1].replace(/\.git$/i, "");

  if (
    !VALID_SEGMENT.test(owner) ||
    !VALID_SEGMENT.test(repo) ||
    owner === "." ||
    owner === ".." ||
    repo === "." ||
    repo === ".."
  ) {
    throw new Error("Invalid GitHub owner or repository name.");
  }

  // Only allow bare repo URLs or /tree/... /blob/... cleanly without arbitrary endpoints
  if (segments.length > 2 && segments[2] !== "tree") {
    throw new Error("Please provide the root GitHub repository URL (https://github.com/owner/repo).");
  }

  return {
    owner,
    repo,
    canonicalUrl: `https://github.com/${owner}/${repo}`,
  };
}

function githubHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "PatchPulse-Lab/1.0",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return headers;
}

interface GitHubRepoMetadata {
  name: string;
  full_name: string;
  private: boolean;
  description: string | null;
  stargazers_count: number;
  archived: boolean;
  default_branch: string;
  pushed_at: string | null;
  size: number;
}

interface GitHubTreeResponse {
  truncated?: boolean;
  tree?: Array<{
    path: string;
    mode: string;
    type: string;
    sha: string;
    size?: number;
  }>;
}

export async function ingestPublicGitHubRepository(
  rawUrl: string
): Promise<IngestedRepository> {
  const ref = parsePublicGitHubUrl(rawUrl);
  const headers = githubHeaders();

  const metaRes = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(ref.owner)}/${encodeURIComponent(ref.repo)}`,
    {
      headers,
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    }
  );

  if (metaRes.status === 404) {
    throw new Error(
      `Repository ${ref.owner}/${ref.repo} was not found or is private.`
    );
  }
  if (metaRes.status === 403 || metaRes.status === 429) {
    throw new Error(
      "GitHub API rate limit reached. Try again later or upload a ZIP archive."
    );
  }
  if (!metaRes.ok) {
    throw new Error(`GitHub API error (${metaRes.status}) while loading repository metadata.`);
  }

  const meta = (await metaRes.json()) as GitHubRepoMetadata;
  if (meta.private) {
    throw new Error("Private repositories are not supported.");
  }
  if (meta.size === 0 || !meta.default_branch) {
    throw new Error("Repository appears to be empty.");
  }

  const treeRes = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(ref.owner)}/${encodeURIComponent(
      ref.repo
    )}/git/trees/${encodeURIComponent(meta.default_branch)}?recursive=1`,
    {
      headers,
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    }
  );

  if (!treeRes.ok) {
    throw new Error(`Unable to inspect repository file tree (HTTP ${treeRes.status}).`);
  }

  const treeData = (await treeRes.json()) as GitHubTreeResponse;
  const entries = treeData.tree ?? [];

  if (entries.length === 0) {
    throw new Error("Repository tree is empty.");
  }

  const warnings: string[] = [];
  if (treeData.truncated) {
    warnings.push("GitHub truncated the full repository tree due to repository size.");
  }

  let skippedCount = 0;
  const candidateBlobs: Array<{
    path: string;
    sha: string;
    size: number;
    language: RepoFile["language"];
    isTestFile: boolean;
    isDependencyManifest: boolean;
  }> = [];

  for (const item of entries) {
    if (item.type !== "blob") continue;
    // Reject git symlinks (mode 120000) and unsafe paths
    if (item.mode === "120000" || isUnsafeArchivePath(item.path)) {
      skippedCount++;
      warnings.push(`Skipped unsafe or symlink entry: ${item.path}`);
      continue;
    }

    const classification = classifyRepoFile(item.path);
    if (!classification.include) {
      skippedCount++;
      continue;
    }

    const size = item.size ?? 0;
    if (size > INGEST_LIMITS.maxFileBytes) {
      skippedCount++;
      warnings.push(`Skipped ${item.path}: file exceeds 100 KB limit.`);
      continue;
    }

    candidateBlobs.push({
      path: item.path,
      sha: item.sha,
      size,
      language: classification.language,
      isTestFile: classification.isTestFile,
      isDependencyManifest: classification.isDependencyManifest,
    });
  }

  // Prioritize manifests -> configs -> source files -> test files -> docs
  candidateBlobs.sort((a, b) => {
    const score = (x: typeof a) =>
      x.isDependencyManifest
        ? 0
        : x.language === "config"
        ? 1
        : (x.language === "python" ||
            x.language === "typescript" ||
            x.language === "javascript") &&
          !x.isTestFile
        ? 2
        : x.isTestFile
        ? 3
        : 4;
    return score(a) - score(b);
  });

  const selected = candidateBlobs.slice(0, INGEST_LIMITS.maxFiles);
  const truncated = Boolean(treeData.truncated) || candidateBlobs.length > selected.length;
  if (candidateBlobs.length > selected.length) {
    skippedCount += candidateBlobs.length - selected.length;
    warnings.push(`Capped ingestion at ${INGEST_LIMITS.maxFiles} relevant files.`);
  }

  const files: RepoFile[] = [];
  let totalBytes = 0;

  for (const blob of selected) {
    if (totalBytes + blob.size > INGEST_LIMITS.maxTotalExtractedBytes) {
      warnings.push("Stopped fetching additional files after reaching 1 MB text cap.");
      break;
    }

    const blobRes = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(ref.owner)}/${encodeURIComponent(
        ref.repo
      )}/git/blobs/${encodeURIComponent(blob.sha)}`,
      {
        headers,
        redirect: "error",
        signal: AbortSignal.timeout(10_000),
      }
    );

    if (!blobRes.ok) {
      warnings.push(`Failed to fetch file content for ${blob.path} (HTTP ${blobRes.status}).`);
      continue;
    }

    const blobJson = (await blobRes.json()) as {
      content?: string;
      encoding?: string;
    };

    if (blobJson.encoding !== "base64" || typeof blobJson.content !== "string") {
      skippedCount++;
      continue;
    }

    const decoded = Buffer.from(blobJson.content.replace(/\n/g, ""), "base64");
    if (decoded.length > INGEST_LIMITS.maxFileBytes || decoded.includes(0)) {
      skippedCount++;
      continue;
    }

    totalBytes += decoded.length;
    files.push({
      path: blob.path,
      content: decoded.toString("utf8"),
      sizeBytes: decoded.length,
      language: blob.language,
      isTestFile: blob.isTestFile,
      isDependencyManifest: blob.isDependencyManifest,
    });
  }

  return buildIngestedRepositoryMetadata({
    id: `gh_${ref.owner}_${ref.repo}`,
    source: "github",
    repoUrl: ref.canonicalUrl,
    owner: ref.owner,
    name: meta.full_name || `${ref.owner}/${ref.repo}`,
    defaultBranch: meta.default_branch,
    description: meta.description,
    stars: meta.stargazers_count,
    archived: meta.archived,
    lastPushedAt: meta.pushed_at,
    files,
    totalBytes,
    truncated,
    skippedCount,
    warnings,
  });
}

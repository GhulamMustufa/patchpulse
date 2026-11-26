import crypto from "node:crypto";
import { evaluateDependencyPolicy, DependencyPolicyResult } from "./dependency-policy";
import { detectProjectLanguageAndFramework, ProjectLanguageProfile } from "./language-detector";
import {
  evaluateNodeDependencyPolicy,
  NodeDependencyPolicyResult,
} from "./node-dependency-policy";
import { isUnsafeArchivePath } from "./repo-metadata";
import {
  SandboxExecuteRequest,
  SandboxWorkerResponseSchema,
  SandboxWorkerResult,
} from "./schemas";
import { ResurrectionState } from "./types";

export interface SandboxJobRecord {
  jobId: string;
  accessToken: string;
  dedupKey: string;
  repositoryName: string;
  language: ProjectLanguageProfile["primaryLanguage"];
  runtime: ProjectLanguageProfile["runtime"];
  framework: string;
  languageProfile: ProjectLanguageProfile;
  status: "QUEUED" | "RUNNING" | "COMPLETED" | "BLOCKED" | "FAILED";
  resurrectionState: ResurrectionState;
  dependencyPolicy: DependencyPolicyResult | NodeDependencyPolicyResult;
  result?: SandboxWorkerResult;
  error?: string;
  createdAt: string;
  completedAt?: string;
}

const MAX_STORED_JOBS = 100;
const MAX_CONCURRENT_ACTIVE_JOBS = 4;
const DEDUP_WINDOW_MS = 60_000;

const jobsStore = new Map<string, SandboxJobRecord>();
const dedupIndex = new Map<string, { jobId: string; createdAtMs: number }>();

export function clearSandboxJobsForTest() {
  jobsStore.clear();
  dedupIndex.clear();
}

function computeJobHash(req: SandboxExecuteRequest): string {
  const hash = crypto.createHash("sha256");
  hash.update(req.repositoryName);
  hash.update(`\0${req.language || "auto"}`);
  const sorted = [...req.files].sort((a, b) => a.path.localeCompare(b.path));
  for (const f of sorted) {
    hash.update(`\0${f.path}\0${f.content}`);
  }
  return hash.digest("hex");
}

function pruneOldJobs() {
  if (jobsStore.size <= MAX_STORED_JOBS) return;
  const oldestKey = jobsStore.keys().next().value;
  if (oldestKey) jobsStore.delete(oldestKey);
}

export function mapSandboxResultToResurrectionState(
  workerResult: SandboxWorkerResult
): ResurrectionState {
  if (workerResult.status === "VERIFICATION_BLOCKED") {
    return "VERIFICATION_BLOCKED";
  }
  if (!workerResult.syntaxValid || workerResult.timedOut) {
    return "FAILED";
  }
  if (workerResult.status === "NO_TESTS_FOUND") {
    return "SYNTAX_VERIFIED";
  }
  if (
    workerResult.status === "PASSED" &&
    workerResult.totalTests > 0 &&
    workerResult.passedTests === workerResult.totalTests &&
    workerResult.failedTests === 0
  ) {
    return "RESURRECTED";
  }
  if (workerResult.status === "PARTIAL" || workerResult.passedTests > 0) {
    return "PARTIALLY_RESURRECTED";
  }
  return "FAILED";
}

export function getAuthorizedSandboxJob(
  jobId: string,
  providedToken: string | null
): { ok: true; job: SandboxJobRecord } | { ok: false; status: number; error: string } {
  const job = jobsStore.get(jobId);
  if (!job) {
    return { ok: false, status: 404, error: "Sandbox job not found." };
  }
  if (!providedToken) {
    return { ok: false, status: 401, error: "Missing x-job-token authorization header." };
  }

  const a = Buffer.from(providedToken, "utf8");
  const b = Buffer.from(job.accessToken, "utf8");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, status: 403, error: "Unauthorized access to sandbox job." };
  }

  return { ok: true, job };
}

export async function submitSandboxExecutionJob(
  req: SandboxExecuteRequest
): Promise<
  | { ok: true; job: SandboxJobRecord; deduplicated: boolean }
  | { ok: false; status: number; error: string }
> {
  for (const f of req.files) {
    if (f.isSymlink) {
      return {
        ok: false,
        status: 400,
        error: `Rejected unsafe symbolic link in repository files: ${f.path}`,
      };
    }
    if (isUnsafeArchivePath(f.path)) {
      return {
        ok: false,
        status: 400,
        error: `Rejected unsafe file path: ${f.path}`,
      };
    }
  }

  const dedupKey = computeJobHash(req);
  const existingRef = dedupIndex.get(dedupKey);
  if (existingRef && Date.now() - existingRef.createdAtMs < DEDUP_WINDOW_MS) {
    const existingJob = jobsStore.get(existingRef.jobId);
    if (existingJob) {
      return { ok: true, job: existingJob, deduplicated: true };
    }
  }

  let runningCount = 0;
  for (const j of jobsStore.values()) {
    if (j.status === "RUNNING") runningCount++;
  }
  if (runningCount >= MAX_CONCURRENT_ACTIVE_JOBS) {
    return {
      ok: false,
      status: 429,
      error: "Too many concurrent sandbox jobs running. Please wait and retry.",
    };
  }

  const languageProfile = detectProjectLanguageAndFramework(req.files);
  const isNodeTarget =
    req.language === "javascript" ||
    req.language === "typescript" ||
    (!req.language &&
      (languageProfile.primaryLanguage === "javascript" ||
        languageProfile.primaryLanguage === "typescript" ||
        languageProfile.runtime === "nodejs20"));

  const dependencyPolicy = isNodeTarget
    ? evaluateNodeDependencyPolicy(req.files)
    : evaluateDependencyPolicy(req.files);

  const jobId = `sbx_${crypto.randomUUID()}`;
  const accessToken = crypto.randomBytes(24).toString("hex");

  const job: SandboxJobRecord = {
    jobId,
    accessToken,
    dedupKey,
    repositoryName: req.repositoryName,
    language: req.language ?? languageProfile.primaryLanguage,
    runtime: isNodeTarget ? "nodejs20" : languageProfile.runtime,
    framework: languageProfile.framework,
    languageProfile,
    status: "RUNNING",
    resurrectionState: "TESTS_RUNNING",
    dependencyPolicy,
    createdAt: new Date().toISOString(),
  };

  pruneOldJobs();
  jobsStore.set(jobId, job);
  dedupIndex.set(dedupKey, { jobId, createdAtMs: Date.now() });

  if (languageProfile.primaryLanguage === "unsupported" && !req.language) {
    job.status = "BLOCKED";
    job.resurrectionState = "VERIFICATION_BLOCKED";
    job.error =
      "Unsupported repository language. NecroCode supports Python 3.12, JavaScript, and TypeScript.";
    job.completedAt = new Date().toISOString();
    return { ok: true, job, deduplicated: false };
  }

  if (!dependencyPolicy.safeToExecute) {
    job.status = "BLOCKED";
    job.resurrectionState = "VERIFICATION_BLOCKED";
    job.error = dependencyPolicy.reason;
    job.completedAt = new Date().toISOString();
    return { ok: true, job, deduplicated: false };
  }

  const workerUrl = isNodeTarget
    ? process.env.NODE_SANDBOX_WORKER_URL || process.env.SANDBOX_WORKER_URL
    : process.env.SANDBOX_WORKER_URL;
  const workerToken = isNodeTarget
    ? process.env.NODE_SANDBOX_WORKER_TOKEN || process.env.SANDBOX_WORKER_TOKEN
    : process.env.SANDBOX_WORKER_TOKEN;

  if (!workerUrl || !workerToken) {
    job.status = "BLOCKED";
    job.resurrectionState = "VERIFICATION_BLOCKED";
    job.error =
      "Isolated sandbox worker (SANDBOX_WORKER_URL / SANDBOX_WORKER_TOKEN) is not configured. Untrusted repository execution is blocked on the Next.js server.";
    job.completedAt = new Date().toISOString();
    return { ok: true, job, deduplicated: false };
  }

  try {
    const targetEndpoint = `${workerUrl.replace(/\/$/, "")}/execute`;
    const workerRes = await fetch(targetEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${workerToken}`,
      },
      body: JSON.stringify({
        jobId,
        runtime: isNodeTarget ? "node" : "python",
        files: req.files,
        timeoutMs: req.timeoutMs,
      }),
      signal: AbortSignal.timeout(req.timeoutMs + 5000),
    });

    const rawJson: unknown = await workerRes.json();

    if (!workerRes.ok) {
      const errMsg =
        (rawJson as { error?: string })?.error ||
        `Sandbox worker rejected request (HTTP ${workerRes.status}).`;
      job.status = "FAILED";
      job.resurrectionState = "FAILED";
      job.error = errMsg;
      job.completedAt = new Date().toISOString();
      return { ok: true, job, deduplicated: false };
    }

    const parsed = SandboxWorkerResponseSchema.safeParse(rawJson);
    if (!parsed.success) {
      job.status = "FAILED";
      job.resurrectionState = "FAILED";
      job.error = "Sandbox worker returned malformed result schema.";
      job.completedAt = new Date().toISOString();
      return { ok: true, job, deduplicated: false };
    }

    job.result = parsed.data.result;
    job.resurrectionState = mapSandboxResultToResurrectionState(parsed.data.result);
    job.status =
      job.resurrectionState === "VERIFICATION_BLOCKED"
        ? "BLOCKED"
        : job.resurrectionState === "FAILED"
        ? "FAILED"
        : "COMPLETED";
    job.completedAt = new Date().toISOString();
    return { ok: true, job, deduplicated: false };
  } catch (err: unknown) {
    job.status = "BLOCKED";
    job.resurrectionState = "VERIFICATION_BLOCKED";
    job.error =
      err instanceof Error
        ? `Sandbox worker unreachable or timed out: ${err.message}`
        : "Sandbox worker communication failure.";
    job.completedAt = new Date().toISOString();
    return { ok: true, job, deduplicated: false };
  }
}

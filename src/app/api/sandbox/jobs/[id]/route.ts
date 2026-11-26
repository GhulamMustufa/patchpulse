import { NextRequest, NextResponse } from "next/server";
import { getAuthorizedSandboxJob } from "@/lib/necro-engine/sandbox-jobs";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const token = req.headers.get("x-job-token");
  const check = getAuthorizedSandboxJob(id, token);

  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const { job } = check;
  return NextResponse.json({
    jobId: job.jobId,
    repositoryName: job.repositoryName,
    language: job.language,
    runtime: job.runtime,
    framework: job.framework,
    status: job.status,
    resurrectionState: job.resurrectionState,
    dependencyPolicy: job.dependencyPolicy,
    totalTests: job.result?.totalTests ?? 0,
    passedTests: job.result?.passedTests ?? 0,
    failedTests: job.result?.failedTests ?? 0,
    skippedTests: job.result?.skippedTests ?? 0,
    durationMs: job.result?.durationMs ?? 0,
    exitCode: job.result?.exitCode ?? null,
    diagnostics: job.result?.tsDiagnostics ?? [],
    errors: job.result?.failures ?? [],
    cleanupVerified: job.result?.cleanupVerified ?? true,
    result: job.result ?? null,
    error: job.error ?? null,
    createdAt: job.createdAt,
    completedAt: job.completedAt ?? null,
  });
}

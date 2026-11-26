import { NextRequest, NextResponse } from "next/server";
import { SandboxExecuteRequestSchema } from "@/lib/necro-engine/schemas";
import { submitSandboxExecutionJob } from "@/lib/necro-engine/sandbox-jobs";

export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json();
    const parsed = SandboxExecuteRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            parsed.error.issues[0]?.message ||
            "Invalid sandbox execution request.",
        },
        { status: 400 }
      );
    }

    const outcome = await submitSandboxExecutionJob(parsed.data);
    if (!outcome.ok) {
      return NextResponse.json(
        { error: outcome.error },
        { status: outcome.status }
      );
    }

    const { job, deduplicated } = outcome;
    return NextResponse.json({
      jobId: job.jobId,
      accessToken: job.accessToken,
      deduplicated,
      language: job.language,
      runtime: job.runtime,
      framework: job.framework,
      languageProfile: job.languageProfile,
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
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : "Sandbox execution dispatch failed.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

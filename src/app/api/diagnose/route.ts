import { NextRequest, NextResponse } from "next/server";
import {
  DiagnoseRequestSchema,
  IngestedRepository,
} from "@/lib/necro-engine/schemas";
import { diagnoseRepository } from "@/lib/necro-engine/repo-diagnoser";
import { buildIngestedRepositoryMetadata } from "@/lib/necro-engine/repo-metadata";

export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json();
    const parsed = DiagnoseRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid diagnosis request." },
        { status: 400 }
      );
    }

    let repository: IngestedRepository | undefined = parsed.data.repository;

    if (!repository && parsed.data.code !== undefined) {
      const code = parsed.data.code;
      const lang = parsed.data.language ?? "python";
      const defaultName =
        lang === "typescript" ? "index.ts" : lang === "javascript" ? "index.js" : "main.py";
      const fileName = parsed.data.fileName || defaultName;
      repository = buildIngestedRepositoryMetadata({
        id: `custom_${Date.now()}`,
        source: "custom",
        name: fileName,
        files: [
          {
            path: fileName,
            content: code,
            sizeBytes: Buffer.byteLength(code, "utf8"),
            language: lang,
            isTestFile:
              fileName.startsWith("test_") || /\.(test|spec)\./i.test(fileName),
            isDependencyManifest: false,
          },
        ],
        totalBytes: Buffer.byteLength(code, "utf8"),
        truncated: false,
        skippedCount: 0,
        warnings: [],
      });
    }

    if (!repository || repository.files.length === 0) {
      return NextResponse.json(
        { error: "Provide either an ingested repository or non-empty source code." },
        { status: 400 }
      );
    }

    const diagnosis = diagnoseRepository(repository);
    return NextResponse.json({ diagnosis });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to diagnose repository.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

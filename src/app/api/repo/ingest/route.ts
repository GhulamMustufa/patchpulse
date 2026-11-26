import { NextRequest, NextResponse } from "next/server";
import { GitHubIngestJsonSchema } from "@/lib/necro-engine/schemas";
import {
  buildIngestedRepositoryMetadata,
  ingestPublicGitHubRepository,
} from "@/lib/necro-engine/github";
import { detectProjectLanguageAndFramework } from "@/lib/necro-engine/language-detector";
import { extractSafePythonZip, INGEST_LIMITS } from "@/lib/necro-engine/zip";

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("archive");
      if (!file || !(file instanceof File)) {
        return NextResponse.json(
          { error: "Missing 'archive' ZIP file in form upload." },
          { status: 400 }
        );
      }

      if (!file.name.toLowerCase().endsWith(".zip")) {
        return NextResponse.json(
          { error: "Unsupported archive format. Only .zip archives are supported." },
          { status: 400 }
        );
      }

      if (file.size > INGEST_LIMITS.maxArchiveBytes) {
        return NextResponse.json(
          { error: "ZIP archive exceeds maximum 5 MB limit." },
          { status: 413 }
        );
      }

      const arrayBuf = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuf);
      const extracted = extractSafePythonZip(buffer);

      const repo = buildIngestedRepositoryMetadata({
        id: `zip_${Date.now()}`,
        source: "zip",
        name: file.name.replace(/\.zip$/i, ""),
        files: extracted.files,
        totalBytes: extracted.totalBytes,
        truncated: extracted.truncated,
        skippedCount: extracted.skippedCount,
        warnings: extracted.warnings,
      });

      const languageProfile = detectProjectLanguageAndFramework(repo.files);
      if (languageProfile.primaryLanguage === "unsupported") {
        return NextResponse.json(
          {
            error:
              "No supported Python, JavaScript, or TypeScript source files found in the uploaded ZIP archive.",
            languageProfile,
          },
          { status: 422 }
        );
      }

      return NextResponse.json({ repository: repo, languageProfile });
    }

    const body: unknown = await req.json();
    const parsed = GitHubIngestJsonSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: parsed.error.issues[0]?.message || "Invalid request payload.",
        },
        { status: 400 }
      );
    }

    const repository = await ingestPublicGitHubRepository(parsed.data.repoUrl);
    const languageProfile = detectProjectLanguageAndFramework(repository.files);

    if (languageProfile.primaryLanguage === "unsupported") {
      return NextResponse.json(
        {
          error:
            "This repository does not contain supported Python, JavaScript, or TypeScript files.",
          languageProfile,
        },
        { status: 422 }
      );
    }

    return NextResponse.json({ repository, languageProfile });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to ingest repository.";
    const status =
      message.includes("not found") || message.includes("private")
        ? 404
        : message.includes("rate limit")
        ? 429
        : message.includes("Invalid") ||
          message.includes("Only HTTPS") ||
          message.includes("Hostname") ||
          message.includes("Unsafe") ||
          message.includes("Unsupported") ||
          message.includes("Malformed")
        ? 400
        : 500;

    return NextResponse.json({ error: message }, { status });
  }
}

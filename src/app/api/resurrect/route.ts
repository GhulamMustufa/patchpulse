import { NextRequest, NextResponse } from "next/server";
import { ResurrectRequestSchema } from "@/lib/necro-engine/schemas";
import { diagnoseRepository } from "@/lib/necro-engine/repo-diagnoser";
import { resurrectRepository } from "@/lib/necro-engine/repair";

export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json();
    const parsed = ResurrectRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid repair request." },
        { status: 400 }
      );
    }

    const diagnosis =
      parsed.data.diagnosis ?? diagnoseRepository(parsed.data.repository);

    const resurrection = await resurrectRepository({
      repository: parsed.data.repository,
      diagnosis,
      useAi: parsed.data.useAi,
      targetFiles: parsed.data.targetFiles,
    });

    return NextResponse.json({ diagnosis, resurrection });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to generate repair patches.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

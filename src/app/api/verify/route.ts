import { NextRequest, NextResponse } from "next/server";
import { VerifyRequestSchema } from "@/lib/necro-engine/schemas";
import { prepareRepositoryVerification } from "@/lib/necro-engine/verify-prep";

export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json();
    const parsed = VerifyRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid verify request." },
        { status: 400 }
      );
    }

    const result = prepareRepositoryVerification(parsed.data);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Verification preparation failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

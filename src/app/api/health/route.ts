import { NextResponse } from "next/server";

export async function GET() {
  const workerConfigured = Boolean(
    process.env.SANDBOX_WORKER_URL && process.env.SANDBOX_WORKER_TOKEN
  );

  return NextResponse.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    environment: process.env.NODE_ENV || "development",
    integrations: {
      database: process.env.DATABASE_URL ? "connected_serverless" : "in_memory_fallback",
      ai: process.env.GEMINI_API_KEY ? "live_gemini_configured" : "deterministic_fallback",
      github: "public_api_ready",
      sandbox: workerConfigured
        ? "isolated_worker_configured"
        : "worker_not_configured_fail_closed",
      runtimes: ["python3.12", "nodejs20", "typescript5.9"],
    },
  });
}

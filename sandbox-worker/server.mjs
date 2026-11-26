import crypto from "node:crypto";
import http from "node:http";
import { detectSandboxDriver, runIsolatedPythonJob } from "./executor.mjs";
import { detectNodeSandboxDriver, runIsolatedNodeJob } from "./node/executor.mjs";

const HOST = process.env.SANDBOX_WORKER_HOST || "127.0.0.1";
const PORT = Number(process.env.SANDBOX_WORKER_PORT || 4100);
const WORKER_TOKEN = process.env.SANDBOX_WORKER_TOKEN || "";
const MAX_BODY_BYTES = 2 * 1024 * 1024;
const MAX_CONCURRENT_JOBS = 3;

let activeJobs = 0;

function timingSafeBearerMatch(authHeader, expectedToken) {
  if (!expectedToken || !authHeader || !authHeader.startsWith("Bearer ")) {
    return false;
  }
  const provided = Buffer.from(authHeader.slice(7), "utf8");
  const expected = Buffer.from(expectedToken, "utf8");
  if (provided.length !== expected.length) return false;
  return crypto.timingSafeEqual(provided, expected);
}

function sendJson(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

export function createWorkerServer(options = {}) {
  const token = options.token ?? WORKER_TOKEN;

  return http.createServer(async (req, res) => {
    if (req.method === "GET" && req.url === "/health") {
      const pyDriver = detectSandboxDriver();
      const nodeDriver = detectNodeSandboxDriver();
      return sendJson(res, 200, {
        status: "healthy",
        driver: pyDriver.driver,
        detail: pyDriver.detail,
        runtimes: {
          python: pyDriver,
          node: nodeDriver,
        },
        activeJobs,
        maxConcurrentJobs: MAX_CONCURRENT_JOBS,
      });
    }

    if (req.method === "POST" && req.url === "/execute") {
      if (!timingSafeBearerMatch(req.headers.authorization, token)) {
        return sendJson(res, 401, { error: "Unauthorized worker request." });
      }

      if (activeJobs >= MAX_CONCURRENT_JOBS) {
        return sendJson(res, 429, {
          error: "Sandbox worker concurrency limit reached. Try again shortly.",
        });
      }

      let rawBody = "";
      let bodyBytes = 0;

      req.on("data", (chunk) => {
        bodyBytes += chunk.length;
        if (bodyBytes > MAX_BODY_BYTES) {
          req.destroy();
          return;
        }
        rawBody += chunk.toString("utf8");
      });

      req.on("end", async () => {
        if (bodyBytes > MAX_BODY_BYTES) {
          return sendJson(res, 413, { error: "Payload exceeds 2 MB limit." });
        }

        let payload;
        try {
          payload = JSON.parse(rawBody);
        } catch {
          return sendJson(res, 400, { error: "Invalid JSON body." });
        }

        activeJobs++;
        try {
          const runtime = payload?.runtime === "node" ? "node" : "python";
          const result =
            runtime === "node"
              ? await runIsolatedNodeJob(payload)
              : await runIsolatedPythonJob(payload);
          return sendJson(res, 200, { result });
        } catch (err) {
          return sendJson(res, 400, {
            error: err instanceof Error ? err.message : "Sandbox execution error.",
          });
        } finally {
          activeJobs = Math.max(0, activeJobs - 1);
        }
      });

      return;
    }

    return sendJson(res, 404, { error: "Not found" });
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (!WORKER_TOKEN) {
    console.error("FATAL: SANDBOX_WORKER_TOKEN must be set before starting sandbox-worker.");
    process.exit(1);
  }
  const server = createWorkerServer({ token: WORKER_TOKEN });
  server.listen(PORT, HOST, () => {
    const d = detectSandboxDriver();
    console.log(`NecroCode Multi-Runtime Sandbox Worker listening on http://${HOST}:${PORT} (${d.driver})`);
  });
}

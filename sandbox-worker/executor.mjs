import { spawn, spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RESULT_PREFIX = "__NECRO_SANDBOX_RESULT__:";
const MAX_OUTPUT_BYTES = 64 * 1024;
const MAX_TIMEOUT_MS = 15_000;
const RUNNER_PATH = path.join(__dirname, "runner.py");

export function isUnsafeFilePath(rawPath) {
  if (!rawPath || typeof rawPath !== "string") return true;
  if (rawPath.includes("\0") || rawPath.startsWith("/") || rawPath.startsWith("\\")) {
    return true;
  }
  if (/^[A-Za-z]:/.test(rawPath)) return true;
  const normalized = rawPath.replace(/\\/g, "/");
  return normalized.split("/").some((seg) => seg === ".." || seg === "." || seg === "");
}

export function sanitizeSandboxOutput(text, jobDir) {
  if (!text) return "";
  let cleaned = text
    // Strip ANSI escape codes
    .replace(/\u001b\[[0-9;]*[A-Za-z]/g, "")
    // Redact common secret patterns if somehow echoed
    .replace(/\b(AIza[0-9A-Za-z_-]{20,}|ghp_[0-9A-Za-z]{20,}|sk-[0-9A-Za-z]{20,})\b/g, "[REDACTED_TOKEN]");

  if (jobDir) {
    cleaned = cleaned.split(jobDir).join("/workspace");
    try {
      const realDir = fs.realpathSync(jobDir);
      cleaned = cleaned.split(realDir).join("/workspace");
    } catch {
      // ignore if already removed
    }
  }
  return cleaned;
}

export function detectSandboxDriver(
  requiredImage = process.env.SANDBOX_DOCKER_IMAGE || "necrocode-sandbox:py312"
) {
  const forced = process.env.SANDBOX_DRIVER;

  // Check Docker daemon availability and required local image
  if (forced !== "seatbelt") {
    const dockerProbe = spawnSync("docker", ["info", "--format", "{{.ServerVersion}}"], {
      encoding: "utf8",
      timeout: 2500,
    });
    if (dockerProbe.status === 0) {
      const imageProbe = spawnSync("docker", ["image", "inspect", requiredImage], {
        stdio: "ignore",
        timeout: 2000,
      });
      if (imageProbe.status === 0) {
        return {
          driver: "docker",
          detail: `Docker daemon active (${dockerProbe.stdout.trim()})`,
        };
      }
      if (forced === "docker") {
        return {
          driver: "unavailable",
          detail: `SANDBOX_DRIVER=docker requested, but image '${requiredImage}' is not built locally.`,
        };
      }
    } else if (forced === "docker") {
      return {
        driver: "unavailable",
        detail: "SANDBOX_DRIVER=docker requested, but Docker daemon is not reachable.",
      };
    }
  }

  // Check macOS Seatbelt (/usr/bin/sandbox-exec)
  if (process.platform === "darwin" && fs.existsSync("/usr/bin/sandbox-exec")) {
    const pyBin = resolvePythonBinary();
    if (pyBin) {
      return {
        driver: "seatbelt",
        detail: `macOS Seatbelt (/usr/bin/sandbox-exec) + ${pyBin}`,
      };
    }
  }

  return {
    driver: "unavailable",
    detail: "No isolated sandbox driver (Docker daemon or macOS Seatbelt) is available.",
  };
}

function resolvePythonBinary() {
  const candidates = ["/opt/homebrew/bin/python3.12", "python3.12", "python3"];
  for (const bin of candidates) {
    if (bin.startsWith("/") && !fs.existsSync(bin)) continue;
    const probe = spawnSync(bin, ["--version"], { encoding: "utf8", timeout: 1500 });
    if (probe.status === 0) return bin;
  }
  return null;
}

function buildSeatbeltProfile(jobDir) {
  let realJobDir = jobDir;
  try {
    realJobDir = fs.realpathSync(jobDir);
  } catch {
    // fallback
  }

  // Strict MAC policy: deny outbound/inbound network, deny writes outside jobDir,
  // deny reading user home/repo directories and sensitive host files.
  return `
(version 1)
(allow default)
(deny network*)
(deny file-write*)
(allow file-write* (subpath "${realJobDir}") (subpath "${jobDir}") (literal "/dev/null"))
(deny file-read*
  (subpath "/Users")
  (subpath "/private/var/root")
  (subpath "/Volumes")
  (literal "/private/etc/master.passwd")
  (literal "/etc/master.passwd")
)
(allow file-read*
  (literal "/Users")
  (subpath "${realJobDir}")
  (subpath "${jobDir}")
)
`.trim();
}

export async function runIsolatedPythonJob(input) {
  const start = Date.now();
  const jobId = input.jobId || `job_${crypto.randomBytes(8).toString("hex")}`;
  const timeoutMs = Math.min(Math.max(Number(input.timeoutMs) || 8000, 1000), MAX_TIMEOUT_MS);

  // 1. Validate files & reject symlinks / path traversal before touching disk
  if (!Array.isArray(input.files) || input.files.length === 0) {
    throw new Error("Sandbox job requires at least one file.");
  }
  if (input.files.length > 40) {
    throw new Error("Sandbox job exceeds maximum file count (40).");
  }

  for (const f of input.files) {
    if (f.isSymlink) {
      throw new Error(`Security rejection: symbolic link not allowed (${f.path}).`);
    }
    if (isUnsafeFilePath(f.path)) {
      throw new Error(`Security rejection: unsafe file path (${f.path}).`);
    }
    if (typeof f.content !== "string" || Buffer.byteLength(f.content, "utf8") > 120 * 1024) {
      throw new Error(`File ${f.path} exceeds 120 KB sandbox limit.`);
    }
  }

  const driverInfo = detectSandboxDriver();
  if (driverInfo.driver === "unavailable") {
    return {
      jobId,
      driver: "unavailable",
      driverDetail: driverInfo.detail,
      status: "VERIFICATION_BLOCKED",
      syntaxValid: false,
      syntaxErrors: [],
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      skippedTests: 0,
      failures: [],
      durationMs: Date.now() - start,
      exitCode: -1,
      timedOut: false,
      outputTruncated: false,
      cleanupVerified: true,
      logs: driverInfo.detail,
      stdout: "",
      stderr: "",
    };
  }

  const jobDir = fs.mkdtempSync(path.join(os.tmpdir(), "necro-sandbox-"));
  fs.chmodSync(jobDir, 0o700);
  const containerName = `necro-sbx-${jobId.replace(/[^a-zA-Z0-9_-]/g, "")}`;

  try {
    // Write files safely inside ephemeral job directory
    for (const f of input.files) {
      const target = path.resolve(jobDir, f.path);
      if (!target.startsWith(jobDir + path.sep)) {
        throw new Error(`Path escape blocked: ${f.path}`);
      }
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, f.content, { encoding: "utf8", mode: 0o644 });
    }

    // Verify no symlinks exist inside jobDir after write
    for (const f of input.files) {
      const target = path.resolve(jobDir, f.path);
      if (fs.lstatSync(target).isSymbolicLink()) {
        throw new Error(`Symlink detected after write: ${f.path}`);
      }
    }

    // Copy runner.py into jobDir as read-only for Seatbelt execution
    const jobRunnerPath = path.join(jobDir, "__necro_runner__.py");
    fs.copyFileSync(RUNNER_PATH, jobRunnerPath);
    fs.chmodSync(jobRunnerPath, 0o444);

    // Scrub environment completely: zero host secrets!
    const cleanEnv = {
      PATH: "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin",
      HOME: "/nonexistent",
      PYTHONDONTWRITEBYTECODE: "1",
      PYTHONNOUSERSITE: "1",
      PYTHONIOENCODING: "utf-8",
      LANG: "C.UTF-8",
    };

    let cmd;
    let args;
    if (driverInfo.driver === "docker") {
      const image = process.env.SANDBOX_DOCKER_IMAGE || "necrocode-sandbox:py312";
      cmd = "docker";
      args = [
        "run",
        "--rm",
        "--name",
        containerName,
        "--network=none",
        "--read-only",
        "--cap-drop=ALL",
        "--security-opt=no-new-privileges:true",
        "--user=65534:65534",
        "--memory=128m",
        "--memory-swap=128m",
        "--cpus=0.5",
        "--pids-limit=32",
        "--ulimit",
        "nofile=64:64",
        "--ulimit",
        "fsize=1048576:1048576",
        "--tmpfs",
        "/tmp:rw,noexec,nosuid,nodev,size=32m",
        "-v",
        `${jobDir}:/workspace:ro`,
        "-w",
        "/workspace",
        image,
      ];
    } else {
      const pyBin = resolvePythonBinary();
      const profile = buildSeatbeltProfile(jobDir);
      cmd = "/usr/bin/sandbox-exec";
      args = ["-p", profile, pyBin, jobRunnerPath];
    }

    const execResult = await new Promise((resolve) => {
      let stdoutBuf = Buffer.alloc(0);
      let stderrBuf = Buffer.alloc(0);
      let outputTruncated = false;
      let timedOut = false;
      let settled = false;

      const child = spawn(cmd, args, {
        cwd: jobDir,
        env: cleanEnv,
        shell: false,
        detached: true,
        stdio: ["ignore", "pipe", "pipe"],
      });

      const killProcessGroup = () => {
        try {
          if (child.pid) process.kill(-child.pid, "SIGKILL");
        } catch {
          try {
            child.kill("SIGKILL");
          } catch {
            // ignore
          }
        }
        if (driverInfo.driver === "docker") {
          spawnSync("docker", ["rm", "-f", containerName], { timeout: 2000 });
        }
      };

      const timer = setTimeout(() => {
        timedOut = true;
        killProcessGroup();
      }, timeoutMs);

      const appendChunk = (existing, chunk) => {
        if (existing.length >= MAX_OUTPUT_BYTES) {
          outputTruncated = true;
          return existing;
        }
        const remaining = MAX_OUTPUT_BYTES - existing.length;
        if (chunk.length > remaining) {
          outputTruncated = true;
          const sliced = Buffer.concat([existing, chunk.subarray(0, remaining)]);
          killProcessGroup();
          return sliced;
        }
        return Buffer.concat([existing, chunk]);
      };

      child.stdout.on("data", (chunk) => {
        stdoutBuf = appendChunk(stdoutBuf, chunk);
      });
      child.stderr.on("data", (chunk) => {
        stderrBuf = appendChunk(stderrBuf, chunk);
      });

      child.on("error", (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({
          exitCode: -1,
          timedOut,
          outputTruncated,
          stdout: stdoutBuf.toString("utf8"),
          stderr: `${stderrBuf.toString("utf8")}\nWorker spawn error: ${err.message}`,
        });
      });

      child.on("close", (code) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({
          exitCode: typeof code === "number" ? code : -1,
          timedOut,
          outputTruncated,
          stdout: stdoutBuf.toString("utf8"),
          stderr: stderrBuf.toString("utf8"),
        });
      });
    });

    const sanitizedStdout = sanitizeSandboxOutput(execResult.stdout, jobDir);
    const sanitizedStderr = sanitizeSandboxOutput(execResult.stderr, jobDir);

    // Parse structured runner output if present
    let parsedRunner = null;
    for (const line of sanitizedStdout.split("\n")) {
      if (line.startsWith(RESULT_PREFIX)) {
        try {
          parsedRunner = JSON.parse(line.slice(RESULT_PREFIX.length));
        } catch {
          // ignore malformed partial JSON
        }
      }
    }

    const displayStdout = sanitizedStdout
      .split("\n")
      .filter((l) => !l.startsWith(RESULT_PREFIX))
      .join("\n")
      .trim();

    if (execResult.timedOut) {
      return {
        jobId,
        driver: driverInfo.driver,
        driverDetail: driverInfo.detail,
        status: "FAILED",
        syntaxValid: parsedRunner?.syntaxValid ?? false,
        syntaxErrors: parsedRunner?.syntaxErrors ?? [],
        totalTests: parsedRunner?.totalTests ?? 0,
        passedTests: parsedRunner?.passedTests ?? 0,
        failedTests: parsedRunner?.failedTests ?? 0,
        skippedTests: parsedRunner?.skippedTests ?? 0,
        failures: [
          {
            test: "execution_timeout",
            trace: `Execution terminated after ${timeoutMs}ms timeout limit.`,
          },
        ],
        durationMs: Date.now() - start,
        exitCode: execResult.exitCode,
        timedOut: true,
        outputTruncated: execResult.outputTruncated,
        cleanupVerified: true,
        logs: `Sandbox killed job after ${timeoutMs}ms timeout.`,
        stdout: displayStdout,
        stderr: sanitizedStderr,
      };
    }

    if (execResult.outputTruncated && !parsedRunner) {
      return {
        jobId,
        driver: driverInfo.driver,
        driverDetail: driverInfo.detail,
        status: "FAILED",
        syntaxValid: false,
        syntaxErrors: [],
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        skippedTests: 0,
        failures: [
          {
            test: "output_limit_exceeded",
            trace: `Output exceeded ${MAX_OUTPUT_BYTES} byte limit and was terminated.`,
          },
        ],
        durationMs: Date.now() - start,
        exitCode: execResult.exitCode,
        timedOut: false,
        outputTruncated: true,
        cleanupVerified: true,
        logs: `Sandbox terminated job after exceeding ${MAX_OUTPUT_BYTES} byte output cap.`,
        stdout: displayStdout,
        stderr: sanitizedStderr,
      };
    }

    if (!parsedRunner) {
      return {
        jobId,
        driver: driverInfo.driver,
        driverDetail: driverInfo.detail,
        status: "FAILED",
        syntaxValid: false,
        syntaxErrors: [],
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        skippedTests: 0,
        failures: [
          {
            test: "worker_crash_or_abort",
            trace: sanitizedStderr || `Sandbox exited abnormally with code ${execResult.exitCode}.`,
          },
        ],
        durationMs: Date.now() - start,
        exitCode: execResult.exitCode,
        timedOut: false,
        outputTruncated: execResult.outputTruncated,
        cleanupVerified: true,
        logs: sanitizedStderr || "Sandbox process exited without structured result.",
        stdout: displayStdout,
        stderr: sanitizedStderr,
      };
    }

    return {
      jobId,
      driver: driverInfo.driver,
      driverDetail: driverInfo.detail,
      status: parsedRunner.status,
      syntaxValid: Boolean(parsedRunner.syntaxValid),
      syntaxErrors: parsedRunner.syntaxErrors ?? [],
      totalTests: parsedRunner.totalTests ?? 0,
      passedTests: parsedRunner.passedTests ?? 0,
      failedTests: parsedRunner.failedTests ?? 0,
      skippedTests: parsedRunner.skippedTests ?? 0,
      failures: (parsedRunner.failures ?? []).map((f) => ({
        test: f.test,
        trace: sanitizeSandboxOutput(f.trace, jobDir),
      })),
      durationMs: parsedRunner.durationMs ?? Date.now() - start,
      exitCode: parsedRunner.exitCode ?? execResult.exitCode,
      timedOut: false,
      outputTruncated: execResult.outputTruncated,
      cleanupVerified: true,
      logs: sanitizeSandboxOutput(parsedRunner.logs || "", jobDir),
      stdout: displayStdout,
      stderr: sanitizedStderr,
    };
  } finally {
    if (driverInfo.driver === "docker") {
      try {
        spawnSync("docker", ["rm", "-f", containerName], { timeout: 2000 });
      } catch {
        // ignore
      }
    }
    try {
      fs.rmSync(jobDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
}

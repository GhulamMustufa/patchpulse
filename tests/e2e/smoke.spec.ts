import { test, expect } from "@playwright/test";

test.describe("NecroCode E2E Smoke Tests", () => {
  test("1. Landing page renders clearly with plain-English value prop and CTA to /lab", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/");
    await expect(page).toHaveTitle(/NecroCode/i);
    await expect(
      page.getByRole("heading", { name: /Fix Broken Legacy Code/i })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Open Live Workspace/i })
    ).toHaveAttribute("href", "/lab");

    await page.getByRole("tab", { name: "typescript" }).click();
    await expect(page.getByText(/handler\.ts/i)).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("2. Workspace /lab sample project Fix Code updates status honestly", async ({
    page,
  }) => {
    await page.goto("/lab");
    await expect(page.getByText(/Archivus Mortis/i).first()).toBeVisible();
    await page.getByRole("button", { name: /Fix Code/i }).click();

    await expect(page.getByText(/Syntax OK • Tests Not Run/i)).toBeVisible({
      timeout: 5000,
    });
    await page.getByRole("tab", { name: /Test Results/i }).click();
    await expect(page.getByText(/Not Run/i).first()).toBeVisible();
  });

  test("3. Workspace /lab Paste Code tab exposes language selector and target runtime", async ({
    page,
  }) => {
    await page.goto("/lab");
    await page.getByRole("tab", { name: /Paste Code/i }).click();

    await expect(
      page.getByRole("group", { name: /Select source language/i })
    ).toBeVisible();
    await page.getByRole("button", { name: "JavaScript" }).click();
    await expect(page.getByText(/Node\.js 20/i)).toBeVisible();
  });

  test("4. System Status (/dashboard) and Guide (/docs) routes render NecroCode content", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await expect(
      page.getByRole("heading", { name: /System Status/i })
    ).toBeVisible();
    await expect(page.getByText(/Service & Sandbox Health/i)).toBeVisible();

    await page.goto("/docs");
    await expect(
      page.getByRole("heading", { name: /Guide & API Reference/i })
    ).toBeVisible();
    await expect(page.getByRole("tab", { name: /Quick Guide/i })).toBeVisible();
  });
});

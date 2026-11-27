import { test, expect } from "@playwright/test";

test.describe("01. Landing Page, Deep Links, Assets & Status", () => {
  test("Landing page renders hero, interactive Python/JS/TS preview, and loads brand assets", async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    const serverErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));
    page.on("response", (res) => {
      if (res.status() >= 500) serverErrors.push(`${res.status()} ${res.url()}`);
    });

    await page.goto("/");
    await expect(page).toHaveTitle(/PatchPulse/i);
    await expect(
      page.getByRole("heading", { name: /Fix Broken Legacy Code/i })
    ).toBeVisible();

    // Verify logo image actually loaded
    const logo = page.locator('header img[alt="PatchPulse logo"]');
    await expect(logo).toBeVisible();
    const logoLoaded = await logo.evaluate(
      (img: HTMLImageElement) => img.complete && img.naturalWidth > 0
    );
    expect(logoLoaded).toBe(true);

    // Toggle preview language tabs (Python -> JavaScript -> TypeScript)
    await expect(page.getByText("archiver.py")).toBeVisible();
    await page.getByRole("tab", { name: "javascript" }).click();
    await expect(page.getByText("webhook.js")).toBeVisible();
    await page.getByRole("tab", { name: "typescript" }).click();
    await expect(page.getByText("handler.ts")).toBeVisible();

    // Primary CTA points cleanly to /lab
    const cta = page.getByRole("link", { name: /Open Live Workspace/i });
    await expect(cta).toHaveAttribute("href", "/lab");

    expect(pageErrors).toEqual([]);
    expect(serverErrors).toEqual([]);
  });

  test("Deep links from landing shortcuts open exact sample or GitHub tab in /lab", async ({
    page,
  }) => {
    await page.goto("/lab?sample=patient_node_webhook");
    await expect(page.getByText(/Webhook Specter/i).first()).toBeVisible();

    await page.goto("/lab?mode=github");
    await expect(
      page.getByRole("textbox", { name: /Public GitHub repository URL/i })
    ).toBeVisible();
  });

  test("System Status (/dashboard) and Guide (/docs) render healthy live states", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: /System Status/i })).toBeVisible();
    await expect(page.getByText(/Service & Sandbox Health/i)).toBeVisible();
    await expect(page.getByText(/Python 3\.12 • Node 20 • TS 5\.9/i)).toBeVisible();

    await page.goto("/docs");
    await expect(
      page.getByRole("heading", { name: /Guide & API Reference/i })
    ).toBeVisible();
    for (const tabName of [
      "Quick Guide",
      "How It Works",
      "API Reference",
      "Security & Sandbox",
    ]) {
      await page.getByRole("tab", { name: tabName }).click();
      await expect(page.getByRole("tab", { name: tabName })).toHaveAttribute(
        "aria-selected",
        "true"
      );
    }
  });
});

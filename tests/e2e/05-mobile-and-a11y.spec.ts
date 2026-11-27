import { test, expect } from "@playwright/test";

test.describe("05. Mobile Responsive (390px) & Accessibility Checks", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("All routes render without horizontal overflow or console errors on mobile", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    for (const route of ["/", "/lab", "/dashboard", "/docs"]) {
      await page.goto(route);
      await page.waitForLoadState("networkidle");

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth
      );
      expect(overflow, `Horizontal overflow detected on ${route}`).toBe(false);
    }

    // Verify source tabs work cleanly on mobile
    await page.goto("/lab");
    await page.getByRole("tab", { name: /Paste Code/i }).click();
    await expect(page.getByLabel("Original source code input")).toBeVisible();

    expect(errors).toEqual([]);
  });
});

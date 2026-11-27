import { test, expect } from "@playwright/test";

test.describe("02. Sample Projects, Approval Gate & Live Docker Execution", () => {
  test("Python sample: Fix Code -> Diff/Download -> Approve Gate -> Run Tests in Docker", async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));

    await page.goto("/lab");
    await expect(page.getByText(/Archivus Mortis/i).first()).toBeVisible();

    // 1. Click Fix Code
    await page.getByRole("button", { name: /^Fix Code$/i }).click();
    await expect(page.getByText(/Syntax OK • Tests Not Run/i).first()).toBeVisible({
      timeout: 8000,
    });

    // 2. Safety gate: Run Tests must be disabled before approval
    const runTestsBtn = page.getByRole("button", { name: /Run Tests/i });
    await expect(runTestsBtn).toBeDisabled();

    // 3. Toggle Split -> Diff and check unified diff renders
    await page.getByRole("button", { name: /^Diff$/i }).click();
    await expect(page.getByRole("button", { name: /Copy Diff/i })).toBeVisible();
    await page.getByRole("button", { name: /^Split$/i }).click();

    // 4. Test Download button triggers a real download
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /Download fixed file/i }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.py$/);

    // 5. Expand first issue in Issues tab
    const firstIssue = page.locator('button[aria-expanded]').first();
    if (await firstIssue.count()) {
      await firstIssue.click();
      await expect(firstIssue).toHaveAttribute("aria-expanded", "true");
    }

    // 6. Approve Fix enables Run Tests; unapproving re-disables it
    const approveBtn = page.getByRole("button", { name: /Approve Fix/i });
    await approveBtn.click();
    await expect(runTestsBtn).toBeEnabled();

    await page.getByRole("button", { name: /^Approved$/i }).click();
    await expect(runTestsBtn).toBeDisabled();
    await page.getByRole("button", { name: /Approve Fix/i }).click();
    await expect(runTestsBtn).toBeEnabled();

    // 7. Run Tests inside live Docker worker (single-file Archivus preset has no test_* functions -> Syntax OK • No Tests)
    await runTestsBtn.click();
    await expect(
      page.getByText(/Syntax OK • No Tests|All Tests Passed|Tests Blocked/i).first()
    ).toBeVisible({ timeout: 20_000 });

    // Inspect Test Results and Logs tabs
    await page.getByRole("tab", { name: /Test Results/i }).click();
    await expect(
      page.getByText(/Docker Container|macOS Seatbelt|Sandbox Unavailable|Tests Blocked/i).first()
    ).toBeVisible();

    await page.getByRole("tab", { name: /Logs/i }).click();
    await expect(page.locator("section").last()).toBeVisible();

    expect(pageErrors).toEqual([]);
  });

  test("Node.js sample (Webhook Specter): Fix Code -> Approve -> Run Tests", async ({
    page,
  }) => {
    await page.goto("/lab?sample=patient_node_webhook");
    await expect(page.getByText(/Webhook Specter/i).first()).toBeVisible();

    await page.getByRole("button", { name: /^Fix Code$/i }).click();
    await expect(page.getByText(/Syntax OK • Tests Not Run/i).first()).toBeVisible({
      timeout: 8000,
    });

    await page.getByRole("button", { name: /Approve Fix/i }).click();
    await page.getByRole("button", { name: /Run Tests/i }).click();

    await expect(
      page.getByText(/All Tests Passed|Tests Blocked|Some Tests Failed/i).first()
    ).toBeVisible({ timeout: 20_000 });
  });
});

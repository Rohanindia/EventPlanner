import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Shared future date for all tests
const FUTURE_DATE = "2028-12-25";

// Helper: run through wizard to generate a plan
async function generatePlan(page: Page, date: string) {
  await page.getByRole("button", { name: /start planning/i }).click();
  await page.getByRole("radio", { name: /wedding/i }).click();
  await page.getByRole("button", { name: /next/i }).click();
  await page.getByLabel(/event name/i).fill("Test Event");
  await page.getByLabel(/event date/i).fill(date);
  await page.getByLabel(/city/i).fill("Mumbai");
  await page.getByLabel(/number of guests/i).fill("100");
  await page.getByLabel(/total budget/i).fill("500000");
  await page.getByRole("button", { name: /next/i }).click();
  await page.getByRole("button", { name: /next/i }).click(); // step 3
  await page.getByRole("button", { name: /next/i }).click(); // step 4
  await page.getByRole("checkbox", { name: /i understand/i }).check();
  await page.getByRole("button", { name: /generate my plan/i }).click();
  await page.waitForSelector('[role="tablist"]', { timeout: 30000 });
}

test.describe("Jashn E2E - Full Wizard Flow", () => {
  test("home page has no accessibility violations", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test("skip link is present and functional", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    const skipLink = page.getByRole("link", { name: /skip to main content/i });
    await expect(skipLink).toBeFocused();
  });

  test("wizard opens and progresses through all steps", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /start planning/i }).click();

    // Step 1: Event type
    await expect(page.getByRole("heading", { name: /what type of event/i })).toBeVisible();
    await page.getByRole("radio", { name: /birthday/i }).click();
    await page.getByRole("button", { name: /next/i }).click();

    // Step 2: Basic details
    await page.getByLabel(/event name/i).fill("Rahul's Birthday Bash");
    await page.getByLabel(/event date/i).fill(FUTURE_DATE);
    await page.getByLabel(/city/i).fill("Chennai");
    await page.getByLabel(/number of guests/i).fill("75");
    await page.getByLabel(/total budget/i).fill("50000");
    await page.getByRole("button", { name: /next/i }).click();

    // Step 3: Birthday specifics
    await page.getByLabel(/age/i).fill("25");
    await page.getByRole("button", { name: /next/i }).click();

    // Step 4: Preferences
    await page.getByLabel(/theme/i).fill("Retro Bollywood");
    await page.getByLabel(/dietary/i).fill("Vegetarian");
    await page.getByRole("button", { name: /next/i }).click();

    // Step 5: Review
    await expect(page.getByText(/Rahul's Birthday Bash/)).toBeVisible();
    await page.getByRole("checkbox", { name: /i understand/i }).check();
    await page.getByRole("button", { name: /generate my plan/i }).click();

    // Wait for plan to generate (template mode)
    await expect(page.getByRole("heading", { name: /Rahul's Birthday Bash/i })).toBeVisible({
      timeout: 30000,
    });
  });

  test("dashboard tabs are keyboard navigable", async ({ page }) => {
    // Generate a plan first
    await page.goto("/");
    await generatePlan(page, FUTURE_DATE);

    // Focus first tab and use arrow keys
    const tabList = page.getByRole("tablist");
    await tabList.getByRole("tab", { name: /overview/i }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("tab", { name: /budget/i })).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("tab", { name: /timeline/i })).toBeFocused();
    await page.keyboard.press("Home");
    await expect(page.getByRole("tab", { name: /overview/i })).toBeFocused();
  });

  test("budget tab allows editing and shows total", async ({ page }) => {
    await page.goto("/");
    await generatePlan(page, FUTURE_DATE);

    await page.getByRole("tab", { name: /budget/i }).click();
    const budgetTable = page.getByRole("table");
    await expect(budgetTable).toBeVisible();

    // Check there's at least one input for planned amount
    const plannedInputs = page.getByRole("spinbutton").first();
    await expect(plannedInputs).toBeVisible();
  });

  test("timeline tab shows tasks with checkboxes", async ({ page }) => {
    await page.goto("/");
    await generatePlan(page, FUTURE_DATE);

    await page.getByRole("tab", { name: /timeline/i }).click();
    const firstCheckbox = page.getByRole("checkbox").first();
    await expect(firstCheckbox).toBeVisible();

    // Toggle a task
    await firstCheckbox.check();
    await expect(firstCheckbox).toBeChecked();
  });

  test("vendors tab shows status dropdowns", async ({ page }) => {
    await page.goto("/");
    await generatePlan(page, FUTURE_DATE);

    await page.getByRole("tab", { name: /vendors/i }).click();
    const statusDropdown = page.getByRole("combobox").first();
    await expect(statusDropdown).toBeVisible();

    // Change status
    await statusDropdown.selectOption("shortlisted");
    await expect(statusDropdown).toHaveValue("shortlisted");
  });

  test("ideas tab shows pinnable items", async ({ page }) => {
    await page.goto("/");
    await generatePlan(page, FUTURE_DATE);

    await page.getByRole("tab", { name: /ideas/i }).click();
    // Pin buttons should exist
    const pinButtons = page.getByRole("button", { name: /pin:/i });
    await expect(pinButtons.first()).toBeVisible();
    await pinButtons.first().click();
    // After pin, should show unpin button
    const unpinButtons = page.getByRole("button", { name: /unpin:/i });
    await expect(unpinButtons.first()).toBeVisible();
  });

  test("export JSON button triggers download", async ({ page }) => {
    await page.goto("/");
    await generatePlan(page, FUTURE_DATE);

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /json/i }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain(".json");
  });

  test("no accessibility violations on dashboard", async ({ page }) => {
    await page.goto("/");
    await generatePlan(page, FUTURE_DATE);

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test("mobile layout at 375px has no violations", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});

test.describe("Jashn E2E - Accessibility Scans", () => {
  test("wizard step 1 has no violations", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /start planning/i }).click();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test("wizard step 2 has no violations", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /start planning/i }).click();
    await page.getByRole("button", { name: /next/i }).click();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test("validation errors are announced correctly", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /start planning/i }).click();
    await page.getByRole("button", { name: /next/i }).click(); // step 1 → 2
    // Try to proceed without filling step 2
    await page.getByRole("button", { name: /next/i }).click();
    // Error summary should appear
    const errorAlert = page.getByRole("alert", { name: /form errors/i });
    await expect(errorAlert).toBeVisible();
  });
});

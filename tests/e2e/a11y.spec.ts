import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const routes = [
  "/",
  "/sign-in",
  "/sign-up",
  "/session-expired",
  "/onboarding",
  "/workspace",
  "/workspace/documents",
  "/workspace/files",
  "/workspace/sheets",
  "/workspace/mail",
  "/workspace/search",
  "/workspace/history",
  "/workspace/activity",
  "/workspace/accessibility",
  "/workspace/controls",
  "/workspace/settings",
  "/workspace/account"
] as const;

test.describe("Accessibility audits", () => {
  for (const route of routes) {
    test(`no automatically detectable accessibility issues on ${route}`, async ({ page }) => {
      await page.goto(route);
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();
      expect(results.violations).toEqual([]);
    });
  }

  test("no accessibility issues while onboarding accessibility options are open", async ({ page }) => {
    await page.goto("/onboarding");
    await page.getByRole("button", { name: "Accessibility options" }).click();
    await expect(page.getByRole("dialog", { name: "Accessibility options" })).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  });

  test("no accessibility issues in the mobile blocker", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Open Aksa on a computer" })).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  });
});

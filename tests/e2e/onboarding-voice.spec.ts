import { expect, test } from "@playwright/test";

test.describe("voice onboarding", () => {
  test("reveals the Aksa project brief after text continuation", async ({ page }) => {
    await page.goto("/onboarding");

    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByRole("button", { name: "Skip head control", exact: true }).click();

    await expect(
      page.getByRole("heading", { level: 1, name: "Try a voice command" })
    ).toBeVisible();
    await page.getByRole("button", { name: "Continue with text", exact: true }).click();

    await expect(page.getByRole("group", { name: "Project brief" })).toBeVisible();
    await expect(
      page.getByRole("checkbox", { name: "Include sources" })
    ).toHaveAttribute("aria-checked", "false");
    await expect(page.getByText("Option 1")).toHaveCount(0);
    await expect(page.locator("textarea, [contenteditable='true']")).toHaveCount(0);
  });
});

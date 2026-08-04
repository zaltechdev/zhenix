import { expect, test } from "@playwright/test";

test("loads the foundation screen", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("status")).toBeVisible();
});

test("switches to Indonesian", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Indonesian" }).click();

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Fondasi Aksa siap digunakan");
});

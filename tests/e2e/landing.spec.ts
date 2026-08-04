import { expect, test } from "@playwright/test";

test("renders hero value, CTA, and illustrative preview", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toContainText("Say the task.");
  await expect(page.getByRole("link", { name: "Try Aksa" }).first()).toBeVisible();
  await expect(page.getByText("You stopped at Testing.", { exact: true })).toBeVisible();
  await expect(page.getByRole("figure")).toBeVisible();
});

test("switches to Indonesian hero content", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Language" }).click();
  await page.getByRole("menuitem", { name: "Indonesia" }).click();

  await expect(page.getByRole("heading", { level: 1 })).toContainText("Sampaikan tugasnya.");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Aksa menangani langkahnya.");
  await expect(page.getByText("Ruang kerja AI hands-free untuk").first()).toBeVisible();
});

test("hero layout order matches expectations", async ({ page }) => {
  await page.goto("/");
  
  // Test fallback text
  const fallback = page.locator(".typewriter-fallback");
  await expect(fallback).toHaveText("A hands-free AI workspace for documents, files, sheets, and online classes.");
  
  // Test layout order (CTA -> Preview)
  const cta = page.locator(".landing-hero__actions");
  const preview = page.locator("#product-preview");

  await expect(cta).toBeVisible();
  await expect(preview).toBeVisible();

  const ctaBox = await cta.boundingBox();
  const previewBox = await preview.boundingBox();

  expect(previewBox!.y).toBeGreaterThan(ctaBox!.y + ctaBox!.height);
});

test("keeps mobile hero within viewport and opens accessible menu", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/");

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth
  );
  expect(hasHorizontalOverflow).toBe(false);

  const menuButton = page.getByRole("button", { name: "Open navigation menu" });
  await expect(menuButton).toBeVisible();
  await menuButton.click();
  await expect(page.getByRole("dialog", { name: "Primary navigation" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Accessibility" })).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(menuButton).toHaveAttribute("aria-expanded", "false");
});

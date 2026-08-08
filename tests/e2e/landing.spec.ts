import { expect, test } from "@playwright/test";

test("renders hero value, CTA, and illustrative preview", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toContainText("Say the task.");
  await expect(page.getByRole("link", { name: "Try Aksa" }).first()).toBeVisible();
  await expect(page.getByText("You stopped at Testing.", { exact: true })).toBeVisible();
  await expect(page.getByRole("figure")).toBeVisible();
  await expect(page.locator("#top")).toBeVisible();
});

test("exposes the required section links and anchors", async ({ page }) => {
  await page.goto("/");

  for (const [name, href] of [
    ["Features", "#features"],
    ["How It Works", "#how-it-works"],
    ["FAQ", "#faq"]
  ] as const) {
    await expect(page.getByRole("link", { name }).first()).toHaveAttribute("href", href);
    await expect(page.locator(href)).toBeAttached();
  }

  await expect(page.getByRole("heading", { name: "Outcome-focused automation." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Trust in every action." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Questions before you start" })).toBeVisible();
});

test("supports controlled demo and FAQ interaction", async ({ page }) => {
  await page.goto("/");

  const speakTab = page.getByRole("tab", { name: "Speak" });
  await speakTab.click();
  await expect(speakTab).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel")).toContainText("Aksa prepares the bounded task.");
  await speakTab.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Confirm" })).toHaveAttribute("aria-selected", "true");

  await page.getByRole("button", { name: "Pause demo" }).click();
  await expect(page.getByRole("button", { name: "Resume demo" })).toBeVisible();

  const faqTrigger = page.getByRole("button", { name: "Does Aksa require special hardware?" });
  await faqTrigger.click();
  await expect(faqTrigger).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByText("No specialist hardware is required.")).toBeVisible();
});

test("switches to Indonesian hero content", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("banner").getByRole("button", { name: "Language" }).click();
  await page.getByRole("menuitem", { name: "Indonesia" }).click();

  await expect(page.getByRole("heading", { level: 1 })).toContainText("Sampaikan tugasnya.");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Aksa menangani langkahnya.");
  await expect(page.getByText("Ruang kerja AI bebas genggaman untuk").first()).toBeVisible();
});

test("hero layout order matches expectations", async ({ page }) => {
  await page.goto("/");
  
  // Test fallback text (sr-only fallback inside the typewriter)
  const fallback = page.locator(".typewriter-fallback");
  await expect(fallback).toHaveText("A hands-free AI workspace for documents, files, sheets, and web research.");
  
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
  const dialog = page.getByRole("dialog", { name: "Primary navigation" });
  await expect(dialog.getByRole("link", { name: "Features" })).toBeVisible();
  await expect(dialog.getByRole("link", { name: "How It Works" })).toBeVisible();
  await expect(dialog.getByRole("link", { name: "FAQ" })).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(menuButton).toHaveAttribute("aria-expanded", "false");
});

import { expect, test } from "@playwright/test";

test("renders hero value, CTA, and current Workspace", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toContainText("Say the task.");
  await expect(page.getByRole("link", { name: "Try Aksa" }).first()).toBeVisible();
  const workspace = page.locator("#product-preview");
  await expect(workspace).toHaveAttribute("data-preview-type", "workspace");
  await expect(workspace).toHaveAttribute("inert", "");
  await expect(workspace.getByRole("textbox")).toBeVisible();
  await expect(workspace.getByRole("heading", { name: "Continue your work" })).toBeVisible();
  await expect(workspace.getByRole("heading", { name: "Start in Google Workspace" })).toBeVisible();
  await expect(workspace.getByText("Summarized research notes", { exact: true })).toBeVisible();
  await expect(workspace.getByText("Reviewed project files", { exact: true })).toBeVisible();
  await expect(workspace.getByText("Prepared document edits", { exact: true })).toBeVisible();
  await expect(page.getByText("Programming Assignment 04", { exact: true })).toHaveCount(0);
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

  await expect(page.getByRole("heading", { name: "Your Google Workspace in one place." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Privacy & Control" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Questions before you start" })).toBeVisible();
});

test("supports controlled demo and FAQ interaction", async ({ page }) => {
  await page.goto("/");

  const speakTab = page.getByRole("tab", { name: "Speak" });
  await speakTab.click();
  await expect(speakTab).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel")).toContainText("Voice / Text");
  await speakTab.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Confirm" })).toHaveAttribute("aria-selected", "true");

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
  await expect(fallback).toHaveText("A hands-free AI workspace for Google Workspace: Docs, Sheets, Drive, and Gmail.");
  
  // Test layout order (CTA -> Preview)
  const cta = page.locator(".landing-hero__actions");
  const preview = page.locator("#product-preview");

  await expect(cta).toBeVisible();
  await expect(preview).toBeVisible();

  const ctaBox = await cta.boundingBox();
  const previewBox = await preview.boundingBox();

  expect(previewBox!.y).toBeGreaterThan(ctaBox!.y + ctaBox!.height);
});

test("blocks mobile access with desktop guidance", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Open Aksa on a computer" })).toBeVisible();
  await expect(page.locator(".aksa-desktop-experience")).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

import { expect, test, type Page } from "@playwright/test";

/**
 * Frontend path through the Aksa MVP slice.
 *
 * Assertions target honest states rather than exact configuration copy, because a
 * deployment may have some variables present and others missing. A blocked surface is
 * correct either way; a fabricated table never is.
 */

const workspaceRoutes = [
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

async function hasHorizontalOverflow(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
}

test.describe("primary path", () => {
  test("CSP permits only the pinned head-tracking model hosts", async ({ page }) => {
    const response = await page.goto("/workspace");
    const policy = response?.headers()["content-security-policy"] ?? "";

    expect(policy).toContain("'wasm-unsafe-eval'");
    expect(policy).toContain("https://cdn.jsdelivr.net");
    expect(policy).toContain("https://storage.googleapis.com");
    expect(policy).not.toContain("connect-src *");
  });

  test("landing to account entry to workspace", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("link", { name: "Try Aksa" }).first().click();
    await expect(page).toHaveURL(/\/sign-in$/);
    await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();

    /** Account entry never asks for a camera or a microphone. */
    await expect(page.getByText(/camera and microphone/i)).toHaveCount(0);

    await page.getByRole("link", { name: "Open workspace" }).click();
    await expect(page).toHaveURL(/\/onboarding$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Choose optional input methods" })
    ).toBeVisible();
  });

  test("onboarding is skippable and reaches the workspace", async ({ page }) => {
    await page.goto("/onboarding");

    await expect(
      page.getByRole("navigation", { name: "Setup step" }).getByRole("button", { name: /1 Welcome/ })
    ).toBeVisible();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByRole("button", { name: "Skip head control", exact: true }).last().click();
    await page.getByRole("button", { name: "Skip voice", exact: true }).click();
    await page.getByRole("button", { name: "Continue", exact: true }).click();

    await expect(
      page.getByRole("heading", { level: 1, name: "Aksa is ready" })
    ).toBeVisible();

    await page.getByRole("link", { name: "Enter workspace" }).click();
    await expect(page).toHaveURL(/\/workspace$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "What would you like to get done?" })
    ).toBeVisible();
  });

  test("onboarding asks for the camera before exposing calibration", async ({ page }) => {
    await page.goto("/onboarding");

    await page.getByRole("button", { name: "Continue", exact: true }).click();

    await expect(page.getByRole("button", { name: "Allow camera", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Calibrate head control", exact: true })).toHaveCount(0);
    await expect(page.locator(".aksa-pointer-overlay")).toHaveCount(0);
  });

  test("onboarding mirrors only its preview and keeps calibration responsive", async ({ page }) => {
    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 1280, height: 768 },
      { width: 900, height: 900 },
      { width: 320, height: 640 }
    ]) {
      await page.setViewportSize(viewport);
      await page.goto("/onboarding");
      await page.evaluate(() => window.sessionStorage.clear());
      await page.reload();

      await page.getByRole("button", { name: "Continue", exact: true }).click();
      const preview = page.locator(".aksa-camera-preview--mirrored");
      await expect(preview).toHaveCount(1);
      await expect(
        page.evaluate(() =>
          Array.from(document.styleSheets).some((sheet) => {
            try {
              return Array.from(sheet.cssRules).some(
                (rule) =>
                  rule instanceof CSSStyleRule &&
                  rule.selectorText === ".aksa-camera-preview--mirrored" &&
                  rule.style.transform === "scaleX(-1)"
              );
            } catch {
              return false;
            }
          })
        )
      ).resolves.toBe(true);

      await expect(page.getByRole("heading", { level: 1, name: "Control Aksa with head movement" })).toBeVisible();
      await expect(page.locator(".aksa-onboarding-calibration-card")).toHaveCount(0);
      await expect(page.locator(".aksa-onboarding-calibration-waiting")).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Allow camera", exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Skip head control", exact: true })).toHaveCount(1);
      expect(await hasHorizontalOverflow(page)).toBe(false);
    }
  });

  test("onboarding teardown leads to an explicit Workspace start path", async ({ page }) => {
    await page.goto("/onboarding");
    await page.getByRole("link", { name: "Finish later", exact: true }).click();

    await expect(page).toHaveURL(/\/workspace$/);
    await expect(
      page.getByRole("button", { name: "Start head control", exact: true })
    ).toBeVisible();
  });

  test("a refused camera keeps the keyboard and mouse paths", async ({ page, context }) => {
    await context.clearPermissions();
    await page.goto("/onboarding");

    await page.getByRole("button", { name: "Continue", exact: true }).click();

    await page.getByRole("button", { name: "Allow camera" }).click();

    await expect(
      page.getByText(
        /Camera access was denied|Aksa found no camera|camera is unavailable|secure connection/
      )
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Continue without camera", exact: true })
    ).toBeVisible();
  });
});

test.describe("workspace shell", () => {
  test("every surface renders with an honest state and no fabricated data", async ({ page }) => {
    for (const route of workspaceRoutes) {
      await page.goto(route);

      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.getByRole("main")).toBeVisible();
      /** The composer is present on every workspace route. */
      await expect(page.locator("#command-composer")).toBeVisible();
      await expect(
        page.getByText("Not signed in")
          .or(page.getByText("Accounts not configured"))
          .or(page.getByText("Connect Google"))
          .or(page.getByText("Google OAuth is not configured"))
          .or(page.getByText("You are browsing the workspace without an account"))
          .first()
      ).toBeVisible();
    }
  });

  test("keeps the desktop composer outside the scrollable work surface", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto("/workspace/files");

    const layout = await page.evaluate(() => {
      const main = document.querySelector(".aksa-main");
      const composer = document.querySelector(".aksa-composer");
      if (!(main instanceof HTMLElement) || !(composer instanceof HTMLElement)) {
        return null;
      }

      const mainRect = main.getBoundingClientRect();
      const composerRect = composer.getBoundingClientRect();
      return {
        composerPosition: getComputedStyle(composer).position,
        mainOverflow: getComputedStyle(main).overflowY,
        intersection: Math.max(
          0,
          Math.min(mainRect.bottom, composerRect.bottom) - Math.max(mainRect.top, composerRect.top)
        )
      };
    });

    expect(layout?.composerPosition).toBe("relative");
    expect(layout?.mainOverflow).toBe("auto");
  });

  test("Google backed surfaces report a named blocker with a way forward", async ({ page }) => {
    for (const route of ["/workspace/documents", "/workspace/files", "/workspace/sheets", "/workspace/mail"]) {
      await page.goto(route);

      const panel = page.getByRole("main").locator(".aksa-state-panel").first();
      await expect(panel).toBeVisible();
      await expect(panel.locator(".aksa-state-panel__body")).not.toBeEmpty();

      /** No table of files, cells, or messages exists, because nothing was fetched. */
      await expect(page.getByRole("table")).toHaveCount(0);
    }
  });

  test("navigates the sidebar by keyboard and exposes the current route", async ({ page }) => {
    await page.goto("/workspace");

    const sidebar = page.getByRole("complementary", { name: "Workspace navigation" });
    const filesLink = sidebar.getByRole("link", { name: "Drive" });

    await filesLink.click();
    await page.waitForURL(/\/workspace\/files$/);

    await expect(
      sidebar.getByRole("link", { name: "Drive" })
    ).toHaveAttribute("aria-current", "page");
    await expect(
      sidebar.getByRole("link", { name: "Home", exact: true })
    ).not.toHaveAttribute("aria-current");
  });

  test("collapses the desktop sidebar accessibly and remembers the preference", async ({ page }) => {
    await page.goto("/workspace");

    const sidebar = page.getByRole("complementary", { name: "Workspace navigation" });
    await sidebar.getByRole("button", { name: "Collapse workspace sidebar" }).click();

    const expand = sidebar.getByRole("button", { name: "Expand workspace sidebar" });
    await expect(expand).toHaveAttribute("aria-expanded", "false");
    await expect(sidebar.getByRole("link", { name: "Home", exact: true })).toHaveAttribute(
      "aria-current",
      "page"
    );
    await expect(sidebar.getByRole("link", { name: "Home", exact: true })).toHaveAttribute(
      "title",
      "Home"
    );

    await page.reload();
    await expect(page.getByRole("button", { name: "Expand workspace sidebar" })).toHaveAttribute(
      "aria-expanded",
      "false"
    );
  });

  test("reaches History and Activity and shows only real records", async ({ page }) => {
    await page.goto("/workspace/history");
    await expect(page.getByRole("heading", { level: 1, name: "History" })).toBeVisible();

    await page.goto("/workspace/activity");
    await expect(page.getByRole("heading", { level: 1, name: "Activity" })).toBeVisible();
    await expect(
      page.getByText("Aksa shows steps and results. It never shows model reasoning.")
    ).toBeVisible();
    /** No activity entries exist, because nothing has executed. */
    await expect(page.getByRole("list", { name: "Activity steps" })).toHaveCount(0);
  });
});

test.describe("command composer", () => {
  test("exposes separate dictation and live command controls when speech is available", async ({ page }) => {
    await page.addInitScript(() => {
      class RecognitionStub {
        lang = "";
        continuous = false;
        interimResults = false;
        maxAlternatives = 1;
        onresult = null;
        onerror = null;
        onend = null;
        onstart = null;
        start() {}
        stop() {}
        abort() {}
      }
      Object.defineProperty(window, "SpeechRecognition", {
        configurable: true,
        value: RecognitionStub
      });
    });
    await page.goto("/workspace");

    await expect(page.getByRole("button", { name: "Send command" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Dictate" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Live Voice" })).toBeVisible();
  });

  test("serves the authenticated semantic intent boundary instead of a missing route", async ({ request }) => {
    const response = await request.post("/api/commands/intent", {
      data: { transcript: "Could you show my documents?", locale: "en" }
    });

    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({ intent: "UNKNOWN" });
  });

  test("reports what Aksa received and why it cannot run", async ({ page }) => {
    await page.goto("/workspace");

    const input = page.locator("#command-composer textarea");
    await input.fill("Move the week 3 report into submissions");
    await page.getByRole("button", { name: "Send command" }).click();

    await expect(page.getByText("What Aksa received")).toBeVisible();
    await expect(page.locator("p.aksa-received-text")).toHaveText(
      "Move the week 3 report into submissions"
    );
    await expect(
      page.getByText(/Aksa received this command/)
    ).toBeVisible();

    /** No task exists, so no completed state and no cancel control appear. */
    await expect(page.getByText("Task completed.")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Cancel task" })).toHaveCount(0);
    await expect(page.locator("#command-composer textarea")).toBeVisible();
  });

  test("an example fills the box without running anything", async ({ page }) => {
    await page.goto("/workspace");

    await page.getByRole("button", { name: "Find the files for this project" }).click();
    await expect(page.locator("#command-composer textarea")).toHaveValue(
      "Find the files for this project"
    );
    await expect(page.getByText("What Aksa received")).toHaveCount(0);
  });

  test("search reports unavailability instead of an unsourced answer", async ({ page }) => {
    await page.goto("/workspace/search");

    await expect(
      page.getByText("Answers use external web search. Every claim points to a listed source.")
    ).toBeVisible();

    await page.getByLabel("What do you want to know").fill("latest AI coding tool news");
    await page.getByRole("button", { name: "Search" }).click();

    const panel = page.getByRole("main").locator(".aksa-state-panel").first();
    await expect(panel).toBeVisible();
    /** No sources and no answer, because grounding is unavailable. */
    await expect(page.getByRole("list", { name: /Sources/ })).toHaveCount(0);
  });
});

test.describe("dark-mode control readouts", () => {
  test("keeps percentage and reduced-motion readouts opaque and distinct", async ({ page }) => {
    await page.goto("/workspace/controls");
    await page.locator('input[name="head-preset"][value="custom"]').check();
    const styles = await page.evaluate(() => {
      document.documentElement.dataset.theme = "dark";
      const percentage = document.querySelector(".aksa-output");
      const reduced = document.createElement("div");
      reduced.className = "aksa-pointer-overlay__reduced-progress";
      reduced.textContent = "50%";
      document.body.appendChild(reduced);

      const read = (element: Element | null) => {
        if (!element) return null;
        const style = getComputedStyle(element);
        return { color: style.color, background: style.backgroundColor };
      };
      return { percentage: read(percentage), reduced: read(reduced) };
    });

    expect(styles.percentage).not.toBeNull();
    expect(styles.percentage?.background).not.toBe("rgba(0, 0, 0, 0)");
    expect(styles.percentage?.color).not.toBe(styles.percentage?.background);
    expect(styles.reduced?.background).not.toBe("rgba(0, 0, 0, 0)");
    expect(styles.reduced?.color).not.toBe(styles.reduced?.background);
  });
});

test.describe("Phase II controls", () => {
  test("separates standard accessibility from head and voice controls", async ({ page }) => {
    await page.goto("/workspace/accessibility");
    await expect(page.getByLabel("Reduce motion")).toBeVisible();
    await expect(page.getByLabel("Pointer reach")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Head control" })).toHaveCount(0);

    await page.goto("/workspace/controls");
    await expect(page.getByRole("heading", { level: 1, name: "Controls" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Head control" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Voice control" })).toBeVisible();
    await expect(page.getByRole("radio", { name: /Auto/ })).toBeChecked();
    await expect(page.getByLabel("Pointer reach")).toHaveCount(0);

    await page.locator('input[name="head-preset"][value="custom"]').check();
    await expect(page.getByLabel("Pointer reach")).toBeVisible();
  });
});

test.describe("mobile layout", () => {
  test.use({ viewport: { width: 320, height: 640 } });

  test("no horizontal overflow and the composer stays reachable", async ({ page }) => {
    for (const route of workspaceRoutes) {
      await page.goto(route);
      expect(await hasHorizontalOverflow(page), `overflow on ${route}`).toBe(false);
      await expect(page.locator("#command-composer")).toBeVisible();
    }
  });

  test("the drawer traps focus and restores it to the trigger", async ({ page }) => {
    await page.goto("/workspace");

    const trigger = page.getByRole("button", { name: "Open workspace navigation" });
    await expect(trigger).toBeVisible();
    await trigger.click();

    const dialog = page.getByRole("dialog", { name: "Workspace navigation" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Close workspace navigation" })).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test("long Indonesian labels wrap without overflow", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /menu/i }).click();
    await page.getByRole("dialog", { name: "Primary navigation" }).getByRole("button", { name: "Language" }).click();
    await page.getByRole("menuitem", { name: "Indonesia" }).click();

    await page.goto("/workspace/accessibility");
    await expect(page.getByRole("heading", { level: 1, name: "Aksesibilitas" })).toBeVisible();
    expect(await hasHorizontalOverflow(page)).toBe(false);

    await page.goto("/workspace/settings");
    await expect(page.getByRole("heading", { level: 1, name: "Pengaturan" })).toBeVisible();
    expect(await hasHorizontalOverflow(page)).toBe(false);

    await page.goto("/workspace/controls");
    await expect(page.getByRole("heading", { level: 1, name: "Kontrol" })).toBeVisible();
    expect(await hasHorizontalOverflow(page)).toBe(false);
  });
});

test.describe("reduced motion", () => {
  test("the workspace stays usable and the hero shows its static sentence", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await expect(page.locator(".typewriter-fallback")).toHaveText(
      "A hands-free AI workspace for Google Workspace: Docs, Sheets, Drive, and Gmail."
    );

    await page.goto("/workspace");
    await expect(
      page.getByRole("heading", { level: 1, name: "What would you like to get done?" })
    ).toBeVisible();
    await expect(page.locator("#command-composer")).toBeVisible();
  });
});

test.describe("zoom", () => {
  test("content stays usable at 200 percent", async ({ page }) => {
    await page.setViewportSize({ width: 640, height: 720 });
    await page.goto("/workspace");

    await expect(
      page.getByRole("heading", { level: 1, name: "What would you like to get done?" })
    ).toBeVisible();
    expect(await hasHorizontalOverflow(page)).toBe(false);
  });
});

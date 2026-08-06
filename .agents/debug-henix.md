# Debug History

This file records verified development issues and fixes.

Do not record speculation.
Do not record routine progress.
Do not include secrets, tokens, personal data, or hidden model reasoning.

Scope: frontend, UI, UX, user flows, accessibility interactions, responsive behavior, interface copy, and frontend tests. Owner: Henix.

Backend, API, database, authentication internals, agent execution, and integration issues belong in `.agents/debug-zaltech.md`.

## Entry Template

## YYYY-MM-DD HH:mm - Short issue title

- Status:
- Owner:
- Area:
- Symptoms:
- Reproduction:
- Expected:
- Actual:
- Root cause:
- Fix:
- Files changed:
- Verification:
- Prevention:
- Commit or PR:

## Rules

- Append only issues that were actually observed and reproduced.
- Verify the root cause before writing it. If the cause is unknown, say `Root cause: not yet identified` and keep the entry open.
- Mark a fix as `workaround` or `permanent`. A workaround stays open until replaced.
- Close an entry only after the verification step passes on a real run.
- Link a duplicate to the original entry instead of writing a second investigation.
- Redact file paths, values, or copy that would expose personal data.
- Newest entries go at the bottom.

## Field Guidance

| Field | Expected content |
| --- | --- |
| Status | `open`, `workaround`, `fixed`, or `duplicate of <date and title>` |
| Owner | The person who verified the fix |
| Area | For example landing page, onboarding, head control, dwell, command bar, workspace shell, artifact view, history, localization |
| Symptoms | What a user sees or experiences |
| Reproduction | Exact steps, browser, viewport, input mode, and locale |
| Expected | The behavior required by `.agents/design.md` or the relevant feature document |
| Actual | The observed behavior |
| Root cause | The verified mechanism, not a guess |
| Fix | What changed and whether it is a workaround or permanent |
| Files changed | Relative repository paths |
| Verification | The command or manual pass that proved the fix, including browser and assistive technology used |
| Prevention | The test, token, lint rule, or documentation change that stops a recurrence |
| Commit or PR | Reference once it exists |

## Entries

## 2026-08-06 12:47 - Light-theme semantic token contrast regression

- Status: fixed
- Owner: Henix
- Area: design system and accessibility
- Symptoms: The targeted axe audit reported serious color-contrast violations across authentication, session-expired, and workspace surfaces.
- Reproduction: Run `bun run test:e2e -- tests/e2e/a11y.spec.ts` with the Playwright default browser and light theme.
- Expected: No automatically detectable WCAG 2 AA violations.
- Actual: `--color-aksa-teal-deep` rendered as `#25a894` on `#f8fafc` at a 2.82 ratio, and `--color-aksa-faint` rendered as `#94a3b8` at a 2.45 ratio.
- Root cause: The default semantic token fallbacks were lighter than the contrast requirement, even though the explicit light-theme overrides were darker.
- Fix: Set the default deep teal to `#0e7c6b` and faint text to `#657080`, and aligned the design token documentation. Permanent fix.
- Files changed: `.agents/design.md`, `src/app/globals.css`
- Verification: `bun run test:e2e -- tests/e2e/a11y.spec.ts` passed all 18 tests; targeted landing E2E passed all 4 tests.
- Prevention: Keep axe audits in the E2E gate and define accessible defaults before theme-specific overrides.
- Commit or PR: None.

## 2026-08-06 13:54 - Button labels and workspace composer overlap

- Status: fixed
- Owner: Henix
- Area: shared controls, command bar, workspace shell, responsive layout
- Symptoms: Icon labels in shared buttons stacked vertically, the workspace composer covered main content, and disabled button labels were too faint.
- Reproduction: Open `/`, `/sign-in`, and `/workspace` at 1366 by 768, then `/workspace` at 320 by 640. Inspect the rendered controls and scroll boundary.
- Expected: Button icons and labels share one readable row, the composer occupies its own reachable region, and disabled labels remain legible.
- Actual: Shared `Button` content sat inside a plain wrapper span, sticky positioning moved the composer over the main surface, and global opacity reduced disabled text contrast.
- Root cause: The wrapper did not own an inline flex layout, the desktop column had no bounded grid row for the composer, and disabled states relied on blanket opacity.
- Fix: Added `.aksa-button__content` inline flex styling, made the desktop column a bounded three-row grid with an internal main scroll region, kept mobile content in document flow, and added readable variant-specific disabled colors. Permanent fix.
- Files changed: `src/components/shared/button.tsx`, `src/app/workspace.css`, `tests/unit/shared-ui.test.tsx`, `tests/e2e/workspace.spec.ts`
- Verification: Browser screenshots were inspected at 1366 by 768 and 320 by 640; 152 unit tests, 42 targeted E2E tests, axe audits, lint, typecheck, and production build passed.
- Prevention: Shared-control tests assert the content wrapper, and the workspace E2E test asserts zero main-composer intersection.
- Commit or PR: None.

## 2026-08-06 14:31 - Landing navigation and section anchors incomplete

- Status: fixed
- Owner: Henix
- Area: landing page information architecture and navigation
- Symptoms: The primary navigation showed Product, Safety, and Accessibility, all pointed to the product preview, and the required Features, How It Works, Accessibility, and FAQ sections were absent.
- Reproduction: Open `/` at the default desktop viewport, inspect the primary navigation links, then query `#features`, `#how-it-works`, `#accessibility`, and `#faq`.
- Expected: Three primary links point to real Features, How It Works, and FAQ sections, with the exact landing anchors present.
- Actual: Four links pointed to `#product-preview`; the required section IDs did not exist.
- Root cause: `LandingPage` rendered only the hero and preview, while `MarketingHeader` retained placeholder links from the earlier draft.
- Fix: Added the localized feature, controlled demo, accessibility, FAQ, final CTA, and footer sections, then mapped the header and footer to real anchors. Permanent fix.
- Files changed: `src/components/landing/landing-page.tsx`, `src/components/landing/landing-navigation.tsx`, `src/components/landing/feature-grid.tsx`, `src/components/landing/how-it-works-demo.tsx`, `src/components/landing/accessibility-highlight.tsx`, `src/components/landing/faq-section.tsx`, `src/components/landing/final-cta.tsx`, `src/components/landing/marketing-footer.tsx`, `messages/en.json`, `messages/id.json`
- Verification: Landing unit tests, full Playwright E2E, axe audits, typecheck, lint, build, and anchor interaction checks passed.
- Prevention: Landing unit and E2E tests assert the exact anchors and primary link destinations.
- Commit or PR: None.

## 2026-08-06 14:31 - Mobile accessibility launcher obscured preview copy

- Status: fixed
- Owner: Henix
- Area: landing page responsive accessibility interaction
- Symptoms: At 320 x 640, the full accessibility launcher overlapped the illustrative preview heading while the hero was visible.
- Reproduction: Open `/` at 320 x 640 in the light theme and inspect the fixed accessibility control against the preview header.
- Expected: The launcher remains reachable without covering meaningful preview copy.
- Actual: The left-aligned labeled launcher covered the preview heading area.
- Root cause: The desktop launcher placement and label width were reused unchanged at the narrow mobile viewport.
- Fix: On mobile, moved the launcher to the lower right, retained a 44 px icon target, hid only the redundant visible label, and right-aligned its menu. Permanent fix.
- Files changed: `src/app/globals.css`
- Verification: Mobile browser inspection and all four localized/theme screenshot sets reported no horizontal overflow or console errors.
- Prevention: Keep the 320 x 640 screenshot pass in the landing responsive gate.
- Commit or PR: None.

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

## 2026-08-07 21:12 - Head-control startup could report success while leaking camera ownership

- Status: fixed
- Owner: Henix
- Area: onboarding, Workspace header, MediaPipe startup, CSP
- Symptoms: Onboarding could report camera success when the tracking model failed, failed startup paths could leave tracks or hidden video alive, cancelling a pending permission request could start the camera later, and the pointer appeared while startup was incomplete.
- Reproduction: Run the model-failure and late-permission regression tests, then start Workspace head control in a browser without resolving the permission request. Before the fix, the startup state had no cancellation action and rendered the Aksa pointer. Inspecting the production CSP also showed that both pinned MediaPipe download hosts were blocked.
- Expected: Operational status appears only after camera and model startup succeeds; cancellation, failure, replacement, unmount, and stream end release every owned resource; incomplete startup never shows an operational pointer.
- Actual: Onboarding unconditionally advanced to success, startup cleanup was incomplete, late permission resolution ignored navigation or cancellation, previous streams survived replacement, and `connect-src 'self'` blocked the model runtime.
- Root cause: Boolean startup results were ignored, camera acquisition and engine ownership lacked a single cancellation and teardown boundary, the pointer accepted `initializing`, and CSP omitted the pinned MediaPipe hosts and WebAssembly execution directive.
- Fix: Made startup results authoritative, centralized stream, video, loop, listener, and model cleanup, added cancellable startup ownership, stopped late streams, hid the pointer until active tracking, allowed only the pinned model hosts, and added GPU-to-CPU initialization fallback. Permanent fix.
- Files changed: `src/components/onboarding/onboarding-flow.tsx`, `src/components/workspace/aksa-pointer.tsx`, `src/components/workspace/workspace-header.tsx`, `src/lib/client/vision/head-control-context.tsx`, `src/lib/client/vision/vision-engine.ts`, `src/proxy.ts`, `messages/en.json`, `messages/id.json`
- Verification: `bun run i18n:compile`, `bun run typecheck`, `bun run lint`, `bun run test` with 210 passing tests, `bun run build`, six focused primary-path Playwright tests, and two focused axe audits passed. Browser inspection also verified startup cancellation returns to Start head control with zero video and pointer elements.
- Prevention: Regression tests cover model failure, video attachment failure, late permission cancellation, stream replacement, stream end, inference failure, provider unmount, CSP allowlisting, and the non-operational pointer state.
- Commit or PR: `ae4cb42`, `169eb32`.

## 2026-08-07 21:12 - Held signals could cross confirmation and tracking boundaries

- Status: fixed
- Owner: Henix
- Area: gesture selection, dwell, confirmation, tracking recovery, calibration
- Symptoms: A held gesture could be reset when a confirmation appeared and then be processed again without physical release. Dwell could begin processing immediately after the modal boundary. Tracking recovery and restart could reuse stale target, smoothing, calibration, or gesture state.
- Reproduction: Feed a high mouth-open score that activates a confirmation trigger, keep the score high while the confirmation target replaces it, and process later frames. Also build partial dwell or calibration progress, then open a dialog or lose tracking. Before the fix, reset alone re-armed the held gesture and the recovery boundary admitted interaction too early.
- Expected: The signal that opens a consequential confirmation cannot approve it. Gesture requires a below-threshold release and a later fresh signal. Dwell requires a complete new stabilization and dwell cycle. Loss and recovery cannot activate on the reacquisition frame.
- Actual: Reset restored gesture readiness immediately, dwell had no explicit fresh-cycle state, calibration accepted pre-stability frames, and restart did not reset its reacquisition counter.
- Root cause: Controllers exposed reset and cancel operations but no security boundary semantics. The coordinator continued interaction processing without carrying an explicit disarmed state across frames.
- Fix: Added gesture disarm-until-release and dwell fresh-cycle APIs, consumed off-target held gestures, cleared interactions and partial calibration at every boundary, required five stable face frames plus a later interaction frame, reset smoothing on reacquisition, suppressed selection during calibration, and exposed route-local Workspace calibration. Permanent fix.
- Files changed: `src/lib/client/vision/gesture-detector.ts`, `src/lib/client/vision/dwell-controller.ts`, `src/lib/client/vision/head-control-context.tsx`, `src/components/workspace/workspace-header.tsx`, `src/components/onboarding/onboarding-flow.tsx`
- Verification: Deterministic coordinator tests prove held confirmation gestures cannot approve, release plus a fresh gesture can approve, dwell momentum is discarded, loss and restart cannot activate, live settings affect the installed callback, and calibration uses only real post-reacquisition frames. All requested static, unit, build, and focused browser gates passed.
- Prevention: Keep confirmation, calibration, loss, restart, and pause boundary tests coupled to physical release and fresh-cycle requirements.
- Commit or PR: `169eb32`.

## 2026-08-07 21:12 - Accessibility cache could retain another user's profile during scope changes

- Status: fixed
- Owner: Henix
- Area: accessibility profile initialization and IndexedDB cache
- Symptoms: Changing the authenticated user in a mounted provider could temporarily retain the previous profile or apply its late cache result. Empty user identifiers were tolerated by cache reads and clears.
- Reproduction: Cache a high-sensitivity profile for User A, mount the provider for User A, switch it to User B with an empty cache, and allow User A's read to resolve late.
- Expected: The server profile is authoritative when present. Without it, each authenticated user sees only that user's cache or defaults. No anonymous default bucket exists.
- Actual: Profile state was not keyed to user scope, an older asynchronous cache read could still set state, and some empty-identifier operations silently returned.
- Root cause: Cached profile loading had no scope identity or cancellation guard, while runtime validation was inconsistent across cache functions.
- Fix: Keyed profile state to user and server-source scope, cancelled stale reads, reset immediately on scope changes, kept server data authoritative, and rejected empty identifiers for every cache operation. Permanent fix.
- Files changed: `src/lib/client/vision/head-control-context.tsx`, `src/lib/client/vision/profile-cache.ts`
- Verification: Tests prove User A, User B, and empty state isolation, stale-result rejection, and server-profile authority over stale browser cache. The complete 210-test suite passed.
- Prevention: Cache APIs require an explicit user ID at compile time and runtime, and provider tests exercise cross-account rerenders.
- Commit or PR: `169eb32`.

## 2026-08-08 13:18 - Workspace recalibration and command controls were disconnected

- Status: fixed
- Owner: Henix
- Area: Workspace head control, sidebar navigation, deterministic voice actions
- Symptoms: Workspace recalibration only exposed the active-state trigger, had no focused guided experience, and could leave interaction state active at the boundary. Sidebar navigation had no desktop collapse state, and core voice commands had no local allowlisted execution path.
- Reproduction: Start or inspect Workspace head control, invoke recalibration from the header, then exercise navigation and voice command controls with the semantic provider unavailable.
- Expected: Dashboard recalibration reuses the active runtime for Center, Left, Right, Up, Down, and Return center; sidebar state is accessible and persistent; basic commands execute locally.
- Actual: Recalibration had no dashboard-owned guided overlay, sidebar labels could not collapse, and command execution depended on the server command path.
- Root cause: Runtime calibration and UI orchestration were not exposed through one focused Workspace action boundary; navigation and command handling lacked canonical local intents.
- Fix: Added the shared guided calibration overlay and stream handoff, preserved applied ranges on failed or cancelled attempts, suppressed pointer interaction during calibration, added the persistent accessible sidebar rail, and routed EN/ID commands through canonical intents and one dispatcher before optional semantic fallback.
- Files changed: `messages/en.json`, `messages/id.json`, `src/app/workspace.css`, `src/components/workspace/aksa-action-context.tsx`, `src/components/workspace/calibration-experience.tsx`, `src/components/workspace/command-composer.tsx`, `src/components/workspace/workspace-header.tsx`, `src/components/workspace/workspace-shell.tsx`, `src/components/workspace/workspace-sidebar.tsx`, `src/lib/client/actions/aksa-action-dispatcher.ts`, `src/lib/client/state/composer-machine.ts`, `src/lib/client/vision/head-control-context.tsx`, `src/lib/contracts/voice-intent.ts`, `src/lib/voice/intent-router.ts`, focused tests.
- Verification: Localization compile, typecheck, lint, 338 unit tests, production build, 21/21 Workspace E2E tests, focused calibration Playwright coverage, and focused no-reacquisition runtime coverage passed.
- Prevention: Keep runtime calibration, active-stream reuse, pointer lockout, canonical intent routing, and sidebar accessibility assertions in the focused gates.
- Commit or PR: `7ba7b7e`.

## 2026-08-08 14:44 - Startup neutral reused an invalid pointer origin

- Status: fixed
- Owner: Henix
- Area: head-control startup, idle stability, tracking recovery
- Symptoms: A stationary user could see the pointer move away from center after camera startup or tracking recovery. Duplicate or older frames could still reach pointer processing.
- Reproduction: Start the coordinator with a stable raw pose away from zero, then send the first interaction frame using the engine delta from the old zero baseline. Repeat a processed timestamp with a large pose delta.
- Expected: Stable startup and recovery establish the user's current pose as neutral. Idle frames stay centered, stale frames do nothing, and deliberate sustained movement releases Rest Lock.
- Actual: Reacquisition counted faces but retained the engine's zero or previous neutral baseline. The first post-recovery frame mapped that offset into screen motion, and the coordinator did not reject non-increasing timestamps.
- Root cause: Reacquisition tracked only a face-frame count, not a stable raw-pose window, and frame timing accepted duplicate or stale timestamps.
- Fix: Added bounded stable-pose reacquisition, applied its average as the engine and UI neutral baseline, centered and disarmed interaction at the boundary, and rejected invalid, duplicate, or stale frame timestamps. Permanent fix.
- Files changed: `src/lib/client/vision/head-control-context.tsx`, `src/lib/client/vision/tracking-stability.ts`
- Verification: Coordinator and tracking tests prove centered idle startup, stale-frame rejection, isolated-spike reset, Rest Lock acquisition, deliberate release, centered recovery, and fresh gesture requirements. Localization, typecheck, lint, 357 unit tests, production build, and 24 Workspace Playwright tests passed.
- Prevention: Keep the startup, tracking-loss, stale-frame, stationary-idle, and deliberate-movement regressions in the focused head-control suite.
- Commit or PR: `45946e2`.

## 2026-08-08 14:44 - Voice modes, locale refresh, and runtime feedback crossed boundaries

- Status: fixed
- Owner: Henix
- Area: command composer, locale switching, accessibility contrast, browser console
- Symptoms: Final speech callbacks could execute more than once, dictation and command execution shared one button, changing locale reloaded and stopped mounted controls, dark readouts were hard to read, and MediaPipe placed an informational XNNPACK notice in the error console.
- Reproduction: Deliver one final recognition result twice, use the old Speak control for dictation, switch language while head control is active, inspect dark percentage output, then start MediaPipe and inspect browser errors.
- Expected: Dictation remains editable, Live Voice executes one final command once, locale refresh preserves camera state, readouts remain opaque and legible, and informational startup output is not reported as an application error.
- Actual: Any final result triggered execution, repeated callbacks were not guarded, `window.location.reload()` remounted the runtime, transparent readouts inherited dark text, and the XNNPACK information line appeared at error level.
- Root cause: Speech modes had no explicit boundary or final-result idempotency guard, locale switching used a document reload, readouts lacked semantic surfaces, and MediaPipe routes one known startup notice through stderr.
- Fix: Split Send, Dictate, and Live Voice; considered recognition alternatives deterministically; executed final commands once; replaced reload with `router.refresh()`; added opaque semantic readouts; and rerouted only the exact XNNPACK notice to information while preserving all other errors. Permanent fix.
- Files changed: `messages/en.json`, `messages/id.json`, `src/app/workspace.css`, `src/components/shared/locale-switcher.tsx`, `src/components/workspace/command-composer.tsx`, `src/lib/client/voice/speech-recognition.ts`, `src/lib/client/vision/mediapipe-console.ts`, `src/lib/voice/intent-router.ts`
- Verification: Localization, typecheck, lint, 357 unit tests, production build, and 24 Workspace Playwright tests passed. Dark-mode browser inspection showed readable readouts, locale changed to Indonesian while `Face tracking lost` remained mounted, and the final browser error list was empty.
- Prevention: Unit coverage asserts interim suppression, recognition alternatives, duplicate final idempotency, dictation non-execution, next-recognition locale, refresh continuity, and exact console-level routing.
- Commit or PR: `45946e2`, `c188994`.

## 2026-08-08 19:40 - Rest Lock accumulated idle noise and recovery moved the pointer

- Status: fixed
- Owner: Henix
- Area: head-control idle stability, target assistance, tracking recovery
- Symptoms: A stationary user could still see gradual pointer movement. A tracking interruption could restore the pointer from viewport center instead of its last rendered position, and one noisy target-assist frame could drop the active target.
- Reproduction: Feed small accepted pose deltas while Rest Lock is active, interrupt and recover tracking after moving away from viewport center, then inject one escape spike while a target is assisted.
- Expected: Rest freezes the rendered pointer, recovery resumes from its last visible position, and isolated target noise pauses selection without moving the visual target.
- Actual: The internal pointer position continued following mapped noise, recovery rebuilt movement from viewport center, and target assist released immediately.
- Root cause: Rest Lock had no explicit physical-motion state boundary, the coordinator retained the mapped target instead of the frozen rendered output, recovery had no preserved pointer origin, and target release had no sustained-frame requirement.
- Fix: Added `MOVING`, `REST_CANDIDATE`, and `RESTING` states with physical-motion hysteresis; kept internal and rendered pointer positions synchronized; preserved the last rendered recovery origin; added a calibrated neutral envelope and safe range floor; required sustained target escape while suppressing dwell and gestures during isolated spikes. Permanent fix.
- Files changed: `src/lib/client/vision/head-control-context.tsx`, `src/lib/client/vision/pointer-mapping.ts`, `src/lib/client/vision/rest-lock.ts`, `src/lib/client/vision/target-assist.ts`, focused tests.
- Verification: Lint, typecheck, 370 unit tests, 45 focused Playwright tests, and the production build passed. Browser checks covered desktop, mobile, EN/ID continuity, Controls, onboarding, sidebar collapse, composer placement, and automated accessibility. Physical head movement was not verifiable because no live face input was available.
- Prevention: Keep stationary-noise, physical-release hysteresis, recovery-origin, isolated-spike, and fresh-selection regressions in the focused coordinator suite.
- Commit or PR: `d074d18`.

## 2026-08-10 00:08 - Floating accessibility control was removed from every surface

- Status: fixed
- Owner: Henix
- Area: global accessibility controls and application layout
- Symptoms: The floating Accessibility button was absent from the landing, authentication, onboarding, and Workspace surfaces although its component and styles still existed.
- Reproduction: Open any application route and inspect the bottom viewport edge or accessibility tree.
- Expected: One fixed Accessibility button remains available across every route.
- Actual: No route mounted `AccessibilityWidget`, so the control could not render.
- Root cause: Commit `62cf484` removed every route-specific widget mount during unrelated product-state cleanup.
- Fix: Mounted `AccessibilityWidget` once inside the root preference and head-control providers. Permanent fix.
- Files changed: `src/app/layout.tsx`, `tests/unit/accessibility-widget.test.tsx`
- Verification: Focused unit tests passed 2/2. Typecheck and lint passed. Browser inspection confirmed the visible fixed button and its accessible name on the landing page.
- Prevention: Root-layout regression coverage requires the global widget mount.
- Commit or PR: `2d3085f`.

## 2026-08-10 00:32 - Authentication and landing layouts drifted from approved composition

- Status: fixed
- Owner: Henix
- Area: responsive landing layout and authentication interface
- Symptoms: Landing navigation and preview content were too narrow, headline fragments stacked unnaturally, the account-switch link was left-aligned, and Google sign-in displayed an unavailable state.
- Reproduction: Open the landing page and sign-in page at the desktop and compact widths shown in the supplied screenshots.
- Expected: Navigation remains centered independently of edge utilities, hero text wraps naturally, the preview uses the available width, account switching is centered, and the official Google control is usable.
- Actual: Width constraints shifted navigation and preview content inward, separate headline spans could stack, and the sign-in surface did not expose a working provider control.
- Root cause: Shared width tokens were too restrictive, navigation centering depended on neighboring content, headline spans suppressed natural whitespace, and the provider control remained gated by server-secret configuration.
- Fix: Expanded responsive containers, centered navigation independently, restored natural headline spacing, centered account switching, rendered the official Google Identity Services button, and preserved explicit failure states. Permanent fix.
- Files changed: `src/app/globals.css`, `src/app/workspace.css`, `src/components/landing/landing-navigation.tsx`, `src/components/landing/landing-page.tsx`, `src/components/auth/auth-form.tsx`, `src/components/auth/google-sign-in-button.tsx`
- Verification: Browser review covered 1544x901 and 1063x512 landing layouts plus 1187x969 authentication. The Google chooser opened, the floating Accessibility control remained visible, and the authenticated Workspace loaded. The full Vitest suite passed 428/428; lint and the production build passed.
- Prevention: Auth component tests assert the official provider setup and bounded callback route.
- Commit or PR: `5de30c9`.

## 2026-08-10 00:57 - Google prompt, Workspace loading, and accessibility placement broke continuity

- Status: fixed
- Owner: Henix
- Area: authentication interaction, Workspace loading states, global accessibility control
- Symptoms: Google account selection appeared to do nothing, Workspace initially showed an authentication-shaped card skeleton, and the floating Accessibility control covered Settings navigation.
- Reproduction: Select Google sign-in on `/sign-in`, navigate directly to `/workspace`, then open `/workspace/settings` at desktop width.
- Expected: Google account selection stays in the current page, loading resembles the destination route, and accessibility controls never obscure navigation or the persistent composer.
- Actual: The provider interaction used a provider-rendered flow, the root fallback displayed a generic card while the Workspace layout resolved, and the fixed control occupied sidebar navigation space.
- Root cause: The Google client path was not explicitly driven through the in-page prompt API, the root loading boundary had no pathname-aware Workspace variant, and the global fixed position ignored Workspace shell geometry.
- Fix: Replaced the provider-rendered control with a retryable in-page One Tap/FedCM prompt, added public and route-aware Workspace skeletons, and positioned the compact Workspace trigger outside the sidebar and above the composer. Permanent fix.
- Files changed: `src/components/auth/google-sign-in-button.tsx`, `src/components/shared/route-loading.tsx`, `src/app/loading.tsx`, `src/app/workspace/loading.tsx`, `src/app/globals.css`, `src/app/workspace.css`, focused tests and guidance.
- Verification: Chrome retained one tab and the `/sign-in` URL after invoking Google; browser inspection showed route-specific home and Settings skeletons; the loaded Settings trigger measured 44 by 44 pixels at x=280 outside the sidebar. All 431 unit tests and the production build passed.
- Prevention: Auth tests require a dialog-capable prompt after explicit activation, loading tests assert public and Workspace destination shapes, and accessibility tests require Workspace-specific positioning.
- Commit or PR: `6bd1d9d`.

## 2026-08-10 07:02 - Google actions appeared frozen or generically unavailable

- Status: fixed
- Owner: Henix
- Area: Google sign-in feedback and Docs connection recovery
- Symptoms: Continue with Google retained static copy while waiting, and Docs reduced missing OAuth configuration to `This is temporarily unavailable`.
- Reproduction: Select Continue with Google and observe the pending state, then open `/workspace/documents` while Google Workspace OAuth is unconfigured.
- Expected: The button names its active operation, and Docs names the exact recoverable setup requirement.
- Actual: Authentication looked inactive and Docs offered only a generic retry loop.
- Root cause: Pending state changed only button mechanics, while the Docs client mapped `configured: false` to the general unavailable state.
- Fix: Added localized signing-in copy and a dedicated Google setup state that identifies the server environment, restart, and retry steps. Permanent fix.
- Files changed: `messages/en.json`, `messages/id.json`, `src/components/auth/google-sign-in-button.tsx`, `src/components/workspace/documents-client.tsx`, `src/app/workspace/settings/page.tsx`.
- Verification: Chrome reproduced the original generic state, then displayed `Finish Google setup` with the exact recovery after the change. All 433 unit tests and the production build passed.
- Prevention: Authentication coverage asserts the chained callback, and Google configuration no longer maps to generic unavailability.
- Commit or PR: pending.

## 2026-08-10 07:49 - Google sign-in presented two account selectors

- Status: fixed
- Owner: Henix
- Area: Google sign-in interaction
- Symptoms: Selecting the primary Google CTA opened a floating FedCM account prompt before Google's full-page chooser.
- Reproduction: Open `/sign-in`, select `Continue with Google`, then observe the floating chooser followed by the Google authorization page.
- Expected: The CTA immediately opens Google's full-page account chooser in the same tab.
- Actual: One Tap handled identity first, then a second custom OAuth flow requested Workspace access.
- Root cause: The client used Better Auth One Tap while Workspace tokens were obtained through a separate redirect.
- Fix: Replaced One Tap with Better Auth social sign-in and a single same-tab authorization-code redirect. Permanent fix.
- Files changed: `src/components/auth/google-sign-in-button.tsx`, `src/lib/client/auth/auth-client.ts`, focused tests and guidance.
- Verification: Browser testing opened `accounts.google.com` directly with `prompt=select_account consent` and no floating FedCM prompt. Focused tests, lint, and production build passed.
- Prevention: The authentication test requires direct `signIn.social` routing and rejects dialog semantics.
- Commit or PR: pending.

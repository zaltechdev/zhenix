# Aksa MVP Gap Analysis

**Date:** 2026-08-07 17:19 WIB
**Deadline:** 2026-08-10 (3 days remaining)
**Competition:** BITSMIKRO Innovative Vibecode 2026

> [!CAUTION]
> Submission closes Aug 10. Pitching is Aug 14. Three calendar days remain for all implementation, integration, testing, and deployment.

---

## Status Legend

| Symbol | Meaning |
|--------|---------|
| `DONE` | Implemented, renders, has real logic |
| `SHELL` | Files exist, UI renders, but backend returns stub/blocked/unavailable |
| `MISSING` | No implementation exists |

---

## 1. Landing Page

| Item | Status | Evidence |
|------|--------|----------|
| Marketing page with sections | `DONE` | 11 components in `src/components/landing/` |
| Navbar with scroll morphing | `DONE` | Log entry 2026-08-07 07:47 |
| Hero, features, how-it-works, FAQ, CTA, footer | `DONE` | Component files exist |
| i18n (EN/ID) | `DONE` | paraglide-js configured, messages/ present |
| "Try Aksa" CTA routing | `DONE` | Links to auth flow |

---

## 2. Authentication (FR-A1 through FR-A8)

| Item | Status | Evidence |
|------|--------|----------|
| Sign-up / sign-in pages | `SHELL` | Routes exist at `(auth)/sign-in`, `(auth)/sign-up` |
| Session persistence | `MISSING` | `authGateway()` returns `createUnconfiguredAuthGateway()` - every method returns `unavailable` |
| Auth library integration | `MISSING` | No auth library installed (no better-auth, next-auth, lucia, etc.) |
| Database tables for users | `MISSING` | `db/schema.ts` is empty (`export {}`) |
| Sign-out | `SHELL` | Method exists, does nothing |
| Session expiry handling | `SHELL` | Contract types exist, no implementation |

> [!CAUTION]
> **Auth is the #1 blocker.** Every workspace feature, every Google connection, every task, every history read depends on `readSessionState()` returning `authenticated`. Right now it always returns `unavailable`. Nothing downstream can work until this is real.

---

## 3. Database

| Item | Status | Evidence |
|------|--------|----------|
| Drizzle ORM + libsql | `SHELL` | Packages installed, `db/client.ts` exists |
| Schema tables (users, sessions, tasks, activity, google_tokens, etc.) | `MISSING` | `db/schema.ts` exports nothing |
| Migrations | `MISSING` | No migration files |

---

## 4. Onboarding (FR-A4 through FR-A8)

| Item | Status | Evidence |
|------|--------|----------|
| Onboarding flow UI | `DONE` | `onboarding-flow.tsx` (39KB, multi-step) |
| Camera consent step | `DONE` | UI exists in onboarding flow |
| Head pointer test step | `SHELL` | UI exists but vision module is README-only |
| Calibration with persistence | `SHELL` | API route exists at `api/accessibility-profile`, but save returns `unavailable` (no DB, no auth) |
| Microphone consent step | `DONE` | UI step exists |
| Voice test step | `SHELL` | `speech-recognition.ts` exists (2.8KB) but limited |
| Skip and resume | `SHELL` | UI supports skip, but state is not persisted (no auth/DB) |

---

## 5. Head Control / Computer Vision (FR-C1 through FR-C10)

| Item | Status | Evidence |
|------|--------|----------|
| MediaPipe Tasks Vision package | `SHELL` | `@mediapipe/tasks-vision` installed, but `src/lib/client/vision/` contains only a README |
| Head-pose pointer (Aksa cursor) | `MISSING` | No face landmark, no head pose estimation, no pointer logic |
| Sensitivity / dead zone / smoothing | `SHELL` | UI controls exist in `accessibility-controls.tsx`, but no vision code consumes them |
| Dwell selection | `MISSING` | No dwell timer, no target detection |
| Facial gesture selection | `MISSING` | No blendshape analysis |
| Pause/resume head control | `SHELL` | UI toggle exists, no vision to pause |
| Face detection loss handling | `MISSING` | No detection loop exists |

> [!WARNING]
> **Computer Vision is the product's anchor differentiator** ("Computer Vision + AI Agents + Accessibility") and currently has zero functional code. The MediaPipe package is installed but unwired.

---

## 6. Voice & Text Command (FR-V1 through FR-V6)

| Item | Status | Evidence |
|------|--------|----------|
| Speech recognition hook | `SHELL` | `speech-recognition.ts` (2.8KB) wraps Web Speech API |
| Command composer UI | `DONE` | `command-composer.tsx` (12KB) with voice + text input |
| Editable transcript | `SHELL` | UI exists, unclear if transcript editing works end-to-end |
| Text submission fallback | `DONE` | Text input field in command composer |
| Command submission to backend | `SHELL` | Calls `api/commands` route, which calls `agentRunner().submitCommand()`, which always returns `unavailable` |

---

## 7. Agent Orchestration (FR-G1 through FR-G10)

| Item | Status | Evidence |
|------|--------|----------|
| Agent runner boundary | `SHELL` | Types defined, `agent-runner.ts` always returns `unavailable` |
| Tool registry (descriptors) | `DONE` | 15 tools defined with kinds, capabilities, confirmation requirements, undo kinds |
| Intent-to-tool allowlists | `DONE` | 11 intent categories mapped |
| Provider registry | `DONE` | Resolves Google AI Studio > Vertex AI > Dahl with retry/timeout config |
| **Actual LLM orchestration loop** | `MISSING` | No prompt construction, no model call, no tool dispatch, no iteration |
| Intent classification | `MISSING` | `echoUnderstanding()` just echoes text, `intentResolved: false` |
| Tool execution implementations | `MISSING` | No tool has a `run()` function |
| Verification of tool results | `MISSING` | No verification logic |
| Max iteration / timeout enforcement | `MISSING` | Config exists, no loop to enforce on |
| Cancellation during execution | `SHELL` | Returns `unable_to_cancel` always |
| Provider fallback on failure | `SHELL` | Registry resolves alternatives, but no call exists to fail over |

> [!CAUTION]
> **The agent loop is the core product capability.** The contracts and registry are well-designed, but no LLM call, no tool execution, no orchestration loop exists. This is the second highest priority after auth.

---

## 8. Google Workspace Integration (FR-GW1 through FR-GW12)

| Item | Status | Evidence |
|------|--------|----------|
| OAuth flow (connect/disconnect) | `SHELL` | Routes at `api/google/auth`, `api/google/callback`, `api/google/connection` exist. OAuth was tested in browser but `googleGateway()` returns unconfigured gateway |
| Token store | `SHELL` | `token-store.ts` exists (2.7KB) but depends on DB that doesn't exist |
| Google Docs API client | `DONE` | `docs-api.ts` - real REST calls with `getDocument()` and `batchUpdateDocument()` |
| Docs adapter (API to Aksa model) | `DONE` | `docs-adapter.ts` (6.5KB) converts Google Doc structure to Aksa document model |
| Document surface UI | `DONE` | `document-surface.tsx` (12KB) with TipTap editor |
| Documents client | `DONE` | `documents-client.tsx` (8KB) |
| Drive file listing UI | `DONE` | `files-surface.tsx` (6KB) |
| Sheets surface UI | `DONE` | `sheet-surface.tsx` (4.5KB) |
| Mail surface UI | `DONE` | `mail-surface.tsx` (5KB) |
| Slides surface UI | `DONE` | `slides-surface.tsx` (1.6KB) - "coming soon" as designed |
| Google Picker | `SHELL` | `google-picker.tsx` exists, renders blank iframe |
| **Actual Google API calls from gateway** | `MISSING` | `google/service.ts` returns blocked for every operation |
| Drive search/list/move/rename/create-folder | `MISSING` | Gateway stubs only |
| Sheets read/write range | `MISSING` | Gateway stubs only |
| Gmail list/read/draft | `MISSING` | Gateway stubs only |
| Incremental scope requests | `MISSING` | No scope upgrade flow |

---

## 9. Web Search & Artifacts (FR-S1 through FR-S7)

| Item | Status | Evidence |
|------|--------|----------|
| Search surface UI | `DONE` | `search-surface.tsx` (3.4KB) |
| Search API route | `SHELL` | `api/search/route.ts` exists |
| Grounded search service | `SHELL` | `search/service.ts` returns `unavailable` for every query |
| Artifact view UI | `DONE` | `artifact-view.tsx` (4.7KB) |
| **Actual grounded search call** | `MISSING` | No Vertex AI grounding, no Google Search integration |
| Source cards with domain/time | `MISSING` | No search results to render |
| Artifact storage/retrieval | `MISSING` | No DB tables, no persistence |

---

## 10. History, Activity, Confirmation, Undo (FR-H1 through FR-H9)

| Item | Status | Evidence |
|------|--------|----------|
| Task list UI | `DONE` | `task-list.tsx`, routes at `workspace/history` |
| Activity list UI | `DONE` | `activity-list.tsx`, routes at `workspace/activity` |
| Confirmation dialog UI | `DONE` | `confirmation-dialog.tsx` (6.5KB) with approve/edit/cancel |
| Undo panel UI | `DONE` | `undo-panel.tsx` (3KB) |
| State panel UI | `DONE` | `state-panel.tsx` (5.8KB) |
| **Task persistence** | `MISSING` | `readTaskHistory()` returns `emptyResource("no_tasks")` |
| **Activity recording** | `MISSING` | `readWorkspaceActivity()` returns empty |
| **Confirmation flow** | `SHELL` | `respondToConfirmation()` returns `unavailable` |
| **Undo execution** | `SHELL` | `requestUndo()` returns `undo_unavailable` |

---

## 11. Workspace Shell

| Item | Status | Evidence |
|------|--------|----------|
| App shell with sidebar | `DONE` | `workspace-shell.tsx`, `workspace-sidebar.tsx`, `workspace-header.tsx` |
| Navigation items | `DONE` | `navigation-items.ts` with all workspace views |
| Workspace layout | `DONE` | Layout at `workspace/layout.tsx` |
| Welcome/dashboard | `DONE` | `workspace/page.tsx`, `welcome-header.tsx`, `quick-start-suggestions.tsx` |
| Google workspace launchpad | `DONE` | `google-workspace-launchpad.tsx` |
| Settings/Account routes | `DONE` | Routes exist |
| Accessibility settings route | `DONE` | Route exists |

---

## 12. i18n

| Item | Status | Evidence |
|------|--------|----------|
| paraglide-js setup | `DONE` | Configured, compiles |
| EN + ID message files | `DONE` | `messages/en.json`, `messages/id.json` |
| All UI strings through i18n | `DONE` | Verified in logs |

---

## 13. Testing & Quality

| Item | Status | Evidence |
|------|--------|----------|
| Vitest unit tests | `DONE` | 153-154 tests passing |
| Playwright e2e setup | `DONE` | `@playwright/test` installed, scripts defined |
| axe-core a11y testing | `DONE` | `@axe-core/playwright` installed |
| Typecheck | `DONE` | 0 errors in recent logs |
| Lint | `DONE` | 0 errors in recent logs |
| Production build | `DONE` | Passes |

---

## 14. Deployment

| Item | Status | Evidence |
|------|--------|----------|
| Public deployed URL | `MISSING` | No deployment configuration found |
| Vercel/Cloudflare/etc config | `MISSING` | No deployment files |

---

## Critical Path Summary

The codebase has strong **frontend UI shells** and **contract types**, but almost zero **working backend logic**. Here's the priority stack:

### Tier 1: Without these, nothing works (Days 1-2)

| # | Task | Blocks |
|---|------|--------|
| 1 | **Auth: install library, wire DB, implement sign-up/sign-in/session** | Everything |
| 2 | **Database: define schema tables, run migrations** | Auth, tasks, activity, Google tokens, search artifacts |
| 3 | **Agent orchestration loop: LLM call, intent classification, tool dispatch** | Commands, search, Google operations |
| 4 | **Head control: MediaPipe face landmark + head pose pointer + dwell** | Core product differentiator, demo flow steps 3-6 |

### Tier 2: Without these, the demo fails (Day 2-3)

| # | Task | Blocks |
|---|------|--------|
| 5 | **Google gateway: wire real Drive/Docs/Sheets/Gmail API calls through OAuth tokens** | Demo steps 10, 12 |
| 6 | **Grounded search: Vertex AI with Google Search grounding** | Demo steps 12-14 |
| 7 | **Task persistence + activity recording** | Demo steps 15-16 |
| 8 | **Confirmation flow + undo execution** | Demo step 12 (Drive move) |

### Tier 3: Deployment and polish (Day 3)

| # | Task | Blocks |
|---|------|--------|
| 9 | **Deploy to public URL** | Competition requirement (NFR-14) |
| 10 | **End-to-end demo rehearsal** | 5 consecutive clean runs (acceptance criterion) |
| 11 | **WCAG 2.2 AA audit** | Acceptance criterion 15 |

---

## What Actually Works End-to-End Right Now

1. Landing page renders with i18n
2. Auth pages render (but sign-in/sign-up do nothing)
3. Onboarding flow UI steps through (but nothing persists)
4. Workspace shell renders with all navigation
5. All surface UIs (Docs, Sheets, Drive, Mail, Search) render their empty/blocked states
6. Provider registry resolves configured providers
7. Type system, tests, lint, and build all pass

## What Does NOT Work At All

1. No user can sign up or sign in
2. No session exists, so all workspace reads return "authentication required" or "unavailable"
3. No head pointer moves on screen
4. No voice command produces any result
5. No Google data is fetched or displayed
6. No search query returns results
7. No task is recorded
8. No activity is logged
9. No confirmation can be approved
10. No undo can execute
11. The app is not deployed anywhere

---

## Quantified Gap

| Category | Items in PRD | Items `DONE` | Items `SHELL` | Items `MISSING` |
|----------|:---:|:---:|:---:|:---:|
| Auth & Session | 8 | 0 | 3 | 5 |
| Head Control | 10 | 0 | 3 | 7 |
| Voice/Text | 6 | 2 | 2 | 2 |
| Agent Orchestration | 10 | 3 | 2 | 5 |
| Google Workspace | 12 | 3 | 3 | 6 |
| Web Search | 7 | 2 | 1 | 4 |
| History/Activity/Undo | 9 | 4 | 2 | 3 |
| Workspace Shell | 5 | 5 | 0 | 0 |
| Landing | 5 | 5 | 0 | 0 |
| i18n | 2 | 2 | 0 | 0 |
| Deployment | 2 | 0 | 0 | 2 |
| **Total** | **76** | **26** | **16** | **34** |

**34 of 76 requirements have zero implementation. 16 more are non-functional shells.**

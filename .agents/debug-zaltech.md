# Debug History

This file records verified development issues and fixes.

Do not record speculation.
Do not record routine progress.
Do not include secrets, tokens, personal data, or hidden model reasoning.

Scope: backend, APIs, database, authentication internals, authorization, agent orchestration, provider integration, Google integrations, infrastructure, deployment, and backend tests. Owner: Zaltech.

Layout, component, copy, and frontend accessibility issues belong in `.agents/debug-henix.md`.

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
- Close an entry only after the verification step passes on a real run. A passing mock is not verification of an integration.
- Link a duplicate to the original entry instead of writing a second investigation.
- Redact tokens, keys, identifiers that map to a real person, document content, email content, and transcripts.
- Never paste a provider payload or a stack trace containing credentials.
- Newest entries go at the bottom.

## Field Guidance

| Field | Expected content |
| --- | --- |
| Status | `open`, `workaround`, `fixed`, or `duplicate of <date and title>` |
| Owner | The person who verified the fix |
| Area | For example auth, session, authorization, schema, migration, agent loop, tool registry, provider routing, Drive, Docs, Sheets, Gmail, grounded search, confirmation, Undo, rate limiting, deployment |
| Symptoms | The observable system behavior, including the state the interface received |
| Reproduction | Exact request or command, input shape, account context, and environment |
| Expected | The contract from `.agents/prd.md`, `.agents/security.md`, `.agents/db_schema.md`, or the relevant feature document |
| Actual | The observed behavior, including the state name returned |
| Root cause | The verified mechanism, not a guess |
| Fix | What changed and whether it is a workaround or permanent |
| Files changed | Relative repository paths |
| Verification | The exact command run and the evidence it produced |
| Prevention | The test, constraint, schema change, or documentation change that stops a recurrence |
| Commit or PR | Reference once it exists |

## Security Incident Handling

A security-relevant issue follows the same template with three additions.

- Record it only after confirming it with a real request or a real file read. Never record a suspected incident as fact.
- If a secret was exposed, rotate first, then record the entry with the secret redacted and the rotation noted under Fix.
- Add the regression test identifier under Prevention. For authorization issues, reference the matching `SEC-T` case in `.agents/security.md` section 2.

## Entries

## 2026-08-08 14:44 - Semantic voice fallback called a missing endpoint

- Status: fixed
- Owner: Zaltech
- Area: authenticated API, Gemini intent classification, rate limiting
- Symptoms: A deterministic miss posted recognized text to `/api/commands/intent` and received the Next.js 404 page, so the advertised semantic fallback never existed.
- Reproduction: POST `{ transcript, locale }` to `/api/commands/intent` before the fix. The real development server returned HTTP 404.
- Expected: An authenticated route validates transcript text, tries the deterministic registry first, optionally asks Gemini for one structured allowlisted intent, and otherwise returns `UNKNOWN`.
- Actual: No route handler or server classifier existed.
- Root cause: The client semantic request was merged before its server boundary was implemented.
- Fix: Added a strict Zod request contract, authenticated no-store route, deterministic-first server classifier, structured Gemini response schema, allowlist validation, in-flight deduplication, timeout handling, and per-user rate limiting. Permanent fix.
- Files changed: `src/app/api/commands/intent/route.ts`, `src/lib/contracts/voice-intent.ts`, `src/lib/server/voice/intent-classifier.ts`, `src/lib/server/voice/intent-rate-limit.ts`, `src/lib/voice/intent-router.ts`
- Verification: Server classifier tests accepted only allowlisted structured output and rejected malformed output. Real Playwright HTTP verification now returns authenticated-boundary HTTP 401 with `{ intent: "UNKNOWN" }`, not 404. Localization, typecheck, lint, 357 unit tests, production build, and 24 Workspace Playwright tests passed.
- Prevention: Unit tests cover deterministic independence, structured provider output, malformed output, and request limits. Workspace E2E asserts that the route exists and enforces authentication.
- Commit or PR: `c188994`.

## 2026-08-10 00:32 - Google sign-in callback rejected a valid account

- Status: fixed
- Owner: Zaltech
- Area: Better Auth, Google sign-in, Drizzle schema
- Symptoms: The Google account chooser completed, but the user remained on sign in.
- Reproduction: Select an account through the official Google button on local development. The callback returned HTTP 401.
- Expected: Better Auth verifies the ID token, creates the user and session, then opens the authenticated Workspace.
- Actual: Better Auth rejected persistence because its required `user.image` schema property was absent.
- Root cause: Drizzle exposed the existing `image_url` column as `imageUrl`, while Better Auth writes the logical field named `image`.
- Fix: Remapped the existing column to `users.image`, added a local development base URL fallback, and retained production configuration requirements. No database migration was required because the physical column name stayed unchanged. Permanent fix.
- Files changed: `src/lib/server/db/schema.ts`, `src/lib/server/auth/better-auth.ts`, `tests/unit/auth-schema.test.ts`
- Verification: The real Google callback returned HTTP 200, `/workspace` returned HTTP 200, and Chrome loaded the authenticated Workspace. The full Vitest suite passed 428/428; lint and the production build passed.
- Prevention: A schema regression test requires Better Auth's logical `image` field to map to `image_url`.
- Commit or PR: `5de30c9`.

## 2026-08-10 00:57 - Workspace initialization repeated authenticated database reads

- Status: fixed
- Owner: Zaltech
- Area: authenticated Workspace bootstrap, session and Google connection reads
- Symptoms: After successful Google authentication, the Workspace remained on its loading state for several seconds.
- Reproduction: Complete local Google authentication and measure the callback-to-Workspace transition while `readWorkspaceContext()` resolves its parallel services.
- Expected: Each request resolves identical session and Google connection reads once, then shares those results across dependent services.
- Actual: Parallel capability, task, profile, preference, and Google services independently repeated identical request-scoped reads.
- Root cause: Session and Google connection accessors lacked request-local memoization.
- Fix: Wrapped both accessors with React `cache`, preserving request isolation while deduplicating identical reads during one render. Permanent fix.
- Files changed: `src/lib/server/db/dal.ts`, `src/lib/server/google/service.ts`.
- Verification: Authenticated Workspace response time decreased from approximately 9.3 seconds to 3.6 seconds. TypeScript, lint, all 431 unit tests, and the production build passed.
- Prevention: Keep memoization request-scoped and never promote authenticated results into shared process caches.
- Commit or PR: `6bd1d9d`.

## 2026-08-10 07:02 - Google sign-in stopped before Workspace authorization

- Status: workaround
- Owner: Zaltech
- Area: Better Auth, Google Workspace OAuth, post-consent routing
- Symptoms: Google created an Aksa session but did not establish a Google Workspace connection, so Docs remained blocked.
- Reproduction: Complete Continue with Google, then inspect the Workspace connection and open Docs.
- Expected: The primary CTA verifies the Google identity token, creates the Aksa session, starts same-tab Workspace consent, stores the encrypted refresh token, then enters onboarding.
- Actual: The identity callback navigated directly to Workspace, and the current local runtime reports Workspace OAuth unconfigured because its client secret is still a placeholder or missing.
- Root cause: Authentication and Workspace authorization had no chained transition, and Google authorization-code exchange cannot run without the real web OAuth client secret.
- Fix: Chained the verified session into `/api/google/auth`, carried only allowlisted return destinations inside signed OAuth state, redirected success or failure safely, and routed all authentication modes to onboarding. The code path is permanent; local token exchange remains blocked until the real client secret is supplied outside the repository.
- Files changed: `src/app/api/google/auth/route.ts`, `src/app/api/google/callback/route.ts`, `src/lib/server/google/oauth.ts`, `src/components/auth/auth-form.tsx`, `src/components/auth/google-sign-in-button.tsx`, focused tests and guidance.
- Verification: State-binding and open-redirect tests passed, Chrome confirmed Aksa authentication, and all 433 unit tests plus the production build passed. Real Workspace token exchange was not claimable because the required client secret is absent.
- Prevention: Tests require the chained callback, onboarding destination, user-bound state, tamper rejection, and bounded return destinations.
- Commit or PR: pending.

## 2026-08-10 07:49 - Google identity and Workspace tokens required two OAuth flows

- Status: fixed
- Owner: Zaltech
- Area: Better Auth and Google Workspace tokens
- Symptoms: Google identity created the session, then a second authorization route requested Workspace access.
- Reproduction: Complete the One Tap account prompt and observe the subsequent `/api/google/auth` redirect.
- Expected: One authorization-code callback creates the session and securely stores Workspace provider tokens.
- Actual: Better Auth stored identity only while the custom connection table owned Workspace tokens.
- Root cause: Google scopes and offline access were configured only on the custom OAuth route.
- Fix: Configured Better Auth's Google provider with Workspace scopes, offline access, account selection, consent, and encrypted tokens; Google services now read Better Auth tokens before legacy connections. Permanent fix.
- Files changed: `src/lib/server/auth/better-auth.ts`, `src/lib/server/google/token-store.ts`, focused tests and guidance.
- Verification: Google accepted `/api/auth/callback/google`, requested the Docs and Drive metadata scopes, and rendered its full-page sign-in surface. Typecheck, focused tests, lint, and production build passed.
- Prevention: Authentication coverage requires one social callback directly to onboarding.
- Commit or PR: pending.

## 2026-08-10 11:00 - Session appeared lost when reopening the Vercel alias

- Status: fixed
- Owner: Zaltech
- Area: production hostname routing and Better Auth session cookies
- Symptoms: A signed-in user opening `aksawork.vercel.app/workspace` was redirected to sign in again.
- Reproduction: Request `https://aksawork.vercel.app/workspace` before the fix. Production returned HTTP 307 with `Location: /sign-in`.
- Expected: Every production entry URL converges on `aksawork.web.id`, where the secure session cookie is valid.
- Actual: The Vercel alias served independently, but browser cookies cannot cross between unrelated hostnames.
- Root cause: Production exposed two hostnames without canonical redirect handling, splitting one session across two cookie origins.
- Fix: Added an HTTP 308 canonical-host redirect for Vercel aliases before the Workspace cookie guard. Permanent fix.
- Files changed: `src/proxy.ts`, `tests/unit/proxy.test.ts`
- Verification: Production now returns HTTP 308 from the Vercel alias to the matching `aksawork.web.id` path. Opening the alias in the authenticated browser reached the canonical Workspace with no console errors. Focused tests passed 37/37, typecheck passed, and both local and Vercel production builds passed.
- Prevention: Proxy tests require alias canonicalization, path and query preservation, public canonical routes, and the existing Workspace session guard.
- Commit or PR: `f470ad3`.

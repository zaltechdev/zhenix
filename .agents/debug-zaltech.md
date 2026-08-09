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
- Commit or PR: pending.

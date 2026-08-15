# Aksa Engineering Rules

Enforceable rules for every human and coding agent working in this repository. A rule is violated or satisfied, never partially interpreted.

## 1. Documentation Priority

When two documents disagree, the higher entry wins.

| Rank | Source | Authority |
| --- | --- | --- |
| 1 | `GUIDE BOOK BITSMIKRO INNOVATIVE VIBECODE.pdf` and its conversion `.agents/compbook.md` | Competition rules, deliverables, scoring, deadlines |
| 2 | `.agents/prd.md` | Product scope, requirements, flows |
| 3 | `.agents/security.md` | Security and privacy requirements |
| 4 | `.agents/rules.md` | Engineering rules, this file |
| 5 | `.agents/design.md` | Frontend visual and interaction requirements |
| 6 | `.agents/features/*.md` | Feature-level specifications |
| 7 | `.agents/guide-henix.md` and `.agents/guide-zaltech.md` | Role execution guides |
| 8 | Existing implementation | Current reality, not a requirement |

A role guide never overrides the competition guidebook. Existing code never overrides a documented requirement; it is either updated or recorded as an open question.

## 2. Conflict Resolution

1. Identify the two highest-ranked sources in conflict.
2. Follow the higher rank.
3. Record the conflict under Open Questions in the lower-ranked document.
4. Do not silently invent a third behavior.
5. Do not resolve a conflict by deleting a requirement.

If a conflict makes work impossible, stop and escalate to Henix for frontend scope or Zaltech for system scope.

## 3. Role Boundaries

| Domain | Owner |
| --- | --- |
| Frontend architecture, routes, components, client state | Henix |
| Layout, tokens, typography, motion, responsive behavior | Henix |
| User flows, interface copy, Indonesian and English strings | Henix |
| Accessibility interactions, focus, announcements, fallbacks | Henix |
| Frontend unit, component, accessibility, browser tests | Henix |
| Backend architecture, API contracts, server validation | Zaltech |
| Database schema, migrations, data integrity | Zaltech |
| Authentication internals, sessions, authorization enforcement | Zaltech |
| Server-side agent execution, tool registry, provider integration | Zaltech |
| Google integrations, secrets, infrastructure, deployment | Zaltech |
| Backend unit, integration, contract, security, reliability tests | Zaltech |

Rules:

- One implementation responsibility has exactly one owner.
- Cross-boundary work is expressed as an interface contract, never as instructions into the other domain.
- Henix states what the interface needs. Zaltech states what the system guarantees.
- Correct wording: the frontend receives a task status and renders it. Incorrect wording: the frontend writes to the task table.
- Neither owner changes the other's tests to make their own work pass.

## 4. Technology Constraints

Default stack. Replace a major technology only with a documented repository conflict and a recorded reason.

| Layer | Required choice |
| --- | --- |
| Framework | Next.js App Router |
| Language | TypeScript, strict mode |
| UI | React with Server Components by default |
| Styling | Tailwind CSS with tokens from `.agents/design.md` |
| Data | Turso hosted libSQL through Drizzle ORM with Drizzle migrations |
| Browser storage | IndexedDB only for calibration cache, drafts, and temporary state |
| i18n | Paraglide JS, Indonesian and English |
| Auth | An established Next.js-compatible authentication library, Better Auth or Auth.js |
| AI abstraction | Vercel AI SDK |
| Primary model provider | Vertex AI |
| Default orchestrator model | A current low-cost Gemini Flash-Lite class model |
| Fallback provider | Dahl Inference through its OpenAI-compatible API, configurable |
| Fallback models | Kimi K2.6 and MiniMax M2.7, text only |
| Validation | Zod for all model output, tool arguments, and API input |
| Vision | MediaPipe Tasks Vision Face Landmarker in the browser |
| Voice | Browser speech recognition with mandatory text fallback |
| Document editor | TipTap |
| Tabular view | TanStack Table or an accessible native table |
| Client interaction state | Zustand only where React state is insufficient |
| Google | Google OAuth 2.0 with Drive, Docs, Sheets, and Gmail APIs |
| Grounded search | Vertex AI grounding with Google Search behind a provider abstraction |
| Unit and integration tests | Vitest |
| End-to-end tests | Playwright |
| Deployment | Vercel |

Additional constraints:

- Model identifiers, provider base URLs, and limits are configuration, not literals in feature code.
- Do not add a second UI library, CSS framework, state manager, or ORM.
- Do not add a dependency without pinning an exact version.
- If a secondary library already exists in the repository and works, keep it and document why rather than migrating.
- Monospace typography is not used in the consumer interface.

## 5. Architecture Boundaries

1. Server Components are the default. A Client Component requires one of: camera, microphone, pointer interaction, local interaction state, or an animation that cannot be expressed server-side.
2. All data access goes through one server-side data access layer. Components do not query the database directly.
3. Route Handlers and Server Actions validate input with Zod before any other work.
4. Responses return minimal shaped objects. Never return a raw database row to the client.
5. Business logic lives in server modules, not in React components.
6. Presentational components receive data and callbacks. They do not fetch, mutate, or branch on provider behavior.
7. Provider selection, retry, and fallback live in one provider abstraction. No feature code names a provider directly.
8. The tool registry is the only path from a model to an effect.
9. Client code never receives a provider key, a Google token, or a database credential.

## 6. Server-Only Secrets

- Every secret is a server-only environment variable. No secret is prefixed for client exposure.
- `.env.example` documents every required variable with a placeholder and a one-line description.
- Real secret values never appear in code, documentation, commit messages, logs, tests, fixtures, or prompts.
- Never read `.env`, `.env.local`, `.env.production`, key files, or credential stores. `.gitignore` is not a security boundary.
- Google refresh tokens are stored encrypted at rest and are never sent to the client.
- Logs redact tokens, keys, cookies, email bodies, transcripts, and document content.

## 7. Model Call Rules

1. No model call originates from a Client Component. All model calls run server-side.
2. Every model output that the system acts on is parsed with a Zod schema. An unparseable output is a failure, not a best-effort guess.
3. Every tool argument set is parsed with a Zod schema before execution.
4. A tool executes only if it is in the allowlisted registry for the current intent.
5. Authorization happens outside the model. The model can request an action; the server decides whether it is permitted.
6. Retrieved content from the web, email, documents, and sheets enters the prompt as clearly delimited untrusted data, never as instructions.
7. The agent loop has a maximum iteration count and a wall-clock timeout, both configurable.
8. A cancelled task stops before the next tool call.
9. Provider fallback may change the model. It never changes tool permissions, confirmation requirements, or budget checks.
10. Do not call multiple providers for the same request to appear multi-model.

## 8. Honesty Rules

- Never fabricate a tool result, a file, a transcript, a citation, a source, or a completion.
- A task reports `Completed` only after the tool result is verified.
- Partial completion is reported with named items and counts.
- An activity step is written only after the corresponding tool call ran.
- Model reasoning traces are never displayed, logged, or stored.
- A capability Aksa does not have is refused with a reason. It is never simulated in the interface.
- Placeholder or mock data is never presented as a real result. Mocks are allowed in isolated tests only.
- A test or integration is reported as passing only with evidence from an actual run.

## 9. Consequential Action Rules

An action is consequential when it writes, moves, renames, shares, sends, or deletes anything, inside Aksa or in Google.

| Rule | Requirement |
| --- | --- |
| Preview | The user sees the action, the scope with named items, the consequence, and the recovery option before execution |
| Approval | Approve, edit, and cancel are all available |
| Input | Dwell or facial gesture alone cannot approve; a deliberate second signal is required |
| Single use | One approved confirmation authorizes exactly one execution |
| Expiry | An unanswered confirmation expires and cannot be redeemed later |
| Replay | A reused confirmation identifier is rejected server-side |
| Verification | The result is read back and checked before success is reported |
| Recovery | Undo is offered where the reverse operation is genuinely supported, and its absence is stated up front |
| Idempotency | A repeated request for the same approved action does not apply it twice |

Read-only actions skip confirmation. Nothing else does.

## 10. Cancellation, Timeout, Iteration Limits

- Every long-running task exposes cancellation from the moment it starts.
- Cancellation is checked before each tool call and honored without a further prompt.
- Completed steps survive cancellation and are reported.
- Every provider call and every Google call has a timeout.
- Timeout produces a partial result, never a silent retry loop.
- Retry uses exponential backoff with jitter and respects `Retry-After`.
- Retry counts, timeouts, iteration limits, queue depth, and concurrency limits are configuration values.
- Do not hardcode provider request-per-minute values. Vertex AI Gemini capacity is governed by dynamic shared quota, so treat `429` as a runtime condition to handle rather than a fixed number to predict.

## 11. Component Reuse

1. Check `.agents/design.md` section 7 before creating a component.
2. Extend an existing component with a variant before adding a new component.
3. A new shared component requires an entry in `.agents/design.md`.
4. No component duplicates an existing state pattern for loading, empty, error, partial, confirmation, or Undo.
5. No inline color, spacing, radius, or duration values. Use tokens.

## 12. Accessibility Requirements

Enforced on every frontend change.

- Semantic HTML first. ARIA only where semantics are insufficient.
- One H1 per page, valid heading order, landmark regions present.
- Keyboard reachable, visible focus, focus restored after dialogs, no keyboard trap outside modals.
- Interactive targets at least 44 by 44 px with at least 8 px separation.
- No color-only status. Status carries text plus an icon.
- No action available only on hover.
- Labels describe the result, not the icon.
- Errors and helper text are programmatically associated with their inputs.
- Agent state changes announce through a polite live region, assertive only for confirmation and failure.
- `prefers-reduced-motion` is respected, including dwell progress.
- Usable at 200 percent zoom with no horizontal scrolling at 320 px width.
- Every camera-dependent interaction has a keyboard and a mouse equivalent.

## 13. Localization Rules

- No hardcoded user-facing string in a component.
- No sentence built by concatenating translated fragments.
- Named variables and proper plural forms only.
- Accessible names, live-region announcements, and error text are localized.
- Dates, times, counts, and file sizes are formatted for the active locale.
- One status message never mixes languages.
- Indonesian is treated as the longer layout case when uncertain.

### 13.1 Localization Compilation Workflow
- Whenever adding or modifying message keys in `messages/*.json`, you MUST run `bun run i18n:compile` before running test suites or starting the dev server. Never import uncompiled message functions from `@/paraglide/messages.js`.

## 14. Testing Rules

| Change type | Minimum required tests |
| --- | --- |
| Shared component | Component test plus keyboard and focus behavior |
| Flow with states | Loading, empty, error, partial, cancelled, confirmed paths |
| API contract | Input validation, authorization, stable state names, error categories |
| Tenant-owned resource | Ownership check with a foreign identifier, expected refusal |
| Agent tool | Schema validation, permission decision, timeout, cancellation |
| Google integration | Success, expired token, missing scope, partial failure, rate limit |
| Undo | Full revert, partial revert, repeated request |
| Accessibility | Automated check plus keyboard-only pass on the changed screen |

Rules:

- Vitest for unit and integration. Playwright for end-to-end.
- A passing mock is not proof of a working integration.
- Every fix for a real defect gains a regression test.
- Tests never contain real secrets or real personal data.

## 15. Quality Gates

A change is not done until all of these hold.

1. TypeScript compiles with strict mode and no new errors.
2. Lint passes with no new warnings.
3. The relevant tests in section 14 pass from an actual run.
4. The build succeeds.
5. Server-side authorization is enforced for every new tenant-owned read and write.
6. No secret is exposed in client payloads, logs, or artifacts.
7. Accessibility checks pass on changed screens.
8. Indonesian and English render correctly on changed screens.
9. New shared patterns are documented in the owning document.

Release is blocked when any primary demo path fabricates a result, skips confirmation for a consequential action, cannot report partial completion, leaks credentials or private data, exposes reasoning traces, fails an authorization check, or cannot recover from a timeout.

## 16. Git and Commit Rules

- Work on the `dev` branch or a short-lived branch from it. Never commit directly to `main`.
- Commit only files relevant to the change. Do not stage everything blindly.
- Commit messages state what changed and why, in imperative mood, under 72 characters for the subject.
- Never commit `.env` files, credentials, tokens, camera captures, or personal data.
- Never force push, reset hard, or delete branches without explicit instruction.
- Never skip hooks.
- Secret scanning and push protection stay enabled.
- If a secret is ever committed, rotate it first, then remove it from history.

## 17. Documentation Update Rules

| Trigger | Required update |
| --- | --- |
| New or changed product requirement | `.agents/prd.md` |
| New or changed engineering rule | `.agents/rules.md` |
| New threat, mitigation, or privacy decision | `.agents/security.md` |
| New table, column, index, or lifecycle change | `.agents/db_schema.md` |
| New visual pattern, token, or component | `.agents/design.md` |
| New or changed feature behavior | the matching `.agents/features/*.md` |
| Verified frontend defect and fix | `.agents/debug-henix.md` |
| Verified backend defect and fix | `.agents/debug-zaltech.md` |

Rules:

- `.agents/` is the canonical guidance directory. Do not create a divergent copy elsewhere.
- `AGENTS.md` lives only at the repository root and stays short.
- Debug files record verified issues only. No speculation, no progress notes, no invented incidents.
- Unresolved decisions go under Open Questions, not into the body as an assumption.
- Use relative repository paths. Never write an absolute local path such as a drive letter.
- Do not use em dash characters.
- Do not add example code or screenshots that imply functionality which does not exist yet.

## 18. MVP Scope Protection

- Build the `.agents/prd.md` section 8 flow end to end before adding anything else.
- A new idea goes to `.agents/prd.md` section 25 Future Scope, not into the sprint.
- A deferred item enters MVP only when every item in section 7 In Scope is verified.
- Refactors that do not serve an MVP requirement are deferred.
- Depth on one flow beats breadth across many.
- Reject additional configurability, abstraction layers, and defensive code beyond what a stated requirement needs.

## 19. Prohibited Features

Never implement, promise, or imply any of these.

| Prohibited | Reason |
| --- | --- |
| Operating system or desktop control | Outside a web page's capability and outside product scope |
| Native application control | Same |
| Automation of arbitrary third-party websites | No consent, unsafe, unstable |
| Browser-level automation of the Google Docs website | Aksa uses Google APIs |
| Iframed or visually copied Google interface | Original Aksa interface only |
| Webcam eye tracking claims | Not implemented; head pose and facial gesture only |
| Storing or transmitting raw camera frames | Privacy violation |
| Autonomous checkout, payment, or banking actions | Excessive agency |
| Autonomous email sending without a reviewed confirmation | Excessive agency |
| Deleting Google content | Out of MVP, irreversible |
| Displaying or storing chain-of-thought | Prohibited by product principle |
| Fabricated tool output, citations, or completion | Prohibited by product principle |
| Custom password hashing or custom session cryptography | Use an established library |
| Client-side authorization as the only guard | Trivially bypassed |
| Trusting a `userId` or `workspaceId` from client input | Broken object level authorization |
| Executing content retrieved from the web, email, or documents | Prompt injection and code execution risk |
| Medical, legal, or financial advice | Out of competence |
| Hardcoded provider request-per-minute limits | Unverifiable and quota model is dynamic |

# Agent Orchestration

The server-side loop that turns a submitted command into verified work. Supports steps 9, 12, 13, and 14 of the primary flow in `.agents/prd.md` section 8.

## Purpose

Take one plain-language command, decide which allowed tools can satisfy it, run them under a bound, ask the user before anything consequential, verify what actually happened, and report the truth including partial results.

## User Stories

- As a user, I say what I want and Aksa works out the steps.
- As a user, I see which step is running and what it is touching.
- As a user, I approve or reject a change before it happens.
- As a user, I stop a running task and keep the work that already finished.
- As a user, I am told when only part of my request succeeded, and which part.
- As a user, I never see a claimed result that did not happen.
- As a user, I am not shown the model's internal thinking.
- As a user, my task still works when the primary model provider is unavailable.

## Scope

- Intent routing from a submitted command.
- A planner that produces a bounded, ordered list of steps.
- A typed tool registry grouped by capability, with per-intent allowlists.
- Read-only tools by default; write tools gated by confirmation.
- Provider routing with a configured fallback.
- Zod schemas for every tool argument set, every tool result, and every structured model output.
- Confirmation interruption mid-loop.
- Cancellation checked before every tool call.
- Per-call timeouts, loop iteration limit, and wall-clock limit.
- Verification of consequential results before reporting success.
- Partial completion reporting with named items.
- User-visible activity derived only from real tool calls.
- Provider usage recording for budget enforcement.

## Non-Goals

- Multi-agent negotiation, agent-to-agent messaging over a network, or an autonomous agent marketplace.
- Long-running background or scheduled tasks. A task belongs to a session.
- Persistent cross-task memory or a personal knowledge base. Task context is scoped to one task.
- Model fine-tuning or training on user data.
- Code generation or execution of any kind.
- User-authored tools.
- Calling several providers per request to appear multi-model.

## User Flow

| Step | Trigger | Aksa |
| --- | --- | --- |
| 1 | Command submitted from voice transcript or text | Creates the task with an idempotency key, state `understanding` |
| 2 | Intent routing | Resolves an intent and its tool allowlist, or returns an unsupported-request result |
| 3 | Planning | Produces an ordered step list within the iteration bound, persists the steps |
| 4 | Execution begins | State becomes `executing`, first activity event written |
| 5 | Before each tool call | Checks cancellation, budget, and tool permission |
| 6 | Read tool | Executes, validates the result, records the tool call and activity event |
| 7 | Write tool reached | State becomes `waiting_confirmation`, a single-use confirmation is created, execution halts |
| 8 | User approves | Confirmation moves to `consumed` inside the execution transaction, tool runs once |
| 9 | After a consequential call | Reads the result back and verifies it, creates an undo record where the reverse is supported |
| 10 | Loop continues | Repeats steps 5 to 9 until the plan completes or a bound is reached |
| 11 | Completion | State becomes `completed`, `partially_completed`, `failed`, or `cancelled` with a result summary |
| 12 | User reviews | Activity and History show the real steps, per `.agents/features/history-activity.md` |

The loop never proceeds past a `waiting_confirmation` state without an owner-approved confirmation.

## UI States

The interface shows exactly one state per task, using the copy and announcements in `.agents/design.md` section 8.

| Product state | Persisted `tasks.state` | Available user actions |
| --- | --- | --- |
| `Understanding` | `understanding` | Cancel |
| `Executing` | `executing` | Cancel, view scope |
| `Waiting for confirmation` | `waiting_confirmation` | Approve, edit, cancel |
| `Completed` | `completed` | View result, Undo when available |
| `Partially completed` | `partially_completed` | Review, retry remaining |
| `Failed` | `failed` | Retry, edit, cancel |
| `Cancelled` | `cancelled` | Edit, start again |
| `Undo available` | `completed` with an `available` undo record | Undo, dismiss |

`Idle`, `Listening`, and `Transcribing` are client-only input states and are never persisted.

## Frontend Responsibilities

Owner: Henix.

- Command bar that submits a transcript or typed text and shows the active input mode.
- Rendering the single current task state received from the server.
- Cancel control available from the moment execution starts.
- Confirmation surface showing the action, the named scope items, the consequence, and whether Undo will exist.
- Approve, edit, and cancel choices, with the deliberate-approval guard from `.agents/features/accessibility-controls.md`.
- Activity list rendering the ordered steps and outcomes it receives.
- Partial-completion presentation with counts and item names.
- Undo affordance when the server reports it as available.
- Live-region announcements for state changes, assertive for confirmation and failure.
- Localized copy for every state, error category, and announcement.
- Frontend tests: state rendering, cancel availability, confirmation choices, partial presentation, announcement behavior.

The frontend never decides tool permission, never calls a model, and never infers a state the server did not report.

## Backend Responsibilities

Owner: Zaltech.

- Task creation with an idempotency key that blocks duplicate execution from a double submit.
- Intent routing and the per-intent tool allowlist.
- Planner invocation and step persistence.
- The tool registry: names, kinds, argument schemas, result schemas, and required Google scopes.
- Per-call permission decisions made outside the model.
- Budget and rate checks before each provider call, reading aggregates from `provider_usage`.
- Provider abstraction covering Vertex AI primary and the OpenAI-compatible fallback, with retry, backoff, jitter, `Retry-After` handling, circuit breaker, queue depth, and concurrency limits.
- Zod validation of every model output and tool argument set before use.
- Untrusted-content delimiting for anything retrieved from the web, Google, or a prior artifact.
- Confirmation creation, single-use consumption, and expiry enforcement.
- Verification reads after consequential calls.
- Undo record creation inside the execution transaction where the reverse is supported.
- Cancellation checks before every tool call.
- Timeout enforcement per call and per loop.
- Stable error categories safe for display.
- Activity event writing, only after a real tool call.
- Audit log entries for `confirmation_approved`, `consequential_tool_executed`, `budget_blocked`, and `authorization_denied`.
- Backend tests per `.agents/rules.md` section 14, including agent tool schema validation, permission decisions, timeout, cancellation, and fallback.

## Agent Tools

The registry is an allowlist. An unlisted tool cannot be called. Every tool declares a kind, an argument schema, a result schema, and the Google scope it needs.

| Group | Tool | Kind | Confirmation | Undo | Detail |
| --- | --- | --- | --- | --- | --- |
| Drive | `drive.search` | read | No | n/a | See `.agents/features/google-workspace.md` |
| Drive | `drive.file_metadata` | read | No | n/a | |
| Drive | `drive.move` | write | Yes | `drive_move` | |
| Drive | `drive.rename` | write | Yes | `drive_rename` | |
| Drive | `drive.create_folder` | write | Yes | No | Reverse would be a delete, which is out of MVP |
| Docs | `docs.read` | read | No | n/a | |
| Docs | `docs.apply_edit` | write | Yes | `docs_edit` | Undo only when prior content was captured |
| Sheets | `sheets.read_range` | read | No | n/a | |
| Sheets | `sheets.write_range` | write | Yes | `sheets_range_write` | |
| Gmail | `gmail.list_recent` | read | No | n/a | |
| Gmail | `gmail.read_message` | read | No | n/a | |
| Gmail | `gmail.create_draft` | write | Yes | `gmail_draft_delete` | Sending is out of MVP |
| Search | `search.grounded_query` | search | No | n/a | See `.agents/features/web-search-artifacts.md` |
| Artifact | `artifact.create` | write | No | No | Aksa-internal, not external data, so no confirmation |
| Workspace | `workspace.open_view` | read | No | n/a | Navigation intent only, no data change |

Rules:

1. A `write` tool executes only with a `consumed` confirmation recorded in the same transaction.
2. A tool whose required Google scope is not granted fails with a named permission error. It never substitutes a broader scope.
3. Argument values are validated by schema before execution. An invalid argument set is a failure, not a corrected guess.
4. Tool results are validated by schema before the loop continues.
5. No tool executes code, evaluates model output, or fetches a URL discovered inside retrieved content.
6. `artifact.create` writes Aksa-owned data only and cannot touch Google data.

### Subagent boundaries

MVP uses one orchestrator plus one search subagent.

| Boundary | Rule |
| --- | --- |
| Invocation | In-process function call with typed input and output, not a network agent protocol |
| Tools | The search subagent may call `search.grounded_query` and `artifact.create` only |
| Escalation | A subagent cannot widen its own allowlist, request a scope, or raise a budget |
| Budget | A subagent's provider usage counts against the caller's task budget |
| Confirmation | A subagent cannot create or consume a confirmation |
| Output | Returned as validated data to the orchestrator, never written directly to the task state |

## Data Requirements

Tables from `.agents/db_schema.md`: `tasks`, `task_steps`, `tool_calls`, `confirmations`, `undo_records`, `activity_events`, `provider_usage`, `artifacts`, `audit_logs`.

| Need | Detail |
| --- | --- |
| Task record | `tasks` with `input_mode`, `command_text`, `intent`, `state`, `idempotency_key`, item counts |
| Plan | `task_steps` ordered by `sequence`, unique per task |
| Evidence | `tool_calls` written only after real execution, with `verified` and `outcome` |
| Approval | `confirmations` single-use, expiring, with `scope_items` recording exactly what was shown |
| Reversal | `undo_records` created inside the execution transaction, one per tool call |
| Visible record | `activity_events` append-only per task |
| Cost | `provider_usage` per provider call, written outside the task transaction |
| Security trail | `audit_logs` for approvals, consequential executions, budget blocks, and denials |

Never stored: prompt text, model reasoning traces, raw provider responses, or verbatim document and email content in `tool_calls.arguments_summary`.

Transaction boundaries are defined in `.agents/db_schema.md` section 6. The external effect happens before the success record is written.

## Security and Permissions

Requirements from `.agents/security.md` section 5, mapped to the OWASP Top 10 for Agentic Applications.

| Control | Requirement |
| --- | --- |
| Untrusted content | Web, email, document, sheet, and artifact content enters a prompt as delimited data, never as instructions. ASI01, LLM01 |
| Tool allowlist | Per-intent allowlist enforced server-side. ASI02 |
| Typed arguments | Zod validation before execution. ASI02 |
| Authorization outside the model | The model proposes; the server decides, using the session. ASI03 |
| Least identity | The agent never holds broader access than the user's own connection. No service-account access to user data. ASI03 |
| Provider validation | Provider and tool responses validated by schema. ASI04 |
| No code execution | Model output is never evaluated, rendered as HTML, or used to build a shell command or SQL string. ASI05 |
| Scoped context | Task context is limited to one task. Stored content re-enters only as untrusted data. ASI06 |
| Subagent limits | A subagent cannot widen tools, scopes, or budget. ASI07 |
| Bounded loop | Iteration limit, wall-clock limit, verification after each consequential step, partial reporting instead of forced continuation. ASI08 |
| Meaningful confirmation | Named items and counts, external-change disclosure, Undo availability stated, no dwell-only approval. ASI09 |
| Audit and breaker | Append-only tool audit trail, circuit breaker on repeated failures, hard prohibition on payment and send-without-confirmation. ASI10 |
| Safe output | Model text is rendered as safe text. LLM05 |
| No leakage | Minimal DTOs, redacted logs, no content in error messages. LLM02 |
| No unsupported claims | Grounded sources only; no artifact without a source. LLM09 |
| No reasoning exposure | Reasoning traces are never displayed, logged, or stored |
| No fabrication | A failed tool yields a named failure, never a plausible fake result |

Additional rules:

- A confirmation identifier from another account, already consumed, or expired is rejected. Covered by SEC-T6 and SEC-T7.
- Provider fallback never widens tool permissions, skips confirmation, or bypasses a budget check.
- Duplicate submission is blocked by the task idempotency key.

## Errors and Recovery

| Failure | Behavior | User options |
| --- | --- | --- |
| Intent not recognized | Task ends as `failed` with an unsupported-request category, no tools run | Rephrase, type, choose a supported action |
| Request outside product scope | Refused with a plain reason, never simulated | Choose a supported action |
| Planner output fails schema validation | Task ends as `failed`, no tools run | Retry, rephrase |
| Tool argument fails schema validation | That step fails, prior steps preserved | Retry step, cancel |
| Tool permission denied | Named permission failure identifying the missing capability | Grant the narrower scope, cancel |
| Missing Google connection | Only the Google-dependent step fails, naming the missing connection | Connect Google, cancel |
| Expired Google token | Connection marked `needs_reconnect`, no silent retry | Reconnect, cancel |
| Provider timeout | Step ends, completed steps kept, task reports partial | Retry remaining, cancel |
| Provider rate limit or capacity error | Retries with backoff and jitter within the configured limit, then reports the delay honestly | Wait and retry, cancel |
| Circuit breaker open | Routes to the fallback provider, or reports an honest unavailable state | Retry later, cancel |
| Budget or daily ceiling reached | Blocks before the provider call and states the limit | Wait for reset, reduce scope |
| Iteration limit reached | Task reports partial completion with what finished | Retry remaining, refine the request |
| Wall-clock limit reached | Same as the iteration limit | Same |
| Verification fails after a write | Reports the step as failed even though the call returned, never reports success | Review the item, retry, undo |
| Confirmation expires unanswered | Task moves to `cancelled`, nothing executed | Start again |
| Confirmation replayed | Rejected as already consumed, no second execution | None needed |
| Cancellation requested | Stops before the next tool call, keeps finished steps, state `cancelled` | Undo finished steps if reversible, edit and restart |
| Undo unsupported | Stated in the confirmation before execution | Accept, or cancel before approving |
| Undo partial failure | Reports which items reverted and which did not | Retry undo, review items |
| Duplicate submission | Second submission returns the existing task, no second execution | None needed |

Every failure category is stable and safe to display. No provider message, stack trace, or internal identifier reaches the client.

## Accessibility

- One visible state at a time, with text plus an icon.
- Cancel is reachable by keyboard, pointer, and head control from the moment execution begins.
- Confirmation dialogs are named, receive focus on a non-destructive element, and return focus to the trigger on close.
- Confirmation approval requires a deliberate signal, not dwell momentum.
- State changes announce through a polite live region. Confirmation and failure announce assertively.
- Progress is never estimated. When verification is pending, the copy says so rather than showing a fake percentage.
- Partial completion states counts and item names in text, not only in a chart or color.
- Long activity lists remain keyboard navigable with visible focus.
- Announcements are localized and never mix languages.

## Acceptance Criteria

1. A submitted command creates exactly one task, and a double submit does not create a second execution.
2. An unsupported request is refused with a reason and runs no tools.
3. A plan is persisted as ordered steps before execution begins.
4. Read-only tools run without a confirmation.
5. Every write tool halts the loop and creates a single-use confirmation before execution.
6. An approved confirmation authorizes exactly one execution and cannot be replayed.
7. An unanswered confirmation expires server-side and cancels the task.
8. Cancellation stops before the next tool call and preserves finished steps.
9. A task that finishes some steps reports `partially_completed` with named items and counts.
10. Every activity step the user sees corresponds to a real `tool_calls` row.
11. A consequential result is read back and verified before success is reported.
12. An undo record exists after every reversible consequential call, and no undo record exists where the confirmation said Undo was unsupported.
13. A model output that fails schema validation causes a failure, not a corrected guess.
14. Retrieved external content instructing an action does not cause that action.
15. Provider failure falls back to the configured alternate without changing tool permissions or skipping confirmation.
16. Reaching a budget ceiling blocks the provider call and states the limit.
17. Iteration and wall-clock limits produce partial completion, never an unbounded loop.
18. No reasoning trace appears in any response, log, or stored row.
19. A confirmation identifier from another account is refused.
20. `provider_usage` records every provider call with its outcome and retry count.

## Test Scenarios

| ID | Scenario | Expected |
| --- | --- | --- |
| AG-1 | Submit the same command twice within a second | One task, one execution |
| AG-2 | Submit a command asking Aksa to control another website | Refused with a scope reason, no tools run |
| AG-3 | Submit a read-only Drive search | Runs without a confirmation |
| AG-4 | Submit a Drive move of 12 files | Confirmation lists 12 named items before execution |
| AG-5 | Approve the same confirmation identifier twice | One execution, second rejected, SEC-T6 |
| AG-6 | Submit an expired confirmation identifier | Rejected, SEC-T7 |
| AG-7 | Submit another account's confirmation identifier | Not found |
| AG-8 | Cancel during step 2 of 5 | Stops before step 3, reports two completed |
| AG-9 | Force a tool timeout on step 3 of 5 | Partial completion with steps 1 and 2 named |
| AG-10 | Force a schema-invalid planner output | Task failed, zero tool calls recorded |
| AG-11 | Force a schema-invalid tool argument set | That step fails, prior steps intact |
| AG-12 | Retrieve a webpage containing an instruction to move files | No move attempted, no confirmation created |
| AG-13 | Retrieve an email containing an instruction to send a reply | No draft or send attempted |
| AG-14 | Force a `429` from the primary provider | Backoff with jitter, then fallback or honest delay state |
| AG-15 | Open the circuit breaker with repeated failures | Fallback used, `provider_usage.outcome` records `circuit_open` |
| AG-16 | Exceed the daily cost ceiling | Provider call blocked, `budget_blocked` recorded in `provider_usage` and `audit_logs` |
| AG-17 | Set the iteration limit to 2 and submit a 5-step request | Partial completion after 2 steps |
| AG-18 | Make the verification read fail after a successful Sheets write | Step reported failed, no false success |
| AG-19 | Complete a Drive move, then inspect `undo_records` | One `available` record for that `tool_call_id` |
| AG-20 | Complete a folder creation, then check for an undo record | None, and the confirmation stated Undo was unsupported |
| AG-21 | Inspect every response and log line for a full task | No reasoning trace, no prompt text, no provider payload |
| AG-22 | Run a search task through the subagent, then attempt a write from it | Write refused, allowlist not widened |
| AG-23 | Compare `activity_events` count to `tool_calls` count for a task | Every tool-referencing event maps to a real tool call |

## Demo Scenario

Minutes 5 to 7.5 of the pitch in `.agents/prd.md` section 23.

1. Say the search request. Show `Understanding`, then `Executing` with the current step visible.
2. Show the grounded search step and the artifact produced with citations.
3. Say a Drive move request. Show the loop halting at `Waiting for confirmation` with 12 named items.
4. Approve deliberately. Show `Completed` and `Undo available`.
5. Use Undo. Show the item-level revert result.
6. Open Activity. Point out that every listed step maps to a real executed tool call and that no reasoning is shown.
7. If time allows, start a task and cancel it to show partial completion.

Do not narrate a step Aksa did not run. If a provider fails live, show the honest failure state and the retry path rather than switching to a recording.

## Open Questions

| ID | Question | Blocks |
| --- | --- | --- |
| AGQ-1 | Default iteration limit and wall-clock limit values for the demo deployment. | Acceptance criterion 17 |
| AGQ-2 | Per-task, per-user, per-workspace, and daily budget values. Tracked as SQ-5. | Acceptance criterion 16 |
| AGQ-3 | Which Gemini Flash-Lite class model identifier is used as the default orchestrator, confirmed against Vertex AI availability in the deployment region at build time. | Provider routing |
| AGQ-4 | Whether the grounded search step uses the same model as the orchestrator or a separate search-capable model. | Search subagent |
| AGQ-5 | Whether the fallback provider is enabled for the demo, given that a text-only fallback cannot perform grounded search. | Provider routing |
| AGQ-6 | Retry count and backoff ceiling per provider. | Errors and recovery |
| AGQ-7 | Whether `retry remaining` re-plans from scratch or resumes the existing plan from the first incomplete step. | Partial completion |
| AGQ-8 | Whether the deliberate approval signal is a longer dwell, a gesture plus dwell combination, or a spoken word. Tracked as ACQ-3. | Accessibility |

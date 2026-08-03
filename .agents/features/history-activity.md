# History and Activity

The record of what Aksa did, and the controls to review, reverse, or remove it. Supports steps 15 and 16 of the primary flow in `.agents/prd.md` section 8.

## Purpose

Let a user verify that work actually happened, see the real steps behind it, reverse what is reversible, and delete what they no longer want kept.

## User Stories

- As a user, I see every task I asked for, newest first.
- As a user, I open a task and see the ordered steps Aksa really ran.
- As a user, I find a past answer and its sources without searching again.
- As a user, I see plainly which tasks only partly succeeded and which items are affected.
- As a user, I reverse a completed action and see exactly which items reverted.
- As a user, I delete a task and its results.
- As a user, I am confident nobody else can read my history.
- As a user, I never see the model's internal thinking.

## Scope

- Task history list with command summary, state, and timestamp.
- Task detail view with ordered activity steps and their outcomes.
- Artifact list per task with source lists.
- Filters by state and by date.
- Retention policy applied by a scheduled purge.
- Task deletion cascading to steps, tool calls, artifacts, sources, activity events, confirmations, and undo records.
- Partial completion presentation with named items and counts.
- Failed and cancelled task presentation.
- Undo from a completed task, with item-level results.
- Server-side ownership checks on every read and write.
- Explicit prohibition on displaying or storing model reasoning.

## Non-Goals

- Editing a past task or its artifact. A revision is a new task.
- Restoring a deleted task. Deletion is final once the purge runs.
- Sharing a task or artifact with another account.
- Exporting history. Deferred per `.agents/prd.md` section 25.
- Cross-workspace or cross-account history views.
- Displaying token counts, provider names, or cost by default. That data lives in `provider_usage` for operators, not in the user-facing activity list.
- Re-running a task automatically. Retry is an explicit user action.
- Search across history bodies in MVP. Filters only.

## User Flow

### Review

| Step | User | Aksa |
| --- | --- | --- |
| 1 | Opens History from the workspace shell | Lists the user's tasks in this workspace, newest first |
| 2 | Applies a state or date filter | Filters the list server-side, scoped to the session owner |
| 3 | Selects a task | Opens the detail view with the command, the outcome, and the ordered steps |
| 4 | Reads the steps | Shows each step name, the item it touched, the outcome, and the duration |
| 5 | Opens an artifact | Shows the stored body and its source list unchanged |
| 6 | Sees a partially completed task | Shows named completed items and named remaining items with counts |

### Undo

| Step | User | Aksa |
| --- | --- | --- |
| 1 | Sees `Undo available` on a completed task | States which action can be reversed and the remaining availability |
| 2 | Activates Undo | Verifies ownership and that the undo record is still `available` |
| 3 | Waits | Applies the reverse operation and verifies the result |
| 4 | Sees the result | Reports `applied` or `partially_applied` with named reverted and non-reverted items |
| 5 | Reads the record | The Undo itself appears as an activity event and a tool call |

### Delete

| Step | User | Aksa |
| --- | --- | --- |
| 1 | Chooses `Delete task` | Confirms what will be removed, including artifacts and sources |
| 2 | Approves | Soft-deletes the task, making it and its children invisible to every read path |
| 3 | Later | The scheduled purge hard-deletes the subtree, and an audit entry records the deletion |

## UI States

| Surface | States |
| --- | --- |
| History list | loading, empty, results, filtered empty, load failed |
| Filter controls | default, active filter, cleared |
| Task detail | loading, loaded, load failed, not found |
| Step list | pending, running, succeeded, failed, skipped, cancelled |
| Task outcome | completed, partially completed with counts, failed, cancelled |
| Artifact | ready, load failed, deleted |
| Undo | available with remaining window, applying, applied, partially applied with named items, failed, expired, unsupported |
| Delete | confirmation pending, deleting, deleted, failed |

Every state carries text plus an icon. Partial results always state counts and item names in text.

## Frontend Responsibilities

Owner: Henix.

- History route and list layout, newest first, with a clear empty state.
- Filter controls for state and date, keyboard operable.
- Task detail layout: command, outcome, ordered step list, artifact list.
- Step presentation showing name, affected item, outcome, and duration in product language.
- Partial-completion presentation with named items and counts.
- Artifact presentation reusing the components in `.agents/features/web-search-artifacts.md`.
- Undo affordance rendered only when the server reports availability, stating the remaining window without a pressuring countdown.
- Item-level Undo result presentation.
- Delete confirmation stating exactly what will be removed.
- Focus management on list-to-detail navigation and on dialog open and close.
- Localized copy, localized dates and times, and localized counts with correct plural forms.
- Frontend tests: list and empty states, filter behavior, detail rendering, partial presentation, Undo states, delete confirmation, keyboard navigation, long command text, Indonesian and English layout.

The frontend renders the record it receives. It never computes a task outcome, never decides Undo availability, and never displays a step the server did not send.

## Backend Responsibilities

Owner: Zaltech.

- History list endpoint scoped to the session user and workspace, paginated, newest first.
- Filter handling server-side, with filters applied inside the ownership-scoped query.
- Task detail endpoint returning the task, its ordered steps, its activity events, and its artifact list as minimal DTOs.
- Activity event ordering by `sequence`, append-only per task.
- Undo availability computation from `undo_records.state` and `expires_at`.
- Undo application: ownership check, `available` state check, reverse operation, verification, item-level result, state transition to `applied` or `partially_applied`.
- Undo idempotency so a repeated request is a no-op with an honest response.
- Task deletion: soft delete, then a scheduled purge cascading to all children.
- Retention purge job for tasks, artifacts, sources, activity, and provider usage.
- Expiry sweep marking undo records `expired`.
- Audit log entries for `undo_applied` and `record_deleted`.
- Exclusion of soft-deleted and expired records from every read path.
- Backend tests: ownership on every read, filter scoping, ordering, Undo full and partial and repeated, deletion cascade, purge, expiry sweep, soft-delete invisibility.

## Agent Tools

This feature exposes no new agent tool. History and Activity are user-facing records, not agent capabilities.

| Rule | Detail |
| --- | --- |
| No agent read | The agent does not read History to build context. Task context is scoped to one task, per ASI06 in `.agents/security.md` section 5 |
| No agent write | The agent does not create, edit, or delete a history record. Records are written by the orchestrator as a side effect of real execution |
| Undo is a user action | Undo is triggered by the user, not planned by the model. The reverse operation runs as a recorded tool call |
| No cross-task memory | A past artifact re-enters a prompt only if the user explicitly references it, and then only as untrusted data |

## Data Requirements

Tables from `.agents/db_schema.md`: `tasks`, `task_steps`, `tool_calls`, `activity_events`, `artifacts`, `artifact_sources`, `confirmations`, `undo_records`, `audit_logs`.

| Need | Detail |
| --- | --- |
| List | `tasks` filtered by `user_id`, `workspace_id`, `deleted_at IS NULL`, ordered by `created_at` |
| Outcome | `tasks.state`, `result_summary`, `items_total`, `items_completed` |
| Steps | `task_steps` ordered by `sequence` |
| Visible record | `activity_events` ordered by `sequence`, each optionally referencing a real `tool_call_id` |
| Evidence | `tool_calls` as the source of truth behind every activity event |
| Results | `artifacts` with `artifact_sources` ordered by `position` |
| Approval record | `confirmations` retained as evidence that approval happened, with the `scope_items` shown |
| Reversal | `undo_records` with `state`, `items_total`, `items_reverted`, `expires_at` |
| Security trail | `audit_logs` for Undo and deletion |

Never stored or displayed: model reasoning traces, prompt text, provider raw responses, or verbatim document and email content in `tool_calls.arguments_summary`.

Displayed by default: step name, affected item, outcome, timestamp, duration. Not displayed by default: provider name, model identifier, token counts, cost.

## Security and Permissions

Requirements from `.agents/security.md` sections 2 and 3. This feature is the primary IDOR surface in Aksa, because every object here has an identifier a user could try to change.

| Control | Requirement |
| --- | --- |
| Session-derived ownership | `user_id` and `workspace_id` come from the session. A client-supplied value is ignored |
| Not found, not forbidden | A foreign or missing object returns not found, with no hint that the identifier is real |
| Parent chain | Reading a step, activity event, artifact source, or undo record verifies the task, workspace, and user using the denormalized ownership columns |
| Soft-deleted invisibility | Soft-deleted tasks and artifacts are absent from every read path |
| Expired invisibility | Expired undo records and confirmations are treated as absent where expiry means absence |
| Unguessable identifiers | UUID or equivalent, as defense in depth rather than as the control |
| Filter scoping | A filter is applied inside the ownership-scoped query, never as a client-trusted predicate |
| Pagination scoping | A page cursor cannot reach another owner's rows |
| Undo authorization | Undo verifies ownership and the `available` state before touching anything external |
| Undo idempotency | A repeated Undo request does not double-apply |
| Delete authorization | Deletion checks ownership in the `WHERE` clause and verifies the affected row count |
| Audit integrity | `audit_logs` is append-only and is never deleted by product code |
| No reasoning | No reasoning trace is stored in any row or returned in any response |

Covered security tests: SEC-T1, SEC-T2, SEC-T3, SEC-T4, SEC-T5, SEC-T8, SEC-T9, SEC-T11.

## Errors and Recovery

| Failure | Behavior | User options |
| --- | --- | --- |
| No tasks yet | Empty state explaining that completed tasks appear here, with one next action | Start a task |
| Filter matches nothing | Filtered empty state naming the active filter | Clear the filter |
| List load failed | Stable failure category, filters preserved | Retry |
| Task not found or foreign identifier | Not found, no distinction between the two | Return to the list |
| Detail load failed | Stable failure category | Retry |
| Artifact deleted but task present | Artifact slot states that the result was removed | None needed |
| Partially completed task | Named completed and remaining items with counts | Retry remaining, accept partial |
| Failed task | States the failure category and what was preserved | Retry, edit and restart |
| Cancelled task | States that it was cancelled and which steps finished | Undo finished steps if reversible, edit and restart |
| Undo expired | States that the window closed before the user relies on it | Manual correction path |
| Undo unsupported | Stated in the original confirmation, and restated here | Manual correction path |
| Undo already applied | Honest no-op response | None needed |
| Undo partial failure | Names which items reverted and which did not | Retry Undo, review items |
| Undo failed entirely | States that nothing reverted, original state unchanged | Retry, manual correction |
| Undo requested for another account's record | Not found, SEC-T11 | None |
| Delete failed | States that nothing was removed | Retry |
| Session expired on the history route | Preserves the active filter | Sign in, resume |

No failure here changes external Google data. Undo is the only action in this feature that touches anything outside Aksa.

## Accessibility

- The history list is a real list with one H1 on the page and a valid heading order.
- Filters are labelled, keyboard operable, and their active state is announced.
- List-to-detail navigation moves focus to the detail heading, and returning restores focus to the originating list item.
- The step list is keyboard navigable with visible focus, and each step's outcome is text plus an icon.
- Partial results state counts and item names in text, never only in color or a chart.
- Undo availability is stated as remaining time in text, without an animated countdown that pressures the user. Under `prefers-reduced-motion` there is no animation at all.
- The delete confirmation names exactly what will be removed and opens with focus on a non-destructive element.
- Undo and delete both require a deliberate signal, not dwell momentum.
- Timestamps and durations are localized text with correct plural forms.
- Long command text and long item names wrap without clipping and without horizontal scrolling at 320 px.
- All targets are at least 44 by 44 px with at least 8 px separation.
- State changes announce through a polite live region. Undo failure announces assertively.

## Acceptance Criteria

1. History lists the signed-in user's tasks in the current workspace, newest first.
2. Filters by state and by date apply server-side inside an ownership-scoped query.
3. A task detail view shows the command, the outcome, and the ordered activity steps.
4. Every displayed step corresponds to a real `tool_calls` row or to a non-tool lifecycle event.
5. Stored artifacts and their source lists are retrievable unchanged.
6. A partially completed task names both the completed and the remaining items with counts.
7. Failed and cancelled tasks state what was preserved.
8. Undo is offered only when the server reports an `available` undo record.
9. Undo reports item-level results, including a partial revert.
10. A repeated Undo request is an honest no-op.
11. An expired Undo window is stated before the user relies on it.
12. Deleting a task removes its steps, tool calls, artifacts, sources, activity events, confirmations, and undo records from every read path.
13. Requesting another account's task, artifact, history, or undo identifier returns not found.
14. A client-supplied `userId` or `workspaceId` in a history request is ignored in favor of the session.
15. A soft-deleted task and its artifacts return not found.
16. A page cursor cannot reach another owner's rows.
17. No reasoning trace, prompt text, or provider payload appears in any response or stored row.
18. `audit_logs` records every Undo application and every deletion.
19. Every state renders in Indonesian and English with correct plural forms.
20. Automated accessibility checks report zero critical violations on the history and detail views.

## Test Scenarios

| ID | Scenario | Expected |
| --- | --- | --- |
| HA-1 | Open History with zero tasks | Empty state with one next action |
| HA-2 | Filter by `partially_completed` | Only that state, scoped to the owner |
| HA-3 | Filter by a date range with no matches | Filtered empty state naming the filter |
| HA-4 | Open a completed search task | Command, outcome, ordered steps, artifact with sources |
| HA-5 | Compare displayed steps to `tool_calls` rows | Every tool-referencing step maps to a real row |
| HA-6 | Open a partially completed 12-file move | Named completed and remaining items with counts |
| HA-7 | Open a cancelled task | States which steps finished and what is reversible |
| HA-8 | Undo a Drive move | Files return to the prior parent, item-level result reported |
| HA-9 | Undo a Sheets range write | Prior values restored |
| HA-10 | Force a partial Undo where 3 of 12 items fail | Names the 9 reverted and the 3 not reverted |
| HA-11 | Activate Undo twice | One application, second is an honest no-op |
| HA-12 | Wait past the Undo window, then activate | States that the window closed, nothing attempted |
| HA-13 | Open a task whose confirmation stated Undo unsupported | No Undo affordance, reason restated |
| HA-14 | Request user B's task identifier | Not found, SEC-T1 |
| HA-15 | Enumerate random artifact identifiers | Not found for every foreign identifier, SEC-T2 |
| HA-16 | Request user B's history list by identifier | Not found, SEC-T3 |
| HA-17 | Call the history and detail endpoints unauthenticated | Rejected before any side effect, SEC-T4 |
| HA-18 | Send a history request with user B's `userId` and `workspaceId` in the body | Session values used, injected values ignored, SEC-T5 |
| HA-19 | Delete a task, then request it and its artifact | Not found for both, SEC-T8 |
| HA-20 | Modify a nested route parameter to a step under a foreign task | Not found, SEC-T9 |
| HA-21 | Request user B's undo record identifier | Not found, SEC-T11 |
| HA-22 | Craft a page cursor pointing past the owner's rows | No foreign rows returned |
| HA-23 | Delete a task, then check `audit_logs` | `record_deleted` entry present |
| HA-24 | Run the retention purge past the configured window | Expired tasks and artifacts hard deleted, audit log retained |
| HA-25 | Inspect every history response for reasoning or prompt text | None present |
| HA-26 | Render a task with a 500-character command in Indonesian at 320 px | Wraps cleanly, no overflow |
| HA-27 | Navigate list to detail and back by keyboard | Focus moves to the detail heading, then returns to the list item |
| HA-28 | Enable `prefers-reduced-motion` and view an available Undo | Remaining window shown as static text, no animation |

## Demo Scenario

Minutes 7.5 to 8.5 of the pitch in `.agents/prd.md` section 23.

1. Open History and show the two tasks from the demo: the grounded search and the Drive move.
2. Open the search task. Show the ordered steps and the stored artifact with its sources intact.
3. Open the Drive move task. Show the confirmation record, the executed step, and the verified outcome.
4. Point out that every step listed maps to a real tool call, and that no model reasoning is shown anywhere.
5. Show the Undo already applied earlier, with its item-level result recorded as its own activity event.
6. If a judge asks about privacy, show that requesting another identifier returns not found, and reference the SEC test list rather than claiming it works.

Prepared state: at least one completed task, one partially completed task, and one cancelled task so all three outcome presentations can be shown without waiting.

## Open Questions

| ID | Question | Blocks |
| --- | --- | --- |
| HAQ-1 | Undo availability window duration and whether it survives a reload. Tracked as OQ-6 and DQ-4. | Acceptance criteria 8 and 11 |
| HAQ-2 | Retention periods for tasks, artifacts, activity, and transcripts. Tracked as OQ-10 and SQ-3. | Scope |
| HAQ-3 | Soft delete or hard delete as the user-visible default. Tracked as SQ-4. | Delete flow |
| HAQ-4 | Whether `activity_events.label` stores a localization key or pre-rendered text per locale. Tracked as DQ-6. | Localization |
| HAQ-5 | Whether `retry remaining` re-plans from scratch or resumes the existing plan. Tracked as AGQ-7. | Partial completion |
| HAQ-6 | Page size and cursor scheme for the history list. | Acceptance criterion 16 |
| HAQ-7 | Whether the deliberate signal for Undo and delete matches the confirmation approval signal. Tracked as ACQ-3. | Accessibility |
| HAQ-8 | Whether history export enters scope, or stays in Future Scope. | Non-goals |

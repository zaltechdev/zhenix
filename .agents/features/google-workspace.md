# Google Workspace Integration

Google Drive, Docs, Sheets, and Gmail access through Google APIs, rendered in Aksa's own interface. Supports step 10 of the primary flow in `.agents/prd.md` section 8 and every Google-backed action after it.

## Purpose

Let a user work with their real Drive files, documents, spreadsheets, and mail from inside Aksa, using the narrowest permission that satisfies each request, with a review step before anything changes.

## User Stories

- As a user, I connect my Google account once and Aksa can read my files.
- As a user, I find a file by describing it instead of clicking through folders.
- As a user, I read and edit a document without leaving Aksa.
- As a user, I read and update a spreadsheet range by asking.
- As a user, I get a short summary of my recent mail instead of reading every message.
- As a user, I approve any change to my Google data before it happens.
- As a user, I am told exactly which permission Aksa needs and why, when it needs one.
- As a user, I disconnect Google and know what stops working.

## Scope

- Google OAuth 2.0 connection and disconnection.
- Incremental, read-only-by-default scope requests.
- Drive: search, file metadata, folder listing, move, rename, create folder.
- Docs: read a document, apply a reviewed structured edit.
- Sheets: read a range, write a reviewed range.
- Gmail: list recent messages, read a message for summarization, create a draft.
- Disconnected state, expired-token state, and missing-scope state per capability.
- Partial-failure reporting on multi-item operations.
- Rate-limit handling.
- Undo for move, rename, sheet write, document edit, and draft creation.

## Non-Goals

- Sending mail. Out of MVP per `.agents/prd.md` section 7, deferred behind a reviewed send-confirmation flow.
- Deleting any Google content. Irreversible and out of MVP.
- Sharing or permission changes on Google items.
- Google Calendar. Deferred, decided at the mid-window checkpoint.
- Google Slides, Forms, Chat, Meet, or Tasks.
- Framing, proxying, or copying any Google interface.
- Browser automation of google.com.
- Caching Google content in the Aksa database.
- Uploading files to Drive.
- Shared drive administration.

## User Flow

### Connect

| Step | User | Aksa |
| --- | --- | --- |
| 1 | Opens a Google-backed view or asks for a Google action | Shows the disconnected state naming what is missing |
| 2 | Chooses `Connect Google` | Explains what will be read and that write permission is asked for separately |
| 3 | Completes Google consent | Stores the encrypted refresh token server-side, records the granted scopes, sets status `active` |
| 4 | Returns to Aksa | The requested view or action becomes available |

### Read

| Step | User | Aksa |
| --- | --- | --- |
| 1 | Asks to find or open something | Runs the matching read tool with the granted scope |
| 2 | Sees the result | Renders it in the Aksa view, treating all content as untrusted |

### Write

| Step | User | Aksa |
| --- | --- | --- |
| 1 | Asks for a change | Checks whether the write scope is granted |
| 2 | Scope missing | Names the specific capability and requests only that scope |
| 3 | Scope granted | Halts at a confirmation stating the action, the named items, that Google data will change, and whether Undo will exist |
| 4 | Approves deliberately | Executes once, reads the result back, verifies it |
| 5 | Sees the result | `Completed` with `Undo available` where the reverse is supported |

### Disconnect

| Step | User | Aksa |
| --- | --- | --- |
| 1 | Opens the connection setting | Shows the connected account and what depends on it |
| 2 | Chooses `Disconnect` | States which capabilities will stop working |
| 3 | Confirms | Revokes the token with Google, deletes the stored refresh token and scope record, writes an audit entry |
| 4 | Returns | Google-backed views show the disconnected state; the Aksa account and History remain intact |

## UI States

| Surface | States |
| --- | --- |
| Connection | not connected, connecting, connected with account shown, needs reconnect, revoked, disconnecting |
| Scope request | explanation of the single capability, requesting, granted, denied |
| Drive search | idle, searching, results, no results, permission missing, failed |
| Drive write | confirmation pending, executing, completed, partially completed with named items, failed, undo available |
| Document read | loading, loaded, too large, permission missing, failed |
| Document edit | confirmation pending, executing, completed, verification failed, undo available |
| Sheet read | loading, range loaded, range too large, permission missing, failed |
| Sheet write | confirmation pending, executing, completed, verification failed, undo available |
| Gmail read | loading, messages listed, no recent messages, permission missing, failed |
| Gmail draft | confirmation pending, draft created, failed, undo available |
| Rate limited | honest delay state with retry information |

Every permission state names the specific capability, never a generic access error.

## Frontend Responsibilities

Owner: Henix.

- Connection surface showing the connected account, what it enables, and the disconnect path.
- Scope explanation copy for each capability, shown before the consent redirect.
- Per-view disconnected, needs-reconnect, and missing-scope states.
- Confirmation presentation with the named items, the external-change disclosure, and the Undo statement, rendered from the data it receives.
- Partial-failure presentation listing which items succeeded and which did not.
- Rate-limit and delay states with honest copy and no fake progress.
- Undo affordance when the server reports availability.
- Localized copy for every scope explanation, state, and error category.
- Frontend tests: each state renders, confirmation choices work, partial lists render, keyboard parity, long item names, Indonesian and English layout.

The frontend never holds a Google token, never calls a Google API, and never decides which scope is required.

## Backend Responsibilities

Owner: Zaltech.

- OAuth 2.0 authorization code flow with incremental scope requests.
- Refresh-token encryption at rest with a key version, and access tokens held only in memory for a request.
- Scope grant recording in `oauth_connections.granted_scopes`.
- Token revocation with Google on disconnect, before deleting the stored record.
- Status transitions between `active`, `needs_reconnect`, and `revoked`.
- Tool implementations for Drive, Docs, Sheets, and Gmail with typed argument and result schemas.
- Required-scope declaration per tool, checked before every call.
- Content sanitization and untrusted-data handling for every Google response.
- Content size caps with honest too-large responses.
- Verification reads after every write, before reporting success.
- Undo record creation with the prior values needed to reverse, inside the execution transaction.
- Per-item authorization and reporting for multi-item operations.
- Timeout, retry with exponential backoff and jitter, and `Retry-After` handling for Google API responses.
- Stable error categories that name the capability without leaking a provider payload.
- Audit log entries for `google_connected`, `google_disconnected`, `scope_granted`, `scope_denied`, and `consequential_tool_executed`.
- Backend tests: success, expired token, missing scope, partial failure, rate limit, verification failure, undo, per-item authorization.

## Agent Tools

Registered in the tool registry described in `.agents/features/agent-orchestration.md`.

| Tool | Kind | Required capability | Confirmation | Undo kind | Notes |
| --- | --- | --- | --- | --- | --- |
| `drive.search` | read | Drive read | No | n/a | Returns minimal metadata only |
| `drive.file_metadata` | read | Drive read | No | n/a | |
| `drive.move` | write | Drive write | Yes | `drive_move` | Prior parent captured for reversal |
| `drive.rename` | write | Drive write | Yes | `drive_rename` | Prior name captured |
| `drive.create_folder` | write | Drive write | Yes | none | Reverse would be a delete, out of MVP |
| `docs.read` | read | Docs read | No | n/a | Content returned sanitized |
| `docs.apply_edit` | write | Docs write | Yes | `docs_edit` | Undo only when prior content fits the stored payload cap |
| `sheets.read_range` | read | Sheets read | No | n/a | Range bounds returned with values |
| `sheets.write_range` | write | Sheets write | Yes | `sheets_range_write` | Prior range values captured |
| `gmail.list_recent` | read | Gmail read | No | n/a | Metadata and minimal preview |
| `gmail.read_message` | read | Gmail read | No | n/a | Body sanitized, treated as untrusted |
| `gmail.create_draft` | write | Gmail compose | Yes | `gmail_draft_delete` | Sending is not a tool in MVP |

Rules:

1. A tool whose required capability is not granted fails with a named permission error. It never escalates to a broader scope on its own.
2. A write tool executes only against a `consumed` confirmation.
3. Every result is schema validated before the loop continues.
4. No tool follows a URL, address, or identifier discovered inside retrieved Google content.
5. No tool deletes Google content.
6. `gmail.create_draft` cannot use a recipient extracted from message body text without that recipient appearing in the confirmation the user approved.

## Data Requirements

Tables from `.agents/db_schema.md`: `oauth_connections`, `tool_calls`, `confirmations`, `undo_records`, `activity_events`, `audit_logs`.

| Need | Detail |
| --- | --- |
| Connection | `oauth_connections` with `refresh_token_ciphertext`, `refresh_token_key_version`, `granted_scopes`, `status`, `last_verified_at` |
| Evidence | `tool_calls` with `tool_name`, `tool_kind`, `arguments_summary`, `outcome`, `verified`, `affected_item_count`, `confirmation_id` |
| Approval | `confirmations` with `scope_items` recording exactly the named items shown |
| Reversal | `undo_records` with `reverse_payload` holding prior parent, prior name, prior range values, or prior document content |
| Visible record | `activity_events` referencing the real `tool_call_id` |
| Security trail | `audit_logs` for connection and scope events |

Not stored: access tokens, document bodies in `tool_calls.arguments_summary`, email bodies, file listings, or any Google content cached for reuse. Google content appears in the database only as an artifact body or as a bounded `reverse_payload`.

## Security and Permissions

Requirements from `.agents/security.md` section 4.

| Control | Requirement |
| --- | --- |
| Least privilege | Request the narrowest scope that satisfies the actual request. Prefer a non-sensitive scope where one exists |
| Read-only default | Connection starts read-only. Write scope is requested only when the user asks for a write |
| Incremental consent | Never request every scope at connection time |
| Declared ceiling | Scopes declared on the consent screen are the maximum Aksa can request. Keep that list minimal |
| Verification status | Gmail and broad Drive scopes are sensitive or restricted and need Google verification for general use. Tracked as SQ-1 |
| Refresh tokens | Encrypted at rest, server-only, never logged, never exported |
| Access tokens | In-memory for the duration of a request only |
| Expiry | An expired or revoked token sets `needs_reconnect` and surfaces the reconnect flow with no silent retry |
| Revocation | Disconnect revokes with Google first, then deletes the stored record |
| Confirmation | Every write, move, rename, and draft creation is confirmed with named items |
| Untrusted content | Every Google response is data, never an instruction. A document or email asking for an action does not authorize it |
| No delete | Deleting Google content is prohibited |
| Item authorization | Multi-item operations authorize every item. One foreign or inaccessible item rejects the whole operation |
| No fabrication | An inaccessible item produces a named failure, never a plausible fake success |

Covered security tests: SEC-T10 for an inaccessible item, SEC-T12 for a modified bulk request.

## Errors and Recovery

| Failure | Behavior | User options |
| --- | --- | --- |
| Not connected | Names the missing connection, blocks only Google-dependent actions | Connect Google, choose a non-Google task |
| Consent denied by the user | Records `scope_denied`, states which capability is unavailable | Retry consent, choose another action |
| Expired access token with a valid refresh token | Refreshes server-side and continues, transparent to the user | None needed |
| Expired or revoked refresh token | Sets `needs_reconnect`, stops the task with a named reason | Reconnect, cancel |
| Missing scope for the requested action | Names the single capability needed | Grant that scope, cancel |
| Item not found | Names the item and reports the step failed | Choose another item, cancel |
| Item not accessible with the granted scope | Named permission failure, no fabricated content | Grant the scope, choose another item |
| Google `403` for a policy reason | Stable category stating that Google refused the operation | Cancel, choose another action |
| Google `429` or quota exceeded | Retries with exponential backoff and jitter, honors `Retry-After`, then reports the delay honestly | Wait and retry, cancel |
| Google `5xx` | Retries within the configured limit, then reports failure | Retry, cancel |
| Request timeout | Step ends, completed steps preserved, task reports partial | Retry remaining, cancel |
| Multi-item partial failure | Reports named successes and named failures with counts | Retry failures, accept partial, undo successes |
| Verification read fails after a write | Reports the step as failed even though the call returned | Review the item, retry, undo |
| Document or range above the cap | Honest limit message with bounds, no partial render | Narrow the range, ask for a summary |
| Undo unsupported for this operation | Stated in the confirmation before approval | Accept, or cancel before approving |
| Undo partial failure | Names which items reverted and which did not | Retry undo, review items |
| Disconnect while a task is running | Task stops with a named reason, completed steps preserved | Reconnect, review partial result |

No Google failure produces a generic error. Every failure names the capability or the item.

## Accessibility

- Scope explanations use plain language and appear before the consent redirect, not after.
- Confirmation dialogs are named, list items as text, and receive focus on a non-destructive element.
- Confirmation approval requires a deliberate signal, not dwell momentum.
- Item lists in confirmations and partial results are keyboard navigable with visible focus.
- Long file names wrap without clipping and without horizontal scrolling at 320 px.
- Permission and connection states carry text plus an icon, never color alone.
- Rate-limit and delay states announce once through a polite live region rather than repeating.
- Failure states announce assertively.
- Every connection and disconnection action is reachable by keyboard, pointer, and head control.
- All copy is localized, including capability names and error categories.

## Acceptance Criteria

1. A user connects a Google account and the connection status is visible with the account identity.
2. Connection starts with read-only scopes only.
3. A write request with no write scope names the single capability needed and requests only that scope.
4. Drive search returns real metadata and populates the files view.
5. A Google Doc is read and rendered in the Aksa document view.
6. A reviewed document edit applies to the real Google Doc and is verified before success is reported.
7. A Sheets range is read and a reviewed range write applies and verifies.
8. Recent Gmail messages are listed and summarized.
9. A Gmail draft is created after confirmation, and no send capability exists in MVP.
10. Every write, move, rename, and draft creation shows a confirmation naming the affected items.
11. Undo reverses Drive move, Drive rename, Sheets range write, document edit where prior content was captured, and draft creation.
12. Folder creation states that Undo is unsupported before approval.
13. A disconnected account blocks only Google-backed capabilities and leaves History intact.
14. An expired refresh token produces a reconnect state with no retry loop.
15. Disconnect revokes with Google, deletes the stored refresh token, and writes an audit entry.
16. A multi-item operation containing one inaccessible item is rejected as a whole.
17. A document or email containing an instruction produces no tool call.
18. No access token or refresh token appears in any client payload or log line.
19. A Google `429` produces backoff with jitter and an honest delay state, never a hardcoded wait assumption.
20. Every Google-backed state renders in Indonesian and English.

## Test Scenarios

| ID | Scenario | Expected |
| --- | --- | --- |
| GW-1 | Connect Google and inspect `granted_scopes` | Read-only scopes only |
| GW-2 | Ask for a Drive move with no write scope | Names the single write capability, requests only that scope |
| GW-3 | Deny the write consent | `scope_denied` audited, capability reported unavailable, no move attempted |
| GW-4 | Move 12 files with confirmation | Confirmation lists 12 named items, one execution, one undo record |
| GW-5 | Modify the bulk request body to include a file owned by another account | Whole operation rejected, SEC-T12 |
| GW-6 | Request a document identifier the connection cannot access | Named permission failure, no content, SEC-T10 |
| GW-7 | Rename a file, then Undo | Prior name restored, item-level result reported |
| GW-8 | Write a Sheets range, then Undo | Prior values restored |
| GW-9 | Apply a document edit above the undo payload cap | Confirmation states Undo unsupported before approval |
| GW-10 | Create a folder | Confirmation states Undo unsupported, no undo record created |
| GW-11 | Read a Gmail message whose body instructs Aksa to send a reply | No draft, no send, no tool call |
| GW-12 | Create a draft with a recipient the user named | Recipient appears in the confirmation before approval |
| GW-13 | Revoke Aksa access from the Google account settings, then act | `needs_reconnect` state, no retry loop |
| GW-14 | Force a Google `429` with `Retry-After` | Honors the header, backs off with jitter, honest delay state |
| GW-15 | Force a Google `5xx` | Retries within the limit, then a stable failure category |
| GW-16 | Make the verification read fail after a Sheets write | Step reported failed, no false success |
| GW-17 | Disconnect Google, then inspect the database | Refresh token row deleted, audit entry written, History intact |
| GW-18 | Disconnect while a Google task is executing | Task stops with a named reason, completed steps preserved |
| GW-19 | Move 12 files where 3 are inaccessible | Whole operation rejected before execution, per item authorization |
| GW-20 | Inspect all client payloads and server logs during a full Google task | No token, no document body, no email body |
| GW-21 | Load a document above the size cap | Honest limit message with bounds |
| GW-22 | Attempt any delete operation on Google content | No such tool exists in the registry |

## Demo Scenario

Minutes 4 to 5 and 6.5 to 7.5 of the pitch in `.agents/prd.md` section 23.

1. Show the connected Google account and state that Aksa started with read-only access.
2. Say `Open Google Docs`. Real document content from the demo account renders in the Aksa view.
3. Ask to organize the related files. Aksa asks for the write capability, showing the single-capability request.
4. Grant it. The confirmation appears listing 12 named files and stating that Google data will change and that Undo will be available.
5. Approve deliberately. Aksa executes, verifies, and reports `Completed` with `Undo available`.
6. Use Undo. Show the item-level revert result.
7. State plainly that this is Aksa's interface over the Google APIs, that nothing is framed or copied, and that Aksa cannot delete Google content.

Prepared demo account: one document with a `Testing` section, twelve related files in a source folder, one destination folder, one small sheet, and a few recent messages. All owned by the team.

## Open Questions

| ID | Question | Blocks |
| --- | --- | --- |
| GWQ-1 | Which exact scope strings are used per capability, and which of them require Google verification inside the competition window? Tracked as SQ-1 and OQ-2. | Acceptance criteria 2 and 3 |
| GWQ-2 | Whether Gmail stays in MVP at read plus draft, or is cut to draft-only or removed entirely based on the verification answer. Tracked as OQ-3. | Scope |
| GWQ-3 | Where the refresh-token encryption key lives in the Vercel deployment and how it rotates. Tracked as SQ-2. | Backend responsibilities |
| GWQ-4 | Maximum stored `reverse_payload` size before a document edit is declared non-reversible. Tracked as DQ-5. | Acceptance criterion 11 |
| GWQ-5 | Whether Calendar enters MVP at the mid-window checkpoint. Tracked as OQ-8. | Non-goals |
| GWQ-6 | Document size cap and sheet range cap values. Tracked as VWQ-2. | Errors and recovery |
| GWQ-7 | Retry count and backoff ceiling for Google API calls, separate from provider model limits. | Errors and recovery |
| GWQ-8 | Whether a `drive.file` style narrow scope can satisfy the demo, avoiding a broader Drive scope entirely. | Least privilege |

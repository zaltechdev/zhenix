# Virtual Workspace

The Aksa application shell where all work happens. Supports steps 10, 11, 15, and 16 of the primary flow in `.agents/prd.md` section 8.

## Purpose

Give the user one calm place to hold a task, see documents, files, sheets, and search results, and reach History and Activity, without ever leaving Aksa or seeing a copy of someone else's interface.

## User Stories

- As a user, I say `Open Google Docs` and land in a document environment inside Aksa.
- As a user, I read and edit a document without a Google page or a browser toolbar in the way.
- As a user, I find a file by describing it instead of navigating folders.
- As a user, I read spreadsheet data in a table I can navigate by keyboard.
- As a user, I ask a research question and read the answer in the same place I work.
- As a user, I always see what the current task is doing, from any view.
- As a user, I reach History and Activity without losing my current view.
- As a user, I am told plainly when Aksa cannot do something.

## Scope

- Aksa application shell: header, workspace navigation, main region, command bar, task status.
- Document view backed by Google Docs data, using TipTap.
- Files view backed by Google Drive metadata.
- Sheet view backed by Google Sheets ranges, using an accessible table.
- Web search view.
- Current task panel showing state, step, and affected items.
- History tab and Activity tab entry points.
- Command input available from every view, by voice and by text.
- Explicit refusal for unsupported actions.
- Original Aksa interface throughout.

## Non-Goals

- Embedding, framing, or proxying any Google page.
- Recreating Google's visual design, iconography, menu structure, or layout.
- Real-time multi-user collaborative editing.
- A file manager with drag and drop. Head control cannot drag.
- Rich document features beyond what `docs.apply_edit` supports: no comments, suggestions, revision history, images, or complex tables in MVP.
- Spreadsheet formulas, charts, or pivot tables. MVP reads and writes values in a range.
- Aksa-native documents that are not backed by Google. Every document in MVP comes from Google Docs.
- Multiple concurrent tasks. One active task per workspace in MVP.

## User Flow

| Step | User | Aksa |
| --- | --- | --- |
| 1 | Finishes onboarding or signs in | Opens the workspace shell with the command bar focused and the task state `Ready for a task.` |
| 2 | Says or types `Open Google Docs` | Resolves a navigation intent and opens the document view |
| 3 | Sees the document view | Renders the connected document from Google Docs data in the Aksa editor, or an empty state when no document is selected |
| 4 | Asks to find a document | Runs a Drive search and shows results as selectable items in the files view |
| 5 | Selects a result | Opens it in the document view or the sheet view based on its type |
| 6 | Asks for an edit | Routes to the orchestrator, which halts at a confirmation before writing |
| 7 | Opens Web Search | Switches the main region to the search view, keeping the current task panel visible |
| 8 | Submits a research question | Shows the task progressing, then the artifact with its source cards |
| 9 | Opens History | Shows the task list without discarding the current view state |
| 10 | Opens Activity for a task | Shows the ordered real steps and outcomes |
| 11 | Asks for something unsupported | States plainly that Aksa cannot do it and why, and suggests a supported action |

Navigation intents work from voice, text, keyboard, pointer, and head control equally.

## UI States

| Surface | States |
| --- | --- |
| Shell | route-aware loading skeleton, ready, offline, session expired |
| Workspace navigation | current view indicated, view switching, view unavailable without a Google connection |
| Document view | empty, loading, loaded read-only, edit pending confirmation, edit applied, load failed, too large to render, disconnected |
| Files view | empty, searching, results, no results, load failed, disconnected |
| Sheet view | empty, loading, range loaded, range too large, write pending confirmation, write applied, load failed, disconnected |
| Web search view | idle, searching, artifact ready, no usable source, failed |
| Current task panel | idle, understanding, executing with current step, waiting for confirmation, completed, partially completed, failed, cancelled, undo available |
| Command bar | text submission, microphone dictation, live voice commands, listening, transcribing, transcript editable, submitting, unsupported speech recognition, microphone denied |
| Unsupported action | refusal with reason and a supported alternative |

Every view has an explicit empty state that explains why it is empty and offers one next action.

## Frontend Responsibilities

Owner: Henix.

- Route map and shell layout for the workspace, following `.agents/design.md` section 12.
- Workspace navigation with the current location exposed through `aria-current`.
- Document view built on TipTap, rendering the document content it receives, read-only until an edit is confirmed.
- Files view rendering Drive metadata as an accessible list, selectable without drag.
- Sheet view using TanStack Table or an accessible native table, keyboard navigable by cell and row.
- Web search view and artifact presentation, per `.agents/features/web-search-artifacts.md`.
- Current task panel rendering the single state it receives.
- Command bar with mode indicator, transcript editing, submit, stop, clear, and retry.
- History and Activity entry points that preserve the current view state.
- Refusal presentation for unsupported actions.
- Responsive behavior from 320 px through wide desktop.
- Focus management on view switches and dialog open and close.
- Localized copy for every view, state, and refusal.
- Frontend tests: view switching, keyboard navigation of the table and document, focus restoration, empty and failure states, responsive layout, long-string handling.

The frontend renders document and sheet content as data. It never queries Google, never writes to Google, and never decides whether an edit is permitted.

## Backend Responsibilities

Owner: Zaltech.

- Workspace read endpoint returning the current workspace, connection status, and the active task if any.
- Document read: fetch a Google Doc through `docs.read` and return it as a shaped structure the editor can render.
- Files read: fetch Drive results through `drive.search` and `drive.file_metadata` and return minimal metadata.
- Sheet read: fetch a range through `sheets.read_range` and return values plus range bounds.
- Navigation intent resolution for commands such as `Open Google Docs`.
- Content size caps with an honest too-large response rather than a truncated render that looks complete.
- Connection status so the frontend can show the disconnected state per view.
- Stable error categories per view.
- Authorization of every read by session and workspace ownership.
- Sanitization of Google-sourced content before it leaves the server, treating it as untrusted per `.agents/security.md` section 5.
- Backend tests: authorization, size caps, disconnected and expired-token paths, content sanitization, stable error categories.

The backend does not decide layout, navigation structure, or copy.

## Agent Tools

Used by this feature through the orchestrator in `.agents/features/agent-orchestration.md`. This feature adds no tool of its own beyond navigation.

| Tool | Kind | Use here |
| --- | --- | --- |
| `workspace.open_view` | read | Resolves a navigation command to a view. Changes no data |
| `docs.read` | read | Populates the document view |
| `drive.search` | read | Populates the files view |
| `drive.file_metadata` | read | Populates file detail |
| `sheets.read_range` | read | Populates the sheet view |
| `docs.apply_edit` | write | Confirmed edit from the document view |
| `sheets.write_range` | write | Confirmed write from the sheet view |

`workspace.open_view` accepts an enumerated view name only. It cannot accept an arbitrary URL or path.

## Data Requirements

Tables from `.agents/db_schema.md`: `workspaces`, `workspace_members`, `oauth_connections`, `tasks`, `activity_events`.

| Need | Detail |
| --- | --- |
| Workspace identity | `workspaces` plus the `workspace_members` owner row for the access check |
| Connection status | `oauth_connections.status` drives the per-view disconnected state |
| Active task | the newest non-terminal `tasks` row for the workspace |
| Task presentation | `tasks.state`, `result_summary`, `items_total`, `items_completed` |

Not stored by this feature: Google document content, sheet values, and file listings. They are fetched per request and rendered. Aksa caches nothing from Google in MVP beyond what a task artifact records.

Rationale: caching Google content would create a second copy to authorize, invalidate, and retain. Out of MVP scope.

## Security and Permissions

- Every workspace read is authorized from the session, never from a client-supplied `workspaceId`. Covered by SEC-T5.
- A workspace identifier substituted in a path or body is ignored in favor of the session value.
- A document, file, or sheet identifier the user's Google connection cannot access produces a named permission failure, never a fabricated render. Covered by SEC-T10.
- Google-sourced content is untrusted. It is sanitized server-side and rendered as text and safe structure only, with no raw HTML, no script, and no iframe. See `.agents/security.md` section 5.
- A document instructing an edit does not authorize an edit.
- No Google page is framed. `frame-ancestors 'none'` applies to Aksa, and Aksa embeds no Google surface.
- Access tokens stay server-side. The client never receives a Google token.
- Editing is read-only in the interface until a confirmation is approved, so the editor cannot silently produce a write.

## Errors and Recovery

| Failure | Behavior | User options |
| --- | --- | --- |
| Google not connected | Only Google-backed views show a disconnected state, naming what is missing | Connect Google, use Web Search, use History |
| Expired or revoked token | The view states that the connection needs reconnecting, with no silent retry | Reconnect, cancel |
| Missing scope for the view | Names the specific capability that needs consent | Grant the narrower scope, cancel |
| Document load failed | States the failure with a stable category, keeps the shell usable | Retry, choose another document |
| Document too large to render | States the limit instead of rendering a partial document that looks complete | Choose a smaller document, ask for a summary |
| Sheet range too large | Same, with the range bounds stated | Narrow the range |
| Drive search returned nothing | Empty state explaining that nothing matched | Rephrase, broaden the search |
| Unsupported command | Plain refusal with the reason and one supported alternative | Choose a supported action |
| Command outside product scope | Refusal citing the boundary, for example that Aksa does not control other websites | Choose a supported action |
| Task already active | States that one task runs at a time and offers to cancel the current one | Cancel current, wait |
| Session expired | Preserves the current view and the typed command | Sign in, resume |
| Network loss | Pauses the command bar, keeps rendered content visible, states the offline condition | Retry when online |
| Speech recognition unavailable | Command bar starts in text mode with no microphone control | Type |
| Camera lost | `Face control paused.` in the shell, view content untouched | Retry camera, keyboard, mouse |

No failure in one view breaks another view. The shell and the command bar remain usable.

## Accessibility

- One H1 per view, valid heading order, and landmark regions for header, navigation, and main.
- The current view is exposed with `aria-current`.
- Focus moves predictably on a view switch and is restored after any dialog.
- The document editor is keyboard operable, including all edit-request affordances.
- The sheet table is keyboard navigable by cell and row, with headers programmatically associated.
- No drag-and-drop requirement anywhere. File selection uses activation, not dragging.
- All targets are at least 44 by 44 px with at least 8 px separation.
- The command bar is reachable from every view by keyboard shortcut and by pointer.
- Dictation only fills the editable command field. Live Voice executes final recognized commands through the deterministic EN/ID allowlist, then uses the authenticated structured semantic fallback only after a deterministic miss.
- The current task state announces through a polite live region, assertive for confirmation and failure.
- Empty, loading, and failure states are announced after a meaningful delay, not on every keystroke.
- Loading skeletons mirror the destination surface: dashboard, document editor, sheet grid, list, search, or settings. A generic centered card never represents Workspace loading.
- No horizontal scrolling at 320 px, usable at 200 percent zoom.
- Indonesian and English layouts tolerate longer strings without clipping.
- Nothing in the workspace uses monospace typography.

## Acceptance Criteria

1. `Open Google Docs` from voice and from text opens the Aksa document view.
2. The document view renders real Google Docs content in Aksa's own interface, with no Google page, frame, or copied Google layout.
3. The files view lists real Drive metadata and items are selectable without dragging.
4. The sheet view renders a real Sheets range in a keyboard-navigable table.
5. The web search view is reachable from the workspace and produces an artifact per its own feature document.
6. The current task state, step, and affected items are visible from every view.
7. History and Activity are reachable without losing the current view state.
8. An unsupported command is refused with a reason and a supported alternative, never simulated.
9. Each Google-backed view shows a distinct disconnected state when no Google connection exists.
10. An expired token produces a reconnect state, not a retry loop.
11. Oversized documents and ranges produce an honest limit message rather than a partial render.
12. The document view is read-only until an edit confirmation is approved.
13. A workspace identifier substituted in a request is ignored in favor of the session value.
14. Google-sourced content containing markup or instructions renders as inert text.
15. Every view is completable by keyboard only and by mouse only.
16. Interim or duplicate speech results never execute. One final Live Voice result executes at most once.
16. Every view renders correctly in Indonesian and English at 320 px and at 200 percent zoom.
17. Automated accessibility checks report zero critical violations on all workspace views.

## Test Scenarios

| ID | Scenario | Expected |
| --- | --- | --- |
| VW-1 | Say `Open Google Docs` | Document view opens, navigation intent recorded as a read tool call |
| VW-2 | Type `buka Google Docs` in Indonesian | Same result |
| VW-3 | Open the document view with no Google connection | Disconnected state naming the missing connection |
| VW-4 | Open the document view with an expired token | Reconnect state, no repeated background calls |
| VW-5 | Load a document containing an embedded script tag and an instruction to move files | Rendered as inert text, no tool call attempted |
| VW-6 | Load a document above the size cap | Honest limit message, no partial render |
| VW-7 | Load a sheet range above the cap | Honest limit message with the range bounds |
| VW-8 | Navigate the sheet table by keyboard from the first cell to the last | Every cell reachable, headers announced |
| VW-9 | Select a Drive search result using head control and dwell | Opens in the correct view without dragging |
| VW-10 | Ask Aksa to open a bank website | Refusal citing the product boundary |
| VW-11 | Ask Aksa to control the Google Docs website directly | Refusal explaining that Aksa uses Google APIs in its own interface |
| VW-12 | Start a second task while one is active | States that one task runs at a time, offers to cancel |
| VW-13 | Switch views while a task is executing | Task panel state persists and stays accurate |
| VW-14 | Open History, then return | Previous view state preserved |
| VW-15 | Substitute another workspace identifier in a view request | Session workspace used, injected value ignored, SEC-T5 |
| VW-16 | Request a document identifier the connection cannot access | Named permission failure, no fabricated content, SEC-T10 |
| VW-17 | Expire the session while the sheet view is open | Sign in, return to the same view |
| VW-18 | Resize from 1440 px to 320 px in every view | No horizontal overflow, content order stays logical |
| VW-19 | Complete a full document read and a sheet read using keyboard only | Full parity |
| VW-20 | Inspect the DOM for any iframe pointing at a Google domain | None present |

## Demo Scenario

Minutes 4 to 5 and 7.5 to 8.5 of the pitch in `.agents/prd.md` section 23.

1. Say `Open Google Docs`. The Aksa document view opens with real content from the prepared demo account.
2. Point out explicitly that this is Aksa's interface backed by the Google Docs API, not the Google website and not a copy of it.
3. Show the files view listing real Drive items, selected by dwell without dragging.
4. Show the sheet view and navigate a few cells by keyboard to demonstrate table accessibility.
5. Move to the search view and show that the task panel stayed accurate across the switch.
6. Later, open History and Activity from the shell and return to the previous view intact.

Prepared content: one document with a `Testing` section, a folder of related files, and one small sheet, all owned by the demo account.

## Open Questions

| ID | Question | Blocks |
| --- | --- | --- |
| VWQ-1 | Final navigation model and route map, carried from `.agents/design.md` section 12. | Frontend responsibilities |
| VWQ-2 | Document size cap and sheet range cap values. | Acceptance criterion 11 |
| VWQ-3 | Which TipTap node and mark set maps cleanly to what `docs.apply_edit` can write, so the editor never offers formatting Aksa cannot persist. | Document view |
| VWQ-4 | Whether the sheet view uses TanStack Table or an accessible native table, decided after a keyboard-navigation test at realistic row counts. | Sheet view |
| VWQ-5 | Where accessibility controls live in the shell, carried from `.agents/design.md` section 12. | Shell layout |
| VWQ-6 | Whether one active task per workspace is sufficient for the demo, or whether a queued second task is needed. | Non-goals |
| VWQ-7 | Whether the document view supports selecting a document from within itself, or whether selection always happens in the files view. | User flow step 5 |

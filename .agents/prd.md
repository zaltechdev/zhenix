# Aksa Product Requirements Document

| Field | Value |
| --- | --- |
| Status | MVP scope 1.0 |
| Product | Aksa |
| Anchor | Computer Vision + AI Agents + Accessibility |
| Platform | Deployed web application only |
| Competition | BITSMIKRO Innovative Vibecode 2026 |
| Product owner of frontend scope | Henix |
| Product owner of system scope | Zaltech |

This document defines what Aksa does and why. It does not define architecture, schemas, or endpoints. See `.agents/rules.md`, `.agents/security.md`, `.agents/db_schema.md`, and `.agents/features/*.md`.

## 1. Product Summary

Aksa is a web workspace that lets a person with limited hand or arm movement finish real digital work by moving their head, holding the pointer on a target, or speaking. A user states an outcome. Aksa plans the steps, uses allowed tools, asks for approval before anything consequential, then shows a verified result that can be undone.

### One-sentence pitch

Aksa turns spoken or typed intent into completed document, file, and research work, controlled by head movement instead of a mouse.

## 2. Problem

People with motor impairments face three stacked barriers on the web.

| Barrier | Effect today |
| --- | --- |
| Precise pointing | Small targets, drag interactions, and dense toolbars require fine motor control |
| Repetition cost | A single task can need dozens of clicks across several apps |
| Assistive tooling gap | Specialist hardware and native software are expensive, platform-locked, or absent in Indonesian contexts |

Existing AI assistants reduce typing but still assume a mouse-capable user and still hide what they did. Aksa closes both gaps at once: hands-free control plus a visible, reversible agent.

## 3. Target Users

Users who can see a screen and move their head, and who cannot reliably use a mouse or trackpad.

### Primary persona: Rama, 21, undergraduate student

Rama has a spinal cord injury affecting arm and hand control. He uses a laptop with a built-in webcam. He can speak clearly and move his head freely. He needs to finish coursework, organize submission files, and read research quickly. Today a classmate operates his laptop for him during long tasks.

Rama needs: hands-free pointing, spoken task entry, few confirmations but never a surprise, and proof that a file actually moved.

### Secondary persona: Sari, 34, administrative staff with repetitive strain injury

Sari can use a pointer for short periods but pain builds quickly. She works across a spreadsheet, a shared drive, and email every day. She needs to reduce pointer time without losing control of what changes, and she needs to switch back to keyboard or mouse at any moment.

Sari needs: mixed input, reversible actions, readable summaries instead of long documents, and a record of what happened.

### Out of scope for MVP

Users who cannot move their head, users who need eye-only control, users who need a full screen reader as their only interface, and users who need Aksa to operate software outside Aksa.

## 4. Goals

| ID | Goal |
| --- | --- |
| G1 | A user completes a real task without a mouse or trackpad |
| G2 | A user always sees what Aksa is about to do before it happens |
| G3 | A user can cancel during execution and undo after completion |
| G4 | Aksa reports only verified outcomes, including partial ones |
| G5 | Aksa reads and edits real Google Workspace data through Google APIs |
| G6 | Aksa answers current questions with cited sources |
| G7 | The full demo runs from a public deployment link in one browser session |
| G8 | Both Indonesian and English are usable from first launch |

## 5. Non-Goals

Aksa will not do these in MVP or in any later version described here.

| Excluded | Reason |
| --- | --- |
| Full operating system control | Aksa is a web page, not a desktop agent |
| Control of native applications | Outside browser capability and outside product scope |
| Control of arbitrary third-party websites | No consent, no stable contract, unsafe |
| Browser-level automation of the Google Docs website | Aksa uses Google APIs and its own interface |
| A copied Google interface | Original Aksa interface only |
| Webcam eye tracking | Not implemented; head pose and facial gesture only |
| Autonomous purchases, checkout, or payment | Excessive agency risk |
| Banking or financial account actions | Excessive agency risk |
| Sending money, signing contracts, or legal submissions | Excessive agency risk |
| Medical, legal, or financial advice | Out of competence |
| Hidden model reasoning in the interface or storage | Prohibited by `.agents/rules.md` |
| Offline operation of the agent | Model and Google calls require network |
| Native mobile applications | Web only |
| Multi-user real-time collaborative editing | Not needed for the core problem |

## 6. Product Principles

1. Intent before navigation. The user says the outcome; Aksa finds the path.
2. Nothing consequential without approval. Read is free, write is reviewed.
3. Honest status only. `Completed` requires verification, never optimism.
4. Recovery is part of the flow, not an error handler.
5. Every action has a non-camera path. Camera failure degrades, never blocks.
6. Visible action, private reasoning. Show steps and results, never chain-of-thought.
7. Least access. Ask for the narrowest Google permission that satisfies the request.
8. One excellent path beats six shallow ones.

## 7. MVP Scope

### In scope

| Area | MVP capability |
| --- | --- |
| Landing | Public marketing page with the primary call to action |
| Account | Email and password sign up, sign in, sign out, session |
| Onboarding | Camera consent, head pointer test, calibration, microphone consent, voice test, first guided command |
| Head control | Head-pose pointer with sensitivity, dead zone, smoothing, pause |
| Selection | Dwell selection and one facial gesture selection, both configurable |
| Fallback | Full keyboard and mouse parity for every action |
| Voice | Browser speech recognition with an editable transcript, plus mandatory text entry |
| Agent | Bounded orchestration loop with a typed tool registry and visible activity |
| Workspace | Aksa app shell with document, files, sheet, and web search views |
| Google Drive | Search, list, read metadata, move, rename, create folder |
| Google Docs | Read and structured edit inside the Aksa document view |
| Google Sheets | Read a range and write a range inside the Aksa sheet view |
| Gmail | Read and summarize recent messages; draft creation only |
| Web search | Grounded search with source-backed readable artifacts |
| Control | Confirmation, cancellation, Undo, partial completion reporting |
| Record | Task history, task detail, activity steps, artifact list |
| Language | Indonesian and English |

### Deferred but designed

| Area | Condition |
| --- | --- |
| Google Calendar read and event creation | Only if MVP capacity remains after the seven features above are verified |
| Gmail send | Only after a reviewed send-confirmation flow passes security review |
| Artifact export to Drive | Only if Drive write is already stable |
| Read-aloud of artifacts | Browser speech synthesis, only if it does not compete with head control work |

### Explicitly out of MVP

Workspace sharing between accounts, team roles beyond a single owner, custom tool authoring by users, scheduled or background tasks, and browser extension delivery.

## 8. Primary User Flow

This is the canonical flow. Every document in `.agents/` describes this same flow.

| Step | User action | Aksa response |
| --- | --- | --- |
| 1 | Opens the landing page | Shows the value, capability chips, and `Try Aksa` |
| 2 | Signs in or creates an account | Establishes a session and routes to onboarding |
| 3 | Enters onboarding | Explains head control, privacy, and the skip path before asking for anything |
| 4 | Grants camera permission | Shows a visible camera indicator and a live pointer preview |
| 5 | Tests the head pointer | Shows the Aksa cursor following head movement, distinct from system focus |
| 6 | Calibrates | Saves sensitivity, dead zone, smoothing, and dwell or gesture choice after explicit consent |
| 7 | Grants microphone permission | Shows a visible microphone indicator and the listening state |
| 8 | Tests voice with text fallback | Shows an editable transcript and a working text field |
| 9 | Says `Open Google Docs` | Recognizes the intent and opens the Aksa document environment |
| 10 | Sees the workspace | Shows the Aksa document view backed by Google Docs data, not a Google page |
| 11 | Opens Web Search | Shows the search view with voice and text entry |
| 12 | Asks `Search the latest AI coding tool news and summarize it` | Confirms the understood request and starts the search agent |
| 13 | Waits | Retrieves current grounded sources and lists them as source cards |
| 14 | Reads the result | Presents a short readable artifact with inline citations to those sources |
| 15 | Continues | Stores the task, its steps, and the artifact in History |
| 16 | Opens Activity | Shows ordered actions, tool outcomes, and results with no hidden reasoning |

Steps 9 and 12 must both work from voice and from typed text. Steps 4 and 7 must both be skippable without losing the rest of the flow.

## 9. Failure Flows

Every failure flow keeps prior work, states what happened, and offers one clear next action.

| Failure | Aksa behavior | User options |
| --- | --- | --- |
| Camera permission denied | Explains that head control needs the camera; keeps the account and workspace usable | Retry permission, continue with keyboard, continue with mouse |
| Microphone permission denied | Switches the command bar to text mode and says so | Retry permission, type the command |
| Speech recognition unsupported | Detects the missing capability before showing a microphone control | Use text entry, open the supported-browser note |
| Head tracking lost | Shows `Face control paused.`, stops dwell immediately, freezes the Aksa cursor | Retry camera, use keyboard, use mouse |
| Calibration failure | Keeps the previous saved profile and explains which step failed | Restart calibration, adjust manually, skip |
| Poor lighting or no face detected | Shows a positioning and lighting hint without capturing anything | Adjust position, retry, skip |
| Google account not connected | Blocks only the Google-dependent action and names the missing connection | Connect Google, choose a non-Google task |
| Expired or revoked OAuth token | Marks the connection as needing reconnect and does not retry silently | Reconnect Google, cancel the task |
| Missing Google permission scope | Names the specific capability that requires additional consent | Grant the narrower scope, cancel |
| Provider timeout | Ends the step, keeps completed steps, reports the task as partial | Retry the remaining step, cancel |
| Provider rate limit or capacity error | Retries with backoff up to the configured limit, then reports the delay honestly | Wait and retry, cancel |
| Budget or cost ceiling reached | Stops before calling the provider and states the limit | Wait for reset, reduce scope |
| Search returns no useful source | States that no reliable current source was found and produces no artifact | Rephrase, narrow the topic, cancel |
| Sources conflict | Presents the disagreement in the artifact instead of picking silently | Read both sources, refine the question |
| Partial task completion | Reports counts of done and remaining items with names | Retry remaining, accept partial, undo done items |
| Tool failure | Names the failed step and its scope, never claims success | Retry step, cancel task |
| Cancellation during execution | Stops before the next tool call, keeps finished steps, marks the task cancelled | Undo finished steps if reversible, edit and restart |
| Undo unavailable | States why it cannot be reversed before the user relies on it | Manual correction path, keep as is |
| Undo failure | Reports which items reverted and which did not | Retry undo, view affected items |
| Session expired | Preserves the typed command and returns to it after sign in | Sign in again |
| Network loss | Pauses the command bar, keeps local calibration and drafts | Retry when online |

## 10. Functional Requirements

### Authentication and onboarding

| ID | Requirement |
| --- | --- |
| FR-A1 | A visitor can create an account with email and password |
| FR-A2 | A returning user can sign in and sign out |
| FR-A3 | A session persists across page reloads until expiry or sign out |
| FR-A4 | Onboarding explains camera use and privacy before requesting camera access |
| FR-A5 | Onboarding can be skipped and resumed later without losing account state |
| FR-A6 | Camera and microphone consent are requested separately and recorded separately |
| FR-A7 | Calibration values persist for the signed-in user and load on next sign in |
| FR-A8 | A user can reset an accessibility profile to defaults |

### Accessibility input

| ID | Requirement |
| --- | --- |
| FR-C1 | Head pose moves an Aksa pointer that is visually distinct from browser focus |
| FR-C2 | Sensitivity, dead zone, and smoothing are user-adjustable with live preview |
| FR-C3 | Dwell selection activates only after a configurable hold on a stable eligible target |
| FR-C4 | Moving away from a target cancels dwell immediately |
| FR-C5 | One facial gesture can be configured as a selection trigger with a cooldown |
| FR-C6 | Dwell and gesture selection cannot alone approve a consequential action |
| FR-C7 | Head control can be paused and resumed from a single always-reachable control |
| FR-C8 | Every action is reachable by keyboard and by mouse |
| FR-C9 | Camera frames are processed for control signals and are never stored or transmitted for that purpose |
| FR-C10 | Loss of face detection pauses control and announces the pause |

### Voice and text command

| ID | Requirement |
| --- | --- |
| FR-V1 | A user can dictate a command and see the transcript before submission |
| FR-V2 | A user can edit the transcript before submission |
| FR-V3 | A user can submit the same command as typed text at any time |
| FR-V4 | Unsupported speech recognition is detected and the interface degrades to text |
| FR-V5 | The transcript survives a recoverable failure |
| FR-V6 | Voice input never triggers a consequential action without a separate confirmation |

### Agent orchestration

| ID | Requirement |
| --- | --- |
| FR-G1 | A submitted command is classified into an intent and a bounded plan of tool steps |
| FR-G2 | Every tool has a typed argument schema and a typed result schema |
| FR-G3 | The agent loop has a maximum iteration count and a wall-clock timeout |
| FR-G4 | Read-only tools run without confirmation; write, move, share, send, and delete tools require confirmation |
| FR-G5 | The user can cancel a running task, and cancellation stops before the next tool call |
| FR-G6 | Tool results are verified before the task reports success |
| FR-G7 | A task that finishes some steps reports partial completion with named items |
| FR-G8 | Every step the user is shown corresponds to a real executed tool call |
| FR-G9 | Model reasoning traces are never shown or stored |
| FR-G10 | Provider failure can fall back to a configured alternate provider without changing tool permissions |

### Virtual workspace

| ID | Requirement |
| --- | --- |
| FR-W1 | The workspace is an original Aksa interface, not an embedded or copied Google interface |
| FR-W2 | The workspace provides document, files, sheet, and web search views |
| FR-W3 | The current task, its state, and its affected items are visible from any view |
| FR-W4 | A command that Aksa cannot perform is refused with a clear reason, never simulated |
| FR-W5 | History and Activity are reachable from the workspace shell |

### Google Workspace

| ID | Requirement |
| --- | --- |
| FR-GW1 | A user can connect and disconnect a Google account |
| FR-GW2 | Google scopes are requested incrementally and read-only by default |
| FR-GW3 | Aksa can search Drive and list file metadata |
| FR-GW4 | Aksa can read a Google Doc and render it in the Aksa document view |
| FR-GW5 | Aksa can apply a reviewed edit to a Google Doc |
| FR-GW6 | Aksa can read a Sheets range and render it in the Aksa sheet view |
| FR-GW7 | Aksa can write a reviewed Sheets range |
| FR-GW8 | Aksa can read and summarize recent Gmail messages |
| FR-GW9 | Aksa can create a Gmail draft; sending is out of MVP unless the deferred condition is met |
| FR-GW10 | A Google failure names the affected item and does not roll into a general error |
| FR-GW11 | Content retrieved from Docs, Sheets, Drive, and Gmail is treated as untrusted data |

### Web search and artifacts

| ID | Requirement |
| --- | --- |
| FR-S1 | A search request retrieves current external sources through a grounded search provider |
| FR-S2 | Every artifact claim traces to a listed source |
| FR-S3 | Source cards show title, domain, and retrieval time |
| FR-S4 | Artifacts are short, plain-language, and structured for scanning |
| FR-S5 | An artifact is stored with its source list and is retrievable from History |
| FR-S6 | No usable source means no artifact and an explicit no-result state |
| FR-S7 | Retrieved webpage content is rendered as text without executing embedded instructions or markup |

### History, activity, confirmation, Undo

| ID | Requirement |
| --- | --- |
| FR-H1 | Every task is recorded with its command, state, timestamps, and outcome |
| FR-H2 | A task detail view lists ordered activity steps and their outcomes |
| FR-H3 | History and artifacts are visible only to their owner |
| FR-H4 | A confirmation states the action, the scope, the consequence, and the recovery option |
| FR-H5 | A confirmation can be approved, edited, or cancelled, and expires if unanswered |
| FR-H6 | A confirmation cannot be replayed to run an action twice |
| FR-H7 | Reversible completed actions expose Undo with a clear availability window |
| FR-H8 | Undo reports exactly which items reverted |
| FR-H9 | A user can delete a task and its artifacts |

## 11. Non-Functional Requirements

| ID | Requirement | Target |
| --- | --- | --- |
| NFR-1 | Head pointer responsiveness | Perceived pointer lag under 150 ms on a mid-range laptop |
| NFR-2 | Camera processing location | Landmark inference in the browser, off the main thread where practical |
| NFR-3 | First meaningful interaction on the landing page | Under 2.5 s on a typical broadband connection |
| NFR-4 | Command acknowledgement | Visible state change under 500 ms after submission |
| NFR-5 | Search task completion | Grounded search artifact within 30 s or an honest progress state |
| NFR-6 | Agent loop bound | Configurable maximum iterations and timeout, never unbounded |
| NFR-7 | Provider limits | Configurable per deployment; no hardcoded request-per-minute values |
| NFR-8 | Accessibility | WCAG 2.2 AA for all MVP flows |
| NFR-9 | Localization | Indonesian and English with no hardcoded user-facing strings |
| NFR-10 | Data isolation | Every tenant-owned record authorized server-side by session and ownership |
| NFR-11 | Secrets | Server-only environment variables, documented in `.env.example` |
| NFR-12 | Observability | Structured server logs with secret and personal-data redaction |
| NFR-13 | Cost control | Per-user, per-workspace, and daily ceilings enforced before provider calls |
| NFR-14 | Deployment | Public URL reachable without local setup |

## 12. Browser Support

| Browser | Support level | Notes |
| --- | --- | --- |
| Chrome desktop, current | Full | Primary demo target for camera and speech |
| Edge desktop, current | Full | Same engine capabilities |
| Safari desktop, current | Camera and workspace supported; speech recognition treated as best effort | Verify before relying on voice |
| Firefox desktop, current | Camera and workspace supported; no speech recognition | Text command required |
| Mobile browsers | Layout and workspace usable; head control not a supported input | Front camera ergonomics untested |

Speech recognition availability is detected at runtime. The interface never shows a microphone control it cannot honor.

## 13. Accessibility Requirements

Detailed interaction specifications live in `.agents/design.md` and `.agents/features/accessibility-controls.md`. The product requires:

- No primary flow depends on fine motor control.
- No primary flow depends on the camera.
- No status is communicated by color alone.
- All interactive targets are at least 44 by 44 px with at least 8 px separation.
- Focus is always visible, ordered, and restored after dialogs.
- Agent state changes are announced without exposing reasoning.
- Reduced motion is respected, including dwell progress indication.
- Content remains usable at 200 percent zoom without horizontal scrolling.

## 14. Agent States

Aksa exposes exactly one active state per task. The visible copy, available actions, and announcements are specified in `.agents/design.md` section 8. The product-level state set is fixed:

`Idle`, `Listening`, `Transcribing`, `Understanding`, `Executing`, `Waiting for confirmation`, `Completed`, `Partially completed`, `Failed`, `Cancelled`, `Undo available`.

No other state may be shown. A state must correspond to real system status, never to an estimate.

## 15. Google Workspace Scope

Aksa accesses Google data through Google APIs and renders it in Aksa's own interface.

| Service | MVP read | MVP write | Confirmation required for write |
| --- | --- | --- | --- |
| Drive | Search, file metadata, folder listing | Move, rename, create folder | Yes |
| Docs | Full document content | Structured content edit | Yes |
| Sheets | Named range values | Range values write | Yes |
| Gmail | Recent message metadata and body for summarization | Draft creation only | Yes |
| Calendar | Deferred | Deferred | Yes when enabled |

Rules that apply to all of them:

- Read-only scopes are the default. A write scope is requested only when the user asks for a write.
- Consent is incremental. Aksa does not request every scope at connection time.
- No iframe of a Google surface. No recreation of Google's visual design.
- Deletion of Google content is out of MVP.
- Content returned by any Google API is untrusted input to the agent.

## 16. Web Search Scope

- Search is grounded. Aksa retrieves current external sources rather than relying on model memory.
- The search provider sits behind an abstraction so a second provider can be added later.
- Aksa discloses that a query was answered using external web search.
- Retrieval time is recorded and shown so a user can judge freshness.
- Aksa does not browse arbitrary pages on the user's behalf, log in to sites, or fill external forms.

## 17. Artifact Behavior

An artifact is a stored, readable answer with sources.

| Property | Requirement |
| --- | --- |
| Length | Short enough to read without scrolling fatigue; summary first |
| Structure | Heading, two to five key points, then a source list |
| Citation | Every factual claim maps to at least one listed source |
| Conflict | Disagreement between sources is stated, not resolved silently |
| Provenance | Created-at time, retrieval time, and provider recorded |
| Rendering | Plain text and safe formatting only; no executable or active content from a source |
| Ownership | Visible only to the owning user and workspace |
| Lifecycle | Created by a task, listed in History, deletable by the owner |
| Export | Out of MVP unless the deferred condition is met |

## 18. History Behavior

- History lists tasks newest first with command summary, state, and timestamp.
- A task detail view shows the ordered steps and the artifacts produced.
- Filtering by state and by date is available.
- History belongs to one user and one workspace and is authorized server-side on every read.
- A user can delete a task; deletion also removes its artifacts and sources.
- Retention is a documented, configurable policy rather than unlimited storage.

## 19. Activity Behavior

Activity is the per-task record of what Aksa actually did.

| Shown | Not shown |
| --- | --- |
| Step name in product language | Model prompts or reasoning traces |
| Tool that ran and the item it touched | Raw provider payloads |
| Outcome: succeeded, failed, skipped, cancelled | Internal stack traces |
| Timestamp and duration | Token counts or provider identifiers by default |
| Confirmation requested and the user's answer | Any secret or credential |

An activity step is written only after the corresponding tool call actually ran. Activity is append-only within a task.

## 20. Confirmation Behavior

A confirmation is required before any action that writes, moves, renames, shares, sends, or deletes.

| Element | Requirement |
| --- | --- |
| Action | Plain statement of what will happen |
| Scope | Named items and counts, not vague quantities |
| Consequence | Whether it changes external Google data |
| Recovery | Whether Undo will be available afterwards |
| Choices | Approve, edit, cancel |
| Expiry | Unanswered confirmations expire and cannot be used later |
| Single use | An approved confirmation authorizes exactly one execution |
| Input safety | Dwell or gesture alone cannot approve; a deliberate second signal is required |

## 21. Undo Behavior

| Aspect | Requirement |
| --- | --- |
| Coverage | Undo is offered only where the reverse operation is genuinely supported |
| Honesty | Where Undo is impossible, the confirmation says so before execution |
| Scope | Undo reverses the recorded action, and reports item-level results |
| Window | Availability is time-bounded and the remaining availability is stated without a pressuring countdown |
| Partial | If some items revert and some do not, both sets are named |
| Idempotency | Repeating an Undo request does not double-apply |
| Record | Undo is itself recorded in History and Activity |

MVP Undo targets: Drive move, Drive rename, Sheets range write, and Docs edit where the prior content was captured. Gmail draft deletion is treated as Undo for draft creation.

## 22. Success Metrics

| Metric | Target for the competition build |
| --- | --- |
| Hands-free task completion | A tester completes the step 1 to 16 flow using only head and voice |
| Confirmation coverage | 100 percent of write, move, and send actions show a confirmation before execution |
| False success rate | Zero reported successes without a verified tool result |
| Citation coverage | 100 percent of artifact claims map to a listed source |
| Recovery availability | Every failure flow in section 9 has a visible next action |
| Accessibility | Zero critical automated accessibility violations on MVP screens |
| Demo reliability | Five consecutive clean runs of the demo flow on the deployed URL |
| Localization | Every MVP screen renders correctly in Indonesian and English |

## 23. Competition Demo Flow

Ten-minute pitch, five-minute question window. The demo occupies the middle of the pitch.

| Minute | Content |
| --- | --- |
| 0 to 1.5 | Problem: pointer dependency and repetition cost for users with motor impairments |
| 1.5 to 2.5 | Solution framing: Computer Vision + AI Agents + Accessibility, web only |
| 2.5 to 4 | Live: sign in, camera consent, head pointer, calibration, microphone consent |
| 4 to 5 | Live: say `Open Google Docs`, Aksa document view opens with real Google data |
| 5 to 6.5 | Live: Web Search request, grounded sources retrieved, cited artifact produced |
| 6.5 to 7.5 | Live: a Drive move with confirmation, then Undo |
| 7.5 to 8.5 | Live: History and Activity showing the real steps |
| 8.5 to 10 | AI utilization, prompting evidence, architecture summary, and roadmap |

Demo requirements:

- One browser session, one deployed URL, no local server.
- A prepared Google account with seed content owned by the team.
- A rehearsed fallback: if camera or microphone fails on the presenter machine, continue with keyboard and text while narrating the accessibility fallback as a designed behavior.
- No pre-recorded footage presented as live behavior. If a recording is used, it is labelled.

## 24. Acceptance Criteria

The MVP is accepted when all of the following are true on the deployed URL.

1. A new user can sign up, sign in, and reach the workspace.
2. Onboarding requests camera and microphone separately, both skippable, and saves calibration after consent.
3. The head pointer moves with head pose, and dwell plus one facial gesture both select.
4. Sensitivity, dead zone, smoothing, dwell duration, and pause all work and persist.
5. Every MVP action is completable with keyboard only and with mouse only.
6. A spoken command produces an editable transcript, and the same command works typed.
7. `Open Google Docs` opens the Aksa document view backed by Google Docs data.
8. A grounded web search produces a cited artifact, and a no-source query produces the no-result state.
9. Every write, move, or send action shows a confirmation naming the affected items.
10. Cancellation during execution stops before the next tool call and reports partial completion.
11. Undo reverses at least Drive move and Sheets range write, reporting item-level results.
12. History and Activity show only real executed steps with no reasoning traces.
13. Requesting another account's task, artifact, or history identifier is refused server-side.
14. Camera denial, microphone denial, unsupported speech, tracking loss, disconnected Google, expired token, provider timeout, and rate limit each show their designed state.
15. All MVP screens pass WCAG 2.2 AA checks and render in Indonesian and English.
16. No secret value appears in any client payload, log, or artifact.

## 25. Future Scope

Not part of MVP, recorded so the roadmap in the proposal stays honest.

- Google Calendar read and event creation.
- Reviewed Gmail send.
- Read-aloud for artifacts and documents.
- Additional facial gestures and per-gesture action mapping.
- Shared workspaces with roles.
- Search provider choice per workspace.
- Artifact export to Drive and PDF.
- Database-per-user isolation, described as an option in `.agents/db_schema.md`.
- Offline calibration profiles synced across devices.

## 26. Open Questions

| ID | Question | Blocks |
| --- | --- | --- |
| OQ-1 | Competition rule D.7 requires all work to be created inside the 5 to 10 August 2026 window. Can pre-window specifications in `.agents/` be used, or must the submitted artifacts be regenerated during the window? | Submission compliance |
| OQ-2 | Which Google account and project host the demo, and is OAuth verification needed for the chosen scopes within the window? | FR-GW series |
| OQ-3 | Is Gmail read acceptable under the chosen consent posture for the demo account, or should Gmail be cut to draft-only? | FR-GW8 |
| OQ-4 | Which facial gesture is the default selection trigger after motor-accessibility testing? | FR-C5 |
| OQ-5 | Default sensitivity, dead zone, smoothing, and dwell duration values. | FR-C2, FR-C3 |
| OQ-6 | Undo availability window duration and whether it survives a page reload. | FR-H7 |
| OQ-7 | Default locale and language detection behavior. | NFR-9 |
| OQ-8 | Whether Calendar enters MVP, decided at the mid-window checkpoint. | Deferred scope |
| OQ-9 | Guest or demo access without an account, and its data retention. | FR-A1 |
| OQ-10 | Retention periods for tasks, artifacts, transcripts, and activity. | FR-H series, NFR-10 |
| OQ-11 | Final hero and value-card imagery licensing, carried from `.agents/design.md`. | Landing page |
| OQ-12 | Whether the landing demo is interactive, recorded, or both, carried from `.agents/design.md`. | Landing page |

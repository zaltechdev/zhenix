# Aksa Docs PoC: First Pass Implementation Prompt

Inspect the latest **local working tree** of `zaltechdev/zhenix`, including uncommitted changes, before editing. Do not rely only on the remote branch.

Read first:

- `AGENTS.md`
- `.agents/design.md`
- `.agents/prd.md`
- `.agents/security.md`
- `.agents/features/google-workspace.md`
- `.agents/features/virtual-workspace.md`
- current `/workspace/documents` route and workspace shell
- existing Google OAuth, connection, capability-state, confirmation, undo, activity, and agent code
- `messages/en.json` and `messages/id.json`
- relevant unit, integration, Playwright, and accessibility tests

Always consult `.agents/design.md` while implementing. Preserve the repo package manager. Do not switch package managers.

## Goal

Build the first **real Aksa Docs PoC**.

Aksa Docs is **not** an iframe, clone, proxy, or visual copy of Google Docs. Google Docs remains the source of truth. Aksa renders the selected document in its own accessibility-first editing surface and applies verified structured changes through Google APIs.

The PoC must prove this loop:

1. Connect Google.
2. Pick a real Google Doc without leaving Aksa.
3. Load real document content and useful formatting.
4. Read and navigate it with keyboard, mouse, and Aksa accessibility controls.
5. Make a small direct edit or formatting change.
6. Review and apply the change safely.
7. Write it to the real Google Doc.
8. Re-read and verify the result.
9. Offer `Open in Google Docs` as an escape hatch for unsupported advanced features.

Do not attempt to recreate the complete Google Docs product in this PoC.

## Product principle

The value proposition is:

**Google Docs fidelity where practical + Aksa accessibility control + outcome commands + reviewed AI assistance.**

Do not build a worse generic text editor and call it Google Docs.

Preserve unsupported Google Docs structures rather than destructively flattening them.

## Official Google integration constraints

Use current official Google APIs and documentation before implementation.

Required approach:

- Use Google Picker for choosing a document inside Aksa.
- Prefer per-file access with `drive.file` where compatible with the existing backend and scope model.
- Read with `documents.get`.
- Write with `documents.batchUpdate`.
- Use `WriteControl.requiredRevisionId` for writes derived from an earlier read.
- Re-read after a successful write before reporting `Saved` or `Completed`.
- Never expose OAuth tokens to the client.
- Never silently request broad Drive access when a narrower scope can satisfy the PoC.

If the repo already has a stricter verified backend contract, reuse it instead of bypassing it.

## Scope for this first PoC

### Must support

- Open a Google Doc through Google Picker.
- Show document title.
- Render paragraphs and headings.
- Render text styles needed for ordinary student work:
  - bold
  - italic
  - underline
  - links
- Render paragraph styles needed for ordinary student work:
  - heading levels
  - alignment where available
  - ordered and unordered lists
- Render simple tables read-only if full editing is not safe yet.
- Render inline images read-only if available from the API representation.
- Direct text editing for ordinary paragraphs and headings.
- Basic formatting actions for selected text where mapping is reliable.
- Keyboard-only editing and navigation.
- Aksa head-pointer compatibility through normal accessible DOM targets.
- Voice dictation/text command entry through existing Aksa input infrastructure.
- Explicit save/apply state.
- Conflict detection.
- Verification after write.
- Honest unsupported-content fallback.
- `Open in Google Docs` external action.

### Nice to have only after the core loop works

- Left document outline from headings.
- Read selected text aloud.
- Selection-based AI rewrite panel.
- Focus mode.
- Basic undo through the existing Aksa undo system.

### Explicitly out of this PoC

Do not implement:

- iframe embedding of the authenticated Google Docs editor
- browser automation of docs.google.com
- pixel-copying Google Docs UI
- real-time collaborator cursors
- comments
- suggestion mode
- revision history UI
- equations editing
- drawings editing
- complex page layout fidelity
- headers and footers editing
- footnotes editing
- full table editing unless it becomes trivial after the core is stable
- pagination-perfect rendering
- Google Docs add-on
- Chrome extension
- background autosync loops
- silent AI writes

## UI direction

Keep the existing Aksa workspace shell and sidebar.

When a document is open, replace the current diagnostic card with a real document workspace.

### Desktop structure

Use this information architecture:

- top document bar
- optional compact outline rail
- main document canvas
- optional Aksa Assist side panel
- compact contextual command bar only when the document surface is usable

Do not create card soup.

### Top document bar

Show:

- document title
- save state: `Saved`, `Unsaved`, `Saving`, `Conflict`
- `Open in Google Docs`
- compact `More` menu if needed
- Aksa Assist toggle only when AI is actually available

Do not show API names, document IDs, OAuth scopes, or internal status keys.

### Document canvas

The document must dominate the page.

Use a calm centered paper/editor surface with a readable measure. It should feel like a serious writing environment without copying Google Docs chrome.

Requirements:

- strong content hierarchy
- useful whitespace
- no unnecessary outer cards
- visible caret
- visible text selection
- clear focus state
- semantic headings and lists where possible
- 44px minimum surrounding interaction targets for controls
- document text itself should retain natural reading density rather than 44px line-height

### Toolbar

Keep the first toolbar intentionally small:

- Undo if safe
- paragraph style / heading
- Bold
- Italic
- Underline
- List
- Link if practical
- `More` only for implemented actions

Do not display disabled fake formatting controls for unsupported actions.

Do not recreate the full Google Docs toolbar.

### Outline

If implemented, derive it from document headings.

- compact left rail
- click, keyboard, head pointer, and dwell accessible
- selecting a heading scrolls/focuses the corresponding block
- current section may be indicated without color alone
- hide the outline automatically when the document has no useful headings

### Aksa Assist

Hidden by default.

Open it only when the user asks for AI help or activates the Assist control.

First PoC actions:

- `Rewrite`
- `Shorten`
- `Simplify`
- `Fix grammar`

AI must be selection-first.

If no text is selected, explain briefly: `Select text first.`

Do not implement an always-visible chatbot.

## Loading and blocked states

Respect the workspace state precedence already defined in the app.

### Anonymous

Show one clear action:

`Sign in to use Docs`

### Signed in, Google disconnected

Show:

Heading: `Connect Google`

Sentence: `Open and edit your documents in Aksa.`

Primary action: `Connect Google`

Do not show a command composer underneath a blocked state.

### Connected, no document selected

Show a compact empty state:

Heading: `Open a document`

Sentence: `Choose a Google Doc to start.`

Primary action: `Choose document`

This launches Google Picker without navigating away from Aksa.

### Loading

Show document-shaped skeletons or a restrained progress state. Do not fake document content.

### Failed

Name the actual user-recoverable condition:

- reconnect Google
- permission missing
- file unavailable
- document too large
- conflict
- provider failure

Do not expose raw provider payloads.

## Google Picker PoC

Use Google Picker filtered to Google Docs.

Requirements:

- open as an in-app modal/overlay
- filter to Google Docs MIME type
- preserve keyboard access
- restore focus to `Choose document` after cancel
- after selection, route or load the chosen document in Aksa
- do not use a custom fake Drive picker if official Picker is viable

Persist only the identifiers/metadata already allowed by the backend design. Do not cache full Google document bodies in the database merely for convenience.

## Document adapter architecture

Do not couple raw Google Docs JSON directly to React components.

Create explicit adapter boundaries.

Suggested layers:

1. `GoogleDocumentDTO`
   - typed server result from the existing backend

2. `AksaDocumentModel`
   - normalized frontend representation
   - blocks with stable local IDs
   - source Google start/end indexes
   - paragraph style
   - text runs and text styles
   - bullet/list metadata
   - read-only unsupported nodes

3. renderer/editor
   - renders `AksaDocumentModel`
   - produces local edit intents

4. edit mapper
   - converts safe local edit intents into backend/Docs structured operations

5. verification reload
   - reloads the current Google document and refreshes indexes/revision after a successful write

Do not let UI components construct arbitrary Google API request bodies directly.

## Editing strategy for PoC

Avoid a naive "replace the entire document body" save strategy. It risks destroying formatting, tables, images, and unsupported structures.

Use block-aware editing.

For the first pass:

- paragraphs/headings can be editable
- unsupported structures remain read-only
- preserve their position in the rendered document
- store the source Google indexes for editable blocks
- represent text changes as structured intents

When multiple text edits are converted to Google index operations, account for shifting indexes. Prefer one reviewed batch constructed against one known revision, with operations ordered safely where necessary.

After any successful write:

- call the server verification/read path
- reload the normalized document
- refresh source indexes and revision ID
- only then show `Saved`

If this safe mapping becomes too complex for the first pass, reduce the direct editing scope rather than using a destructive full-document rewrite.

## Formatting strategy

The PoC should prove that Aksa can preserve and apply meaningful Google Docs formatting.

Map read formatting from Docs into the Aksa model for:

- text style: bold, italic, underline, link
- paragraph named style / heading
- alignment
- bullets/lists

Map safe formatting actions back through structured Docs requests such as text style or paragraph style updates.

Do not apply formatting if the browser selection cannot be reliably mapped to the original Google range.

In that case, disable the action and state the limitation honestly.

## Conflict handling

Use the document revision from the read result.

For edits based on that state, require the matching revision when writing.

If the document changed externally before Aksa writes:

Show a clear conflict state:

Heading: `Document changed`

Sentence: `Reload before applying your edit.`

Actions:

- `Reload document`
- `Copy my edit` if preserving unsaved local text is useful

Do not force-write over a newer revision.

Do not report success when verification fails.

## Save model

For the PoC, prefer an explicit and understandable save model over aggressive autosave.

Recommended:

- direct typing creates local `Unsaved` state
- `Save` or a short idle-save may prepare a reviewed write
- consequential structured changes route through the existing confirmation contract
- after execution, verify and show `Saved`

Do not hammer the Docs API on every keystroke.

Do not silently lose unsaved local edits on navigation.

If the user leaves with local changes, use the app's established unsaved-work pattern or add a minimal accessible confirmation.

## AI writing PoC

AI writing is optional and secondary.

Do not block the Docs PoC on AI integration.

If the repo already has a real configured model/agent path that can safely produce rewrite proposals, reuse it. Otherwise hide or disable Assist honestly. Never fabricate AI output.

### Selection flow

1. User selects text.
2. Opens Aksa Assist.
3. Chooses `Rewrite`, `Shorten`, `Simplify`, or `Fix grammar`.
4. Send only the selected text plus the minimum needed document context.
5. Return a proposal, not an automatic edit.
6. Show `Original` and `Proposed`.
7. User chooses `Discard` or `Apply`.
8. `Apply` must identify the exact target range/change.
9. Route through the existing confirmation/write contract.
10. Write through Docs API.
11. Re-read and verify.
12. Offer Undo when the backend says it is available.

No AI-generated content may silently enter the Google Doc.

## Command bar

Keep the existing Aksa command concept, but make it contextual to the open document.

Examples:

- `Go to conclusion`
- `Read this paragraph`
- `Make this a heading`
- `Bold this text`
- `Rewrite this clearly`

For the PoC, only execute commands backed by real implemented capability.

Unsupported commands must produce a concise refusal instead of simulated success.

Do not let a voice command alone approve a consequential write.

## Accessibility requirements

This PoC must demonstrate the Aksa moat, not merely Google API connectivity.

Everything must work with keyboard and mouse first, and remain compatible with head control/dwell.

Required keyboard behavior:

- logical Tab order
- Shift+Tab parity
- visible focus
- no positive tabindex
- no keyboard trap
- toolbar buttons work with Enter/Space
- editor supports ordinary text navigation keys
- outline headings are keyboard activatable
- Picker cancel restores focus
- Assist open/close manages focus predictably
- confirmation receives focus on a non-destructive action
- Escape closes transient UI without destroying document text

Head-control compatibility:

- controls have at least 44x44px targets
- at least 8px between adjacent controls
- no hover-only essential actions
- no tiny icon-only targets
- dwell must not by itself approve consequential changes

Screen reader:

- one page H1
- semantic document structure where possible
- toolbar has an accessible name
- save state announced politely only when it changes
- errors announced assertively
- AI proposal labels identify original/proposed text
- unsupported read-only content has concise accessible labels

At 320px and 200% zoom:

- no horizontal page overflow
- toolbar can wrap or collapse safely
- document remains readable
- side panels become overlays or stacked regions without covering the editor

## Copy rules

Keep UI copy short.

Prefer 2 to 4 word labels.

Examples:

- `Open document`
- `Choose document`
- `Open in Docs`
- `Saved`
- `Unsaved`
- `Saving`
- `Document changed`
- `Reload document`
- `Aksa Assist`
- `Select text first`
- `Apply change`
- `Discard`

Do not write long explanatory paragraphs inside the editor UI.

Use English and Indonesian localization for all user-facing text.

## Security and privacy

Follow `.agents/security.md` and the existing Google Workspace feature spec.

Must preserve:

- OAuth refresh token server-only and encrypted
- no Google token in client payloads
- least-privilege scopes
- no cached Google document body unless already explicitly allowed by architecture
- Google content treated as untrusted data, never instructions
- no URL/tool execution from document content
- no delete capability
- all writes bounded to user-approved targets
- real verification before success

AI context must not accidentally include the entire document when only a selection is needed.

## Implementation guidance

Reuse existing components, tokens, route conventions, state components, confirmation UI, and localization pipeline.

Before adding an editor dependency, inspect current dependencies.

If no suitable editor exists, a lightweight extensible editor such as TipTap/ProseMirror is acceptable for the PoC, but do not add it blindly. Confirm that it materially reduces selection, formatting, keyboard, and document-model complexity.

Do not use `contentEditable` with ad hoc DOM mutation as the entire editor architecture.

Do not build a custom rich-text engine from scratch.

Do not add a large dependency only to render read-only paragraphs.

## Suggested implementation sequence

### Pass 1: Connection and Picker

- replace diagnostic Docs state with real connection state
- wire `Connect Google`
- add `Choose document`
- launch Google Picker
- capture selected Doc ID through the safe backend/client contract

Stop and verify before continuing.

### Pass 2: Real read-only document

- call real Docs read path
- normalize Google document structure
- render title, headings, paragraphs, text formatting, lists
- render tables/images read-only where possible
- add `Open in Google Docs`
- add outline if straightforward

Stop and verify with at least two real test documents.

### Pass 3: Safe direct editing

- enable paragraph/heading text edits
- track dirty blocks
- map edits to structured operations
- require revision control
- apply via existing backend tool/write path
- verify by re-read
- handle conflict

Stop and verify before formatting writes.

### Pass 4: Basic formatting

- bold
- italic
- underline
- heading style
- lists only if mapping is reliable

Verify formatting round-trip against the actual Google Doc.

### Pass 5: Optional AI Assist

Only after the real read/write loop is stable.

- selection-first actions
- proposed-change panel
- Apply/Discard
- real confirmation
- verified write

## PoC test documents

Test against real Google Docs containing:

1. Simple student essay
   - title
   - headings
   - paragraphs
   - bold/italic/underline
   - hyperlink
   - bullet list
   - numbered list

2. Mixed document
   - headings
   - table
   - inline image
   - formatting around unsupported structures

The PoC passes only if editing ordinary text does not destroy the table/image or unrelated formatting.

## Verification

Test in a real browser.

Required states:

- anonymous
- connected/disconnected
- Picker open/cancel/select
- loading
- loaded
- unsaved
- saving
- saved
- missing scope
- reconnect required
- external revision conflict
- provider error
- AI unavailable
- AI proposal if configured

Required viewports:

- 1366x768
- 1440x900
- 1920x1080
- tablet
- 320px mobile
- 200% zoom

Required interaction tests:

- keyboard-only open/edit/save flow
- mouse flow
- head-control-compatible targets
- command input text fallback
- Picker focus restoration
- toolbar keyboard activation
- side-panel focus management
- no hidden/obscured focus

Regression assertions:

- no iframe to docs.google.com
- no browser automation of Google Docs
- no fake sample document when real data is unavailable
- no internal Google token exposed client-side
- unsupported structures are preserved/read-only rather than silently discarded
- a stale revision cannot be force-overwritten
- `Saved` appears only after verification
- AI proposal never auto-applies
- all visible writes have a real backing operation
- no horizontal overflow at 320px / 200% zoom

Run the repository's required commands, including localization compile, type checking, lint, focused tests, accessibility tests, Playwright coverage, and production build.

## Definition of done for first PoC

The PoC is complete when a reviewer can:

1. Sign in.
2. Connect Google.
3. Choose a real Google Doc in Picker.
4. Read that document inside Aksa with recognizable formatting.
5. Navigate it by keyboard.
6. Edit one ordinary paragraph or heading.
7. Save the change.
8. See Aksa verify and reload the real Google Doc.
9. Open the same file in Google Docs and see the change there.
10. Confirm unrelated formatting and unsupported structures were not destroyed.

AI Assist is optional for this milestone. Do not delay the verified Google Docs read/write loop to polish AI.

Stop after this first PoC is verified. Do not expand to Sheets, Gmail, Slides, add-ons, or extensions in the same pass.

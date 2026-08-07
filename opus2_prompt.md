# Aksa MVP Implementation Prompt for Opus

Repository: `zaltechdev/zhenix`  
Branch: `dev`  
Task mode: large implementation sprint  
Model guidance: use maximum reasoning  
Product: Aksa  
Product anchor: `Computer Vision + AI Agents + Accessibility`

Implement the next Aksa MVP slice as a frontend-complete, backend-ready web application.

The current local working tree is newer than the last pushed GitHub commit. Treat the local repository as the source of truth. Preserve approved work unless it conflicts with a higher-priority canonical document.

This prompt explicitly authorizes implementation after the initial assessment. Do not wait for another approval unless a real specification conflict, security risk, or missing required decision makes implementation unsafe.

---

## 1. Read and inspect before editing

Read root `AGENTS.md` completely.

Follow the required `.agents/` read order exactly:

1. `.agents/compbook.md`
2. `.agents/prd.md`
3. `.agents/rules.md`
4. `.agents/security.md`
5. `.agents/design.md`
6. `.agents/db_schema.md`
7. relevant `.agents/features/*.md`
8. `.agents/guide-henix.md`

At minimum, locate and read the feature specifications for:

- authentication and onboarding
- accessibility input
- agent orchestration
- Google Workspace
- grounded web search
- artifacts
- History and Activity
- confirmation
- cancellation
- Undo

Inspect:

- current branch
- `git status`
- complete unstaged and staged diffs
- current route tree
- current landing implementation
- current workspace implementation, if any
- localization messages and Paraglide configuration
- shared components
- design tokens
- public assets
- tests
- `.env.example`
- dependency versions in `package.json`

Never inspect:

- `.env`
- `.env.local`
- `.env.production`
- credentials
- SSH keys
- certificates
- token stores
- secret files

Before implementation, report:

1. current project state
2. canonical requirements affecting this task
3. what is already implemented locally
4. implementation phases
5. routes and files likely to change
6. conflicts, open questions, and risks

Then proceed.

---

## 2. Current pinned stack

Keep the existing pinned dependency graph unless a documented requirement cannot be met.

The repository currently uses:

- Bun `1.3.14`
- Next.js `16.3.0`
- React `19.2.8`
- TypeScript `5.9.3`
- Tailwind CSS `4.3.3`
- Paraglide JS `2.23.1`
- Zod `4.4.3`
- AI SDK `7.0.50`
- Drizzle ORM `0.45.2`
- Drizzle Kit `0.31.10`
- libSQL client `0.17.4`
- Tiptap `3.29.2`
- MediaPipe Tasks Vision `1.0.1`
- Vitest `4.1.10`
- Playwright `1.62.1`

Do not upgrade packages during this task.

Do not add a dependency when the task can be completed with the current stack and platform APIs.

If a new dependency is genuinely required:

1. explain why the existing stack cannot satisfy the requirement
2. pin an exact version
3. keep it compatible with the current Next.js and React versions
4. record the decision in the correct canonical document only when it changes the architecture

Important implementation conventions:

- Use React Server Components by default.
- Use Client Components only for browser APIs, editor interaction, local interactive state, dialogs, navigation drawers, and other genuinely client-side behavior.
- Do not make Server Components call the application’s own Route Handlers. Call server service modules directly to avoid an unnecessary internal HTTP round trip.
- Use Route Handlers for browser-originated BFF boundaries, streaming, callbacks, and external service entry points.
- Use Server Actions only when they simplify a form mutation and remain consistent with the repository architecture.
- Keep server-only modules protected from client imports.
- Validate every external or mutation boundary with Zod.
- Do not instantiate database, provider, or Google clients at module import time when missing configuration would break build or static rendering.

---

## 3. Product boundary

Aksa is a deployed web-only accessible AI workspace.

Aksa supports:

- landing page
- authentication interfaces
- onboarding
- camera and microphone permission flows
- future head-controlled pointer
- dwell and facial-gesture configuration
- voice and text command entry
- Aksa-owned document, file, sheet, mail, and search work surfaces
- Google Workspace integration boundaries
- grounded search boundaries
- visible task activity
- confirmation
- cancellation
- Undo
- History
- Activity

Aksa does not promise:

- full computer control
- browser chrome control
- native application control
- arbitrary website automation
- browser-level automation of Google interfaces
- autonomous purchases
- payments
- eye tracking
- hidden model reasoning
- real external integration success before it is configured and verified

Browser tabs, address bars, navigation buttons, window controls, and Chromium UI are environmental context. They are not Aksa features and must not be recreated inside the app.

---

## 4. Ownership boundary

Preserve the documented Henix and Zaltech ownership model.

### Henix-owned implementation in this task

- frontend architecture
- routes and layouts
- components
- UI and UX
- responsive behavior
- localization
- accessibility presentation and interactions
- browser permission flows
- frontend state
- frontend tests
- browser tests

### Zaltech-owned implementation to scaffold only

- authentication internals
- sessions
- authorization enforcement
- database access
- Google OAuth
- Google API clients
- provider execution
- server-side agent execution
- tool execution
- infrastructure
- backend security and reliability tests

Cross-boundary work must be represented as typed contracts.

The frontend states what it needs.

The server contract states what it guarantees.

Do not make frontend components aware of database rows, Google tokens, provider payloads, or model-specific behavior.

---

## 5. Implementation target

Deliver a coherent MVP that proves the Aksa interaction model without fabricating external integrations.

The required product path is:

1. open the approved landing page
2. select `Try Aksa`
3. reach account or demo entry
4. pass through onboarding with honest skip and fallback paths
5. enter the Aksa workspace
6. navigate the workspace without a mouse
7. open minimal Documents, Files, Sheets, Gmail, and Web Search surfaces
8. type a command in the persistent composer
9. see what Aksa understood
10. review a consequential action
11. cancel or approve it
12. see an honest result state
13. open Activity
14. see Undo when supported by the returned contract

External services may remain unconfigured. Unconfigured systems must return explicit typed states rather than fake success.

---

## 6. Preserve the approved landing hero

Do not redesign the approved landing hero.

Preserve:

- the existing landscape background
- the baked ASCII treatment
- the current centered composition
- the approved Aksa logo usage
- the current WCAG-oriented light presentation
- the current floating illustrative preview position
- the current typewriter behavior if it meets the specification

The approved hero copy is:

Headline:

`Say the task.`  
`Aksa handles the steps.`

Supporting sentence:

`A hands-free AI workspace for`

Rotating final phrases:

- `documents`
- `files`
- `sheets`
- `online classes`

CTA order:

1. `Try Aksa`
2. `See how it works`

The CTA row must be the final text control row before the product preview.

Typewriter requirements:

- animate only the changing phrase
- prevent layout shift
- expose a stable full sentence to assistive technology
- avoid character-by-character screen-reader announcements
- respect reduced motion
- show a static complete sentence when motion is reduced

Only fix verified defects in the hero.

Do not spend the sprint rebuilding the marketing page.

Add only the minimum supporting landing sections needed to make navigation anchors valid if they do not already exist.

---

## 7. Final Aksa application shell

Use the intended wireframe as the information architecture.

The application has three primary regions:

1. Aksa navigation sidebar
2. central Aksa-owned workspace
3. persistent speak or type command composer

Do not create fake browser chrome.

Do not copy Codex, Google Docs, Google Drive, Google Sheets, Gmail, or another product.

Codex may inform the command-oriented density only.

### 7.1 Desktop shell

At desktop widths:

- left navigation sidebar
- compact workspace header
- main work surface
- composer sticky near the bottom of the main region
- no permanent right panel by default

Recommended sidebar width:

- expanded: approximately `240px` to `280px`
- collapsed: icon rail only if the implementation remains clear and accessible

### 7.2 Tablet shell

At tablet widths:

- sidebar may collapse
- main work surface preserves usable reading width
- composer remains reachable
- controls wrap before becoming too small

### 7.3 Mobile shell

At mobile widths:

- navigation becomes a labeled drawer
- main workspace uses one column
- composer remains last in DOM reading order
- composer may be visually sticky above the safe-area inset
- no horizontal overflow at `320px`
- no desktop-sized tables forced beyond the viewport
- no icon-only navigation without accessible names

### 7.4 Sidebar navigation

Primary navigation:

- Home
- Documents
- Files
- Sheets
- Gmail
- Web Search
- History
- Activity

Lower navigation:

- Accessibility
- Settings
- Account

Requirements:

- current route uses `aria-current`
- targets are at least `44px` by `44px`
- at least `8px` separation where adjacent targets could cause accidental activation
- visible focus
- keyboard operation
- localized labels
- long Indonesian labels wrap cleanly
- mobile drawer traps focus and restores it to the trigger

### 7.5 Workspace header

The workspace header may contain:

- current location or resource title
- breadcrumb
- Google connection status
- current task status
- accessibility shortcut
- account menu

Keep it quiet and compact.

Do not style it like a browser toolbar.

---

## 8. Persistent command composer

Create one reusable persistent command composer for the workspace.

Desktop:

- centered inside the main content region
- sticky near the bottom
- maximum width around `720px` to `900px`
- does not cover essential content

Mobile:

- full available width with safe margins
- sticky above the safe-area inset
- usable with the on-screen keyboard
- no viewport overflow when the keyboard opens

The composer supports:

- typed input
- voice trigger
- editable transcript
- submit
- stop listening
- cancel current task
- clear
- retry
- example-command insertion

Visible states:

- Ready
- Listening
- Writing your words
- Preparing the task
- Working
- Review before action
- Completed
- Partially completed
- Failed
- Cancelled

Do not simulate voice recognition.

Use the real browser speech recognition API only behind capability detection and only if the canonical feature specification allows it.

When unsupported or unavailable, show a text fallback and an explicit state.

Do not simulate agent execution.

When the agent backend is unavailable, command submission must return an honest state such as:

- `not_configured`
- `connection_required`
- `unsupported`
- `unavailable`

Example commands may fill the input but must not fabricate execution.

---

## 9. Minimal embedded work surfaces

The user requires minimal working Documents, Drive, Sheets, Gmail, and Search experiences so Zaltech can connect real backend services later.

Here, embedded means rendered inside Aksa’s own workspace.

It does not mean:

- iframe Google products
- copy Google interfaces
- browser automation
- place a Google page inside Aksa

Each surface must be functional as a frontend component and consume a typed adapter contract.

Each surface must support:

- loading
- disconnected
- connection required
- missing scope
- empty
- data loaded
- error
- unavailable
- partial result where applicable

Fixtures are allowed only in tests or a clearly labeled development-only illustrative mode.

Production routes must never present fixture data as real user data.

### 9.1 Home workspace

Create a calm default workspace home.

Include:

- one concise explanation
- current capability and connection summary
- safe example commands
- recent task region with an honest empty state
- persistent composer

Example commands:

- `Open my latest assignment`
- `Find the files for this project`
- `Summarize a document`
- `Read a sheet range`
- `Search the web with sources`

Selecting one fills the composer only.

### 9.2 Documents workspace

Build an original Aksa document work surface.

Use the installed Tiptap packages.

Minimum behavior:

- document title
- optional document tab selector
- read-only and editable modes
- editor content surface
- unsaved state
- loading state
- disconnected state
- missing permission state
- too-large state
- error state
- edit review state
- confirmation before external writes
- visible source connection indicator

Prepare the data contract for Google Docs:

- document ID
- title
- tabs
- structured content blocks or a normalized Tiptap document
- revision or version reference when available
- permission capabilities
- load state

Google Docs supports document tabs. Do not assume every document has only one body.

The future backend may use `documents.get` with tab content and `documents.batchUpdate`.

The frontend must not know Google request payloads.

The illustrative `Programming Assignment 04` state may remain, but it must be labeled as an illustrative preview unless backed by real persisted task data.

Do not copy Google Docs toolbars.

### 9.3 Files and Drive workspace

Build an original Aksa files work surface.

Minimum behavior:

- search
- folder and file list
- type, modified date, and location metadata
- selection
- open action
- rename preview
- move preview
- create-folder preview
- confirmation before writes
- partial operation result
- Undo presentation when returned
- disconnected state
- missing scope state
- rate-limit state
- empty state

Prepare the contract for Drive API data:

- file ID
- name
- MIME type
- parent references
- modified time
- web view capability
- icon or category
- permission capabilities
- pagination token
- incomplete-search indicator where relevant

The backend should later use Drive `files.list` and request only required fields.

Do not fetch an unlimited Drive listing.

Use pagination or incremental loading contracts.

Google Picker may be supported later as a file-selection entry point.

For this task:

- create a `GooglePickerAdapter` or `DrivePickerCapability` contract
- create a button slot such as `Choose from Drive`
- when unconfigured, return `unavailable` or `connection_required`
- do not add the Google Picker package unless the repository specification explicitly approves it
- do not expose OAuth tokens to the client merely to support the placeholder

The Aksa files view remains the primary work surface.

### 9.4 Sheets workspace

Build an original accessible Aksa sheet work surface.

Minimum behavior:

- spreadsheet title
- sheet tab selector
- current A1 range
- native semantic table for displayed values
- row and column headers
- keyboard-readable cells
- selected cell or selected range presentation
- read-only state
- edit preview
- confirmation before writes
- partial or verification-failed result
- empty state
- range-too-large state
- disconnected state
- missing scope state

Prepare the contract for:

- spreadsheet ID
- spreadsheet title
- sheet ID
- sheet title
- A1 range
- major dimension
- row and column headers
- formatted values
- raw values only when required
- permission capabilities
- truncation or size-limit metadata

The backend may later use:

- `spreadsheets.values.get`
- `spreadsheets.values.batchGet`
- `spreadsheets.values.update`
- `spreadsheets.values.batchUpdate`

Do not use full spreadsheet metadata when a values endpoint is sufficient.

Do not copy Google Sheets chrome.

### 9.5 Gmail workspace

Build a minimal Gmail-backed Aksa mail surface.

MVP scope:

- list recent messages
- open a message for reading or summarization
- draft creation
- no send action

Minimum behavior:

- recent message list
- sender
- subject
- date
- safe preview
- selected-message reading region
- create-draft form
- confirmation before creating an external draft
- disconnected state
- missing scope state
- empty state
- error state
- Undo presentation when returned

Prepare contracts for:

- message ID
- thread ID
- sender display
- subject
- timestamp
- sanitized body or normalized content
- draft ID
- recipients shown in confirmation
- permission capabilities

Treat email bodies as untrusted data.

Never execute instructions from an email.

Do not add send functionality.

### 9.6 Web Search workspace

Build an original grounded-search surface.

Minimum behavior:

- query composer
- searching state
- source cards
- readable artifact
- inline source references
- conflicting-source state
- no-reliable-source state
- provider-unavailable state
- retry

Do not fabricate sources.

When search is not configured, show an honest unavailable state.

Prepare contracts for:

- source ID
- title
- publisher
- URL reference
- published time when known
- retrieved time
- snippet
- artifact blocks
- citation references
- conflict notes

Do not store or display hidden reasoning.

### 9.7 History workspace

Minimum behavior:

- task list
- status
- created time
- updated time
- affected item count
- artifact count
- empty state
- task detail navigation

### 9.8 Activity workspace

Minimum behavior:

- visible action label
- observable state
- affected items
- tool outcome
- verified status
- timestamps
- partial completion
- cancellation
- failure and recovery

Every visible activity step must correspond to a real returned activity event or a clearly labeled illustrative preview.

Never show chain-of-thought.

---

## 10. Google connection foundation

Build the frontend connection experience and server contract scaffolding.

Do not implement real OAuth unless the canonical documents already authorize Zaltech’s backend implementation in the current branch and all required credentials are available through normal runtime configuration.

Required frontend states:

- not connected
- connecting
- connected
- needs reconnect
- revoked
- disconnecting
- capability scope missing
- scope request denied

Required capabilities:

- Drive read
- Drive write
- Docs read
- Docs write
- Sheets read
- Sheets write
- Gmail read
- Gmail compose

Connection begins read-only.

Write capability is requested only when a user asks for a write.

Every permission state names the specific capability.

No generic `Access denied` message when the system knows the missing capability.

Create a typed `GoogleWorkspaceGateway` interface with methods or grouped services for:

- connection status
- Drive search and metadata
- Drive move
- Drive rename
- Drive create folder
- Docs read
- Docs structured edit
- Sheets read range
- Sheets write range
- Gmail list recent
- Gmail read message
- Gmail create draft

Do not expose Google access tokens or refresh tokens to Client Components.

Future OAuth must use a web-server authorization-code flow with server-side token handling.

Do not use embedded user agents for Google OAuth.

---

## 11. Task state and command contracts

Create reusable Zod schemas and TypeScript types for:

### Capability

- capability name
- availability
- connection requirement
- scope requirement
- reason
- safe next action

### Command

- command ID
- typed text
- transcript
- locale
- submitted time
- source: text or voice

### Task

- task ID
- user-visible title
- intent category
- state
- created time
- updated time
- affected items
- artifact references
- confirmation reference
- cancellation availability
- Undo availability

### Task states

- `idle`
- `listening`
- `transcribing`
- `understanding`
- `executing`
- `waiting_for_confirmation`
- `completed`
- `partially_completed`
- `failed`
- `cancelled`
- `undo_available`

### Activity event

- event ID
- task ID
- user-visible action
- state
- affected items
- result summary
- verified
- created time
- error category when applicable

### Confirmation

- confirmation ID
- action
- named scope items
- consequence
- external system
- recovery statement
- expires at
- approve capability
- edit capability
- cancel capability

### Undo

- Undo ID
- supported
- reason when unsupported
- affected items
- state
- result summary

Use discriminated unions where they make invalid states impossible.

Do not include provider reasoning.

Do not return raw database rows.

---

## 12. Confirmation, cancellation, and Undo

### 12.1 Confirmation

Create one reusable accessible confirmation component.

It must show:

- action
- named items or summarized scope
- destination where relevant
- consequence
- external-system disclosure
- whether Undo is supported
- Confirm
- Edit
- Cancel

Focus rules:

- dialog has a programmatic name
- initial focus is not placed on the dangerous action
- Escape cancels when safe
- focus returns to the trigger
- no keyboard trap failure
- dwell or facial gesture alone cannot approve

### 12.2 Cancellation

A running task must expose cancellation.

The frontend contract must support:

- cancellation requested
- cancellation accepted
- already completed
- unable to cancel
- completed steps preserved
- partial result returned

Do not show a fake instantaneous cancel success.

### 12.3 Undo

Undo must support:

- available
- running
- completed
- partially completed
- failed
- unavailable

State why Undo is unavailable before the user approves an irreversible action.

Do not use an inaccessible countdown as the only indication of availability.

---

## 13. Authentication foundation

Implement account UI and backend-ready contracts.

Required routes or equivalent route groups:

- sign up
- sign in
- sign out action
- session expired
- account settings

Use the repository’s selected authentication library only if one is already approved and installed.

The current dependency graph does not include an authentication library.

Therefore:

- do not install one merely to complete this prompt
- create an `AuthGateway` or `AuthAdapter` contract
- implement validated form UI
- return `not_configured` from the server boundary when auth is not wired
- keep a clearly labeled local demo-entry route only if allowed by the canonical documents

Required UI behavior:

- persistent labels
- autofill
- password-manager compatibility
- password requirement text
- field errors
- form-level error summary
- focus moves to the summary after failure
- duplicate submission prevention
- localized copy
- no camera or microphone permission request during account entry

---

## 14. Onboarding foundation

Implement the frontend onboarding route and honest browser capability checks.

Required steps:

1. welcome
2. explanation of hands-free interaction
3. camera privacy explanation
4. camera permission request
5. head-control setup surface
6. sensitivity, dead zone, and smoothing controls
7. dwell or gesture choice
8. microphone privacy explanation
9. microphone permission request
10. voice test with editable transcript
11. first command
12. completion
13. skip and resume later

Use real browser permission APIs where supported.

Do not implement fake head tracking.

MediaPipe is installed, but full tracking is not required in this sprint unless the canonical feature document explicitly makes it a blocking MVP requirement.

When tracking is not implemented, show:

`Face control setup is not active in this build.`

Provide:

- retry camera
- use keyboard
- use mouse
- retry microphone
- use text
- skip
- resume later

Do not store camera frames.

Do not send camera frames to the server.

---

## 15. Backend scaffolding

Build minimal server-side architecture that Zaltech can continue.

Recommended module boundaries, adjusted to existing repository conventions:

- `server/config`
- `server/auth`
- `server/db`
- `server/tasks`
- `server/activity`
- `server/confirmations`
- `server/undo`
- `server/google`
- `server/search`
- `server/ai`
- `server/errors`

Do not force these exact paths if the repository already has a coherent equivalent.

### 15.1 Server service layer

Server Components should call service functions directly.

Client Components should interact through:

- Server Actions for suitable forms
- Route Handlers for browser-originated requests
- future streaming endpoints for task events

### 15.2 Route Handler boundaries

Add only the boundaries needed by the implemented frontend.

Possible boundaries:

- capability status
- session status
- onboarding preferences
- command submission
- task status
- task cancellation
- confirmation response
- Undo request
- Google connection status
- Drive search
- History list
- Activity list

Do not create many empty endpoints merely for symmetry.

Every boundary:

- validates input
- validates output where practical
- returns minimal shaped data
- uses stable error categories
- never returns fake `completed`
- never exposes secrets

### 15.3 Database

Use Drizzle and libSQL only according to `.agents/db_schema.md`.

Do not invent schema.

Do not run destructive migrations.

If database configuration is absent:

- keep connection creation lazy
- return a typed `not_configured` state
- allow production build to succeed
- document placeholders in `.env.example`

### 15.4 AI provider scaffold

The repository includes AI SDK Core but not a Vertex provider package.

Do not install a provider package unless the canonical plan requires actual provider execution in this sprint.

Create:

- provider configuration schema
- provider registry interface
- agent runner interface
- tool registry interface
- task event interface
- retry and timeout configuration types

Future implementation may use AI SDK 7 tool calling or a tool loop with explicit stopping conditions.

The model never determines authorization.

The server decides whether a requested tool is allowed.

No provider call originates from a Client Component.

### 15.5 Google backend scaffold

Create server-only interfaces and normalized domain models.

Do not import Google API payload types into components.

Plan future operations around:

- Drive `files.list` with explicit `fields`
- Docs `documents.get`
- Docs `documents.batchUpdate`
- Sheets values read and write endpoints
- Gmail recent message reads
- Gmail draft creation

Writes require:

- scope check
- confirmation
- single execution
- verification read
- typed result
- Undo record when supported

---

## 16. Error model

Create stable error categories such as:

- `not_configured`
- `connection_required`
- `scope_required`
- `authentication_required`
- `session_expired`
- `permission_denied`
- `not_found`
- `unsupported`
- `unavailable`
- `rate_limited`
- `timeout`
- `validation_failed`
- `verification_failed`
- `partial_failure`
- `cancelled`
- `undo_unavailable`
- `internal_error`

Each error includes:

- category
- safe user message key
- retryable flag
- preserved-progress summary where relevant
- next actions
- debug reference safe for logs

Do not send raw provider or Google errors to the client.

Do not put private document or email content in logs.

---

## 17. State strategy

Use server data for persistent truth.

Use React state for local component state.

Use Zustand only if multiple distant interactive components must share fast client state, such as:

- composer transcript
- current client-only accessibility controls
- active temporary task drawer

Do not place server resources, Google content, or full task history into a global client store without a demonstrated need.

Keep URL state for navigable selections where appropriate.

---

## 18. Localization

Use the existing Paraglide setup.

No hardcoded user-facing strings in components.

Localize:

- route headings
- navigation
- buttons
- form labels
- errors
- connection states
- capability names
- confirmation text
- live-region announcements
- empty states
- date and time presentation
- counts
- file sizes

Do not concatenate translated sentence fragments.

Typewriter content must use locale-safe complete messages or named variants.

Test Indonesian as the longer layout case.

Do not mix languages inside one status message.

---

## 19. Accessibility

Target WCAG 2.2 AA.

Required:

- semantic landmarks
- one H1 per page
- valid heading order
- visible focus
- keyboard navigation
- mouse parity
- touch parity
- screen-reader names
- at least `44px` targets
- at least `8px` target separation
- no color-only status
- no hover-only action
- no keyboard trap outside an active dialog
- focus restoration after dialogs and drawers
- reduced-motion behavior
- usable at `200%` zoom
- no horizontal overflow at `320px`
- readable long names
- live regions for task states
- assertive announcements only for confirmation and failure
- camera and microphone fallbacks
- stable typewriter accessible text
- no repeated rapidly changing announcements

Audit real color combinations.

Do not assume a token automatically passes contrast.

---

## 20. Visual direction

Landing:

- Calm Computational Nature
- approved landscape
- baked ASCII treatment
- bright and calm
- restrained glass
- existing logo assets unchanged

Workspace:

- functional and quiet
- soft off-white canvas
- white or charcoal surfaces
- dark ink
- mint accent
- thin slate borders
- restrained elevation
- Host Grotesk headings
- Inter UI

Avoid:

- landscape imagery inside normal workspace content
- generic purple AI gradients
- neon
- copied Google UI
- copied Codex UI
- fake operating-system frames
- fake browser frames
- decorative controls
- dense dashboard cards without a task purpose
- chain-of-thought displays
- em dash characters

---

## 21. Development fixtures and honesty

Mocks and fixtures may be used:

- in Vitest
- in Playwright
- in component test stories
- in a clearly labeled development-only illustrative route

Production routes must not silently use fixture data.

If a development preview is visible:

- label it `Illustrative preview`
- do not label its state as verified
- do not mix it with real History
- do not write it to production persistence

Never present:

- fake Google files
- fake email
- fake search citations
- fake provider success
- fake agent activity

as real user data.

---

## 22. Recommended implementation phases

Work in vertical, verifiable slices.

### Phase 0: local-state assessment

- inspect local uncommitted work
- preserve approved hero
- resolve build or test regressions
- confirm current route structure

### Phase 1: application shell

- workspace layout
- sidebar
- mobile drawer
- workspace header
- composer
- route foundations
- accessibility control entry point

### Phase 2: shared contracts and states

- capabilities
- commands
- tasks
- activity
- confirmation
- cancellation
- Undo
- stable error model

### Phase 3: resource surfaces

Implement minimal functional frontend surfaces for:

- Documents
- Files and Drive
- Sheets
- Gmail
- Web Search
- History
- Activity

Use adapters and honest unavailable states.

### Phase 4: interaction controls

- command submission
- task state rendering
- confirmation
- cancel
- Undo
- focus management
- live-region announcements

### Phase 5: auth and onboarding foundations

- account screens
- adapter boundary
- onboarding steps
- browser permission handling
- skip and fallback paths

### Phase 6: backend-ready server layer

- server services
- validation
- Route Handlers and Server Actions only where needed
- lazy configuration
- Google gateway
- task gateway
- auth gateway
- provider gateway
- database gateway

### Phase 7: tests and hardening

- component tests
- contract tests
- Playwright primary flow
- mobile
- keyboard-only
- reduced motion
- permission denial
- honest unavailable responses
- build

After each phase:

1. inspect the diff
2. run relevant lint
3. run type checking
4. run focused tests
5. fix verified regressions
6. continue only when stable

Do not wait until the end to run checks.

---

## 23. Required tests

### Vitest

Cover:

- contract schemas
- error discriminated unions
- sidebar navigation
- active route state
- composer states
- transcript editing
- capability unavailable states
- Documents states
- Drive states
- Sheets states
- Gmail states
- Search states
- confirmation rendering
- focus intent where testable
- cancellation rendering
- Undo states
- localization
- reduced motion
- no fake completed response from stubs

### Playwright

Cover the frontend path:

1. open landing
2. switch language
3. use `Try Aksa`
4. reach account or approved demo entry
5. use onboarding skip paths
6. reach workspace
7. navigate sidebar with keyboard
8. open Documents
9. open Files
10. open Sheets
11. open Gmail
12. open Web Search
13. type a command
14. receive an honest unavailable or connection-required response
15. open a confirmation example
16. cancel it
17. open History
18. open Activity
19. verify focus restoration

Also test:

- mobile drawer
- `320px` viewport
- no horizontal overflow
- composer remains reachable
- reduced motion
- camera denied
- microphone denied
- long Indonesian labels
- dialog keyboard behavior
- visible focus

Do not treat mocked integrations as evidence that Google or AI works.

---

## 24. Completion gates

Before reporting completion, run the actual commands defined by the repository for:

1. localization compilation or validation
2. lint
3. strict TypeScript
4. Vitest
5. relevant Playwright suite
6. production build

Report exact commands and exact outcomes.

Do not say `pass` unless the command ran and passed.

If a command cannot run:

- state why
- state what was verified instead
- do not hide the gap

Append one verified entry to `logs/log.md`.

Update a debug file only for a real reproduced issue with a verified fix.

---

## 25. Git rules

- remain on `dev`
- do not force-push
- do not reset hard
- do not delete branches
- do not inspect secrets
- do not stage unrelated files
- do not add co-author trailers
- do not commit
- do not push

Commit and push only after a separate explicit request.

---

## 26. Final response format

Finish with:

1. current implementation summary
2. routes created or updated
3. approved landing work preserved
4. workspace shell completed
5. resource surfaces completed
6. backend contracts scaffolded
7. integrations deliberately left unconfigured
8. changed files grouped by area
9. verification commands and results
10. accessibility checks performed
11. known limitations
12. recommended next Zaltech backend slice

The recommended backend slice should identify the smallest real vertical integration to implement next, preferably:

1. session and connection status
2. Google OAuth read-only connection
3. Drive file search
4. Docs read
5. Sheets range read
6. Gmail recent-message read
7. reviewed write actions afterward

Do not recommend implementing every external integration at once.

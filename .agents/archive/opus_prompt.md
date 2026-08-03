# Prompt for Opus 5 XHigh (by Henix)

You are working inside the **Aksa** repository.

Your task is to create the complete project guidance and implementation plan for Aksa. Do not implement product code yet. First produce the canonical Markdown documents that all coding agents will follow.

Aksa is a web-only accessible AI workspace built around:

**Computer Vision + AI Agents + Accessibility**

The product helps users with motor impairments navigate and complete digital tasks using head movement, facial gestures or dwell selection, voice or text commands, AI agents, Google Workspace integrations, web search, readable artifacts, task history, confirmation, and Undo.

---

## 1. Read the Repository First

Inspect the repository before writing anything.

Read in this order:

1. Root `AGENTS.md`, if present
2. `.agents/guide-henix.md`
3. `.agents/guide-zaltech.md`
4. `.agents/compbook.md`
5. `.agents/design.md`
6. `.agents/color_font.md`
7. Existing files under `.agents/features/`
8. Existing project structure, routes, components, package files, assets, configuration, and schemas
9. Existing logo assets
10. Existing source code only to understand current constraints

Use repository documents as the source of truth.

Do not silently invent requirements that conflict with existing files.

If documents conflict, use this priority:

1. Competition requirements in `.agents/compbook.md`
2. Product scope in `.agents/prd.md`
3. Security requirements in `.agents/security.md`
4. Repository rules in `.agents/rules.md`
5. Design requirements in `.agents/design.md`
6. Feature specifications
7. Role guides
8. Existing implementation

Mark unresolved conflicts under **Open Questions**.

---

## 2. Required Files

Create or update:

```text
AGENTS.md

.agents/
├── compbook.md
├── prd.md
├── rules.md
├── security.md
├── db_schema.md
├── debug-henix.md
├── debug-zaltech.md
└── features/
    ├── auth-onboarding.md
    ├── accessibility-controls.md
    ├── agent-orchestration.md
    ├── virtual-workspace.md
    ├── google-workspace.md
    ├── web-search-artifacts.md
    └── history-activity.md
```

Keep `.agents/` as the canonical guidance directory.

Do not maintain duplicate, divergent copies of the same document elsewhere.

---

## 3. Team Responsibility Boundary

### Henix owns

- frontend architecture
- UI and UX
- user flows
- accessibility interactions
- responsive behavior
- component behavior
- interface copy
- visual states
- frontend testing
- frontend acceptance criteria

### Zaltech owns

- backend architecture
- database
- APIs
- authentication internals
- Google integrations
- server-side agents
- provider integration
- infrastructure
- backend testing
- QA implementation

The documents may define contracts between frontend and backend, but must not assign the same implementation responsibility to both people.

Use interface-level wording where ownership crosses boundaries.

Example:

- Good: “The frontend receives a task status and renders it.”
- Bad: “The frontend writes directly to the task table.”

---

## 4. Product Boundary

Aksa is a deployed web application.

Aksa does not control the full operating system.

Supported product scope:

- landing page
- authentication
- onboarding
- camera permission
- head-controlled pointer
- facial gesture selection
- dwell selection
- microphone input
- text fallback
- AI task orchestration
- Aksa-owned virtual workspace
- Google Drive
- Google Docs
- Google Sheets
- Gmail
- optional Google Calendar
- grounded web search
- source-backed readable artifacts
- task history
- activity view
- confirmation
- cancellation
- Undo

Do not promise:

- full PC control
- native application control
- arbitrary website control
- autonomous checkout
- banking actions
- browser-level Google Docs control
- copied Google interface
- webcam eye tracking unless it is truly implemented
- hidden chain-of-thought
- fabricated tool results
- success before verification

The Google document experience must be an original Aksa interface backed by Google APIs.

---

## 5. Primary User Flow

Document and align all files around this flow:

1. User opens the landing page.
2. User signs in or creates an account.
3. User enters onboarding.
4. Aksa asks for camera permission.
5. User tests head pointer tracking.
6. User calibrates sensitivity, dead zone, smoothing, dwell, or facial gesture.
7. Aksa asks for microphone permission.
8. User tests voice input with text fallback.
9. Aksa asks the user to say: “Open Google Docs.”
10. The virtual workspace opens an Aksa document environment.
11. The user opens Web Search.
12. The user asks: “Search the latest AI coding tool news and summarize it.”
13. The Search Agent retrieves current sources.
14. Aksa creates a concise, easy-to-read artifact with citations.
15. The task is stored in History.
16. The Activity tab shows actions and outcomes without hidden reasoning.

Also define failure flows for:

- camera permission denied
- microphone permission denied
- unsupported speech recognition
- head tracking lost
- calibration failure
- Google account disconnected
- expired OAuth token
- provider timeout
- rate limit
- search returns no useful source
- partial task completion
- tool failure
- cancellation
- Undo failure

---

## 6. Technology Stack

Treat this as the default stack. Do not replace major technologies without a concrete repository conflict or a documented reason.

### Application

- Next.js with App Router
- React
- TypeScript with strict mode
- Tailwind CSS
- Server Components by default
- Client Components only for browser interaction, local state, camera, microphone, and highly interactive UI

### Data

- Turso hosted libSQL
- Drizzle ORM
- Drizzle migrations
- SQLite-compatible schema design
- IndexedDB only for temporary browser-side state, offline calibration data, drafts, or demo fallback where appropriate

### Internationalization

- Paraglide JS
- Indonesian and English from the start
- no hardcoded user-facing strings inside components
- no string concatenation for translated sentences

### Authentication

- use an established Next.js-compatible authentication library after inspecting the repository
- Better Auth or Auth.js are acceptable candidates
- do not build custom password cryptography or custom session security
- authorization remains server-side and separate from authentication

### AI and Agents

- Vercel AI SDK as the provider and streaming abstraction where suitable
- Vertex AI as the primary provider
- a current low-cost Gemini Flash-Lite-class model as the default orchestrator
- Dahl Inference through its OpenAI-compatible API as a configurable fallback
- Kimi K2.6 and MiniMax M2.7 are text-only fallback candidates
- Zod schemas for all model outputs and tool arguments
- typed tool registry
- bounded agent loops
- explicit confirmation before consequential actions
- provider routing must live behind an abstraction, not throughout UI code

Do not call multiple providers for every request merely to appear multi-model.

### Computer Vision and Accessibility Input

- MediaPipe Tasks Vision in the browser
- Face Landmarker for head pose and facial gesture signals
- local camera processing where possible
- Web Worker or equivalent off-main-thread processing where practical
- head movement for pointer control
- facial gesture or dwell for selection
- keyboard and mouse fallback
- do not claim webcam eye tracking unless it is genuinely implemented

### Voice

- browser speech recognition for the competition prototype where supported
- editable transcript before submission
- text input as a mandatory fallback
- browser speech synthesis or an equivalent read-aloud layer where appropriate
- unsupported-browser and permission-denied states must be designed

### Workspace and Editors

- TipTap for the Aksa document editor unless the existing repository already uses a suitable alternative
- TanStack Table or an accessible native table approach for sheet-style data
- Zustand for lightweight client interaction state where React state is insufficient
- do not store server-authoritative product data only in client state

### Google Integrations

- Google OAuth 2.0
- Google Drive API
- Google Docs API
- Google Sheets API
- Gmail API
- Google Calendar API only if it remains inside MVP capacity
- least-privilege and incremental scopes
- original Aksa UI backed by APIs
- no iframe, copied Google UI, or simulated control of the Google website

### Web Search and Artifacts

- Vertex AI grounding with Google Search when available and suitable
- provider abstraction for search so another source can be added later
- cited, source-backed artifacts
- external webpages, emails, and documents are untrusted content
- safe rendering and prompt-injection defenses are mandatory

### Validation and Testing

- Zod for runtime validation
- Vitest for unit and integration tests unless the repository already standardizes another runner
- Playwright for end-to-end browser tests
- accessibility checks using semantic HTML, keyboard testing, and automated tooling where practical

### Deployment and Operations

- Vercel for the deployed Next.js web application unless the repository already targets another compatible platform
- Turso for production data
- server-only environment variables
- `.env.example` for documented configuration
- structured server logs with secret and personal-data redaction
- provider usage and cost tracking

### Typography

- Host Grotesk for headings and brand-facing display text
- Inter for body text, controls, forms, and navigation
- no monospace typography in the consumer UI

### Provider Limits

Do not hardcode unverified provider limits such as fixed RPM values.

Treat provider limits as deployment configuration and support:

- `429` handling
- request timeout
- exponential backoff with jitter
- `Retry-After`
- queue and concurrency limits
- provider fallback
- circuit breaker
- duplicate request protection
- per-user budget
- per-workspace budget
- daily cost ceiling

If the repository already contains a valid alternative for a secondary library, preserve it and document the reason instead of creating unnecessary migration work.

---

## 7. Root `AGENTS.md`

Keep root `AGENTS.md` short.

It must tell every coding agent to read:

- `.agents/compbook.md`
- `.agents/prd.md`
- `.agents/rules.md`
- `.agents/security.md`
- `.agents/design.md`
- the relevant `.agents/features/*.md`
- the correct role guide

It must also state:

- never inspect `.env`, `.env.local`, SSH keys, credentials, or secret files
- use `.env.example`
- never fabricate task success
- never expose hidden model reasoning
- update a debug file only after a real verified issue
- respect Henix and Zaltech ownership boundaries

Do not turn `AGENTS.md` into a giant handbook.

---

## 8. `.agents/prd.md`

Create a complete but concise Product Requirements Document.

Include:

- product summary
- one-sentence pitch
- problem
- target users
- primary persona
- secondary persona
- goals
- non-goals
- product principles
- MVP scope
- full user flow
- failure flows
- functional requirements with IDs
- non-functional requirements
- browser support
- accessibility requirements
- agent states
- Google Workspace scope
- web-search scope
- artifact behavior
- history behavior
- activity behavior
- confirmation behavior
- Undo behavior
- success metrics
- competition demo flow
- acceptance criteria
- future scope
- open questions

Keep the MVP centered on one excellent end-to-end demo.

Do not turn the PRD into a technical architecture document.

---

## 9. `.agents/rules.md`

Define:

- documentation priority
- conflict resolution
- role boundaries
- technology constraints
- architecture boundaries
- server-only secrets
- no model calls from client components
- typed tool schemas
- provider abstraction
- no business logic in presentational components
- no fabricated agent output
- no hidden reasoning in UI
- confirmation before consequential actions
- verification after tool execution
- cancellation
- timeout
- maximum tool iterations
- component reuse
- accessibility requirements
- localization rules
- testing rules
- quality gates
- Git and commit rules
- documentation update rules
- MVP scope protection
- prohibited features

Keep rules direct and enforceable.

---

## 10. `.agents/security.md`

Use official security sources first.

Reddit may be used only to discover practical threat scenarios. Verify mitigations against authoritative sources.

Cover:

### Authentication

- established authentication library
- secure session cookies
- session rotation
- session revocation
- server-side authorization
- central data access layer
- minimal DTO responses
- protected Route Handlers
- protected Server Actions
- CSRF
- XSS
- CSP
- clickjacking
- secure headers

### IDOR and BOLA

Explicitly answer:

> What happens if a user changes or removes part of a URL, task ID, artifact ID, history ID, workspace ID, or confirmation ID?

Every tenant-owned object must be authorized server-side using the authenticated session and ownership.

Never trust a `userId` or `workspaceId` from client input.

Add tests for:

- changing another user’s task ID
- guessing artifact IDs
- accessing history from another account
- calling API routes directly
- replaying a confirmation
- accessing deleted records
- accessing expired records
- modifying route parameters

### Multi-Tenant Data

- scope records by user and workspace
- centralize ownership checks
- never rely on client-only guards
- safe deletion
- retention
- export rules
- audit history

### Google OAuth

- least privilege
- incremental consent
- refresh tokens server-side only
- encrypted refresh tokens at rest
- revocation
- disconnect flow
- expired token flow
- read-only defaults
- confirmation before write, move, share, send, or delete

### AI Agent Security

Cover:

- direct prompt injection
- indirect prompt injection
- untrusted webpage content
- untrusted email content
- untrusted document content
- tool abuse
- excessive agency
- insecure output handling
- sensitive data exposure
- model hallucination
- malicious artifact content
- allowlisted tools
- typed arguments
- authorization outside the model
- tool-boundary confirmation
- read-only tools by default
- maximum iterations
- timeouts
- cancellation
- verification
- audit logs
- safe rendering

Treat external content as data, never as trusted instructions.

### Provider Controls

Define:

- configurable rate limits
- per-user limits
- per-workspace limits
- token budgets
- timeouts
- exponential backoff
- jitter
- `Retry-After`
- queue limits
- concurrency limits
- circuit breaker
- provider fallback
- request deduplication
- usage monitoring
- daily cost ceiling

Do not claim fixed RPM values unless verified from account configuration.

### Camera and Voice Privacy

- camera processing local where possible
- never store raw camera frames
- visible camera indicator
- visible microphone indicator
- immediate pause
- immediate disable
- consent
- transcript retention rules
- text fallback

### Search Privacy

Document:

- grounded-search disclosure
- citation requirements
- provider retention considerations
- safe source rendering
- prompt injection from web content

### Coding Agent Security

- do not read secret files
- `.gitignore` is not a security boundary
- use `.env.example`
- never paste real secrets into prompts
- redact logs
- redact debug files
- use secret scanning
- use push protection
- never use production credentials in local AI-agent sessions

End with a concise source list.

---

## 11. Feature Document Template

Every feature document must use:

```md
# Feature Name

## Purpose
## User Stories
## Scope
## Non-Goals
## User Flow
## UI States
## Frontend Responsibilities
## Backend Responsibilities
## Agent Tools
## Data Requirements
## Security and Permissions
## Errors and Recovery
## Accessibility
## Acceptance Criteria
## Test Scenarios
## Demo Scenario
## Open Questions
```

### `auth-onboarding.md`

Cover:

- sign up
- sign in
- session state
- onboarding
- camera permission
- microphone permission
- head-control calibration
- dwell or gesture configuration
- first test command
- fallback paths
- retry
- skip behavior
- saved settings

### `accessibility-controls.md`

Cover:

- head pointer
- smoothing
- dead zone
- sensitivity
- facial gesture click
- dwell click
- dwell duration
- cooldown
- pause
- resume
- reduced motion
- keyboard fallback
- mouse fallback
- tracking loss
- calibration persistence
- accidental activation prevention

### `agent-orchestration.md`

Cover:

- intent routing
- planner
- tool groups
- subagent boundaries
- provider routing
- typed schemas
- tool permissions
- confirmation interruption
- cancellation
- timeout
- verification
- partial completion
- provider fallback
- user-visible activity
- no chain-of-thought

### `virtual-workspace.md`

Cover:

- Aksa app shell
- workspace navigation
- document view
- file view
- sheet view
- web search view
- current task
- history tab
- activity tab
- command input
- unsupported action behavior
- original Aksa interface
- no copied Google UI

### `google-workspace.md`

Cover:

- Google OAuth
- Drive search
- Drive file metadata
- Docs read
- Docs edit
- Sheets read
- Sheets write
- Gmail read
- Gmail send only if approved
- Calendar only if supported
- least privilege
- confirmation
- disconnected state
- expired token
- partial failure
- rate limits

### `web-search-artifacts.md`

Cover:

- current web search
- grounded sources
- source cards
- citations
- concise summaries
- easy-to-read artifacts
- conflicting sources
- no-results state
- provider fallback
- source freshness
- prompt injection
- safe rendering
- artifact storage
- artifact export if supported

### `history-activity.md`

Cover:

- task history
- task details
- activity steps
- artifacts
- source list
- filters
- retention
- deletion
- partial completion
- failed tasks
- cancellation
- Undo
- ownership checks
- IDOR tests
- no hidden model reasoning

---

## 12. `.agents/db_schema.md`

Design a Drizzle-ready Turso/libSQL schema.

Do not write migration code yet.

Cover:

- users
- accounts
- sessions
- workspaces
- workspace_members
- accessibility_profiles
- oauth_connections
- tasks
- task_steps
- tool_calls
- artifacts
- artifact_sources
- activity_events
- confirmations
- undo_records
- provider_usage
- audit_logs
- consent_records

For every table document:

- purpose
- columns
- SQLite types
- primary key
- foreign keys
- user ownership
- workspace ownership
- indexes
- unique constraints
- timestamps
- deletion behavior
- retention
- sensitive fields

Every tenant-owned entity must include enough ownership data for authorization.

Do not store:

- raw camera frames
- plaintext OAuth refresh tokens
- API keys
- hidden model reasoning
- unnecessary personal data

Include:

- IDOR-safe query rules
- ownership query examples
- recommended indexes
- transaction boundaries
- task lifecycle
- artifact lifecycle
- confirmation lifecycle
- Undo lifecycle
- retention strategy
- soft-delete versus hard-delete guidance

Document database-per-user as a future option, not an MVP requirement.

---

## 13. Debug Files

Create:

- `.agents/debug-henix.md`
- `.agents/debug-zaltech.md`

These are verified incident histories, not agent diaries.

Do not invent incidents.

Start each file with:

```md
# Debug History

This file records verified development issues and fixes.

Do not record speculation.
Do not record routine progress.
Do not include secrets, tokens, personal data, or hidden model reasoning.

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
```

Rules:

- append only real issues
- verify root cause
- mark workaround versus permanent fix
- close only after verification
- link duplicate incidents
- redact sensitive data

---

## 14. Research Requirements

Use primary sources for:

- Next.js authentication and authorization
- OWASP Agentic AI security
- OWASP LLM risks
- Google OAuth
- Google Workspace APIs
- Vertex AI quota behavior
- Vertex AI grounding
- Turso authorization and multi-tenancy
- Drizzle ORM
- browser camera and microphone permissions
- MediaPipe Tasks Vision

Search Reddit only for practical attack ideas involving:

- coding agents reading `.env`
- secret leakage
- IDOR
- broken authorization
- overprivileged tools
- prompt injection
- untrusted web content
- untrusted email content

Clearly distinguish:

- repository-derived requirements
- official documentation
- Reddit-derived threat ideas
- model inference

---

## 15. Writing Style

All documents must be:

- concise
- implementation-ready
- readable by humans and coding agents
- free of giant paragraphs
- free of duplicated content
- free of vague AI marketing language
- free of backend details in frontend-owned sections
- explicit about open questions
- structured with useful headings
- consistent with repository terminology
- consistent with the Aksa visual and product direction

Do not use em dash characters.

Do not use fake examples that imply functionality already exists.

Use tables only when they improve scanning.

---

## 16. Final Validation

Before finishing:

1. Verify every required file exists.
2. Verify root `AGENTS.md` routes agents into `.agents/`.
3. Verify `.agents/` is canonical.
4. Verify the product remains web-only.
5. Verify all documents describe the same primary user flow.
6. Verify Google Workspace is accessed through APIs, not browser control.
7. Verify no copied Google interface is required.
8. Verify all tenant data requires server-side ownership checks.
9. Verify IDOR test cases exist.
10. Verify provider limits are configurable.
11. Verify camera frames are not stored.
12. Verify external content is treated as untrusted.
13. Verify no hidden reasoning is stored or shown.
14. Verify debug files contain no fictional incidents.
15. Verify Henix and Zaltech responsibilities do not overlap.
16. Verify the plan is realistic for the competition deadline.
17. Verify the docs support proposal, product, prompting, UI/UX, code quality, and demo scoring.
18. Return a concise summary of files created, major decisions, risks, and open questions.

Proceed without asking questions unless an actual repository conflict makes the task impossible.

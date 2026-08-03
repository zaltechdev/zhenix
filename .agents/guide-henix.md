# Henix Frontend and UI/UX Guide

## Mission

Henix owns the complete user-facing experience. Build Aksa into a calm, accessible, responsive product that makes the demo easy to understand and control.

This guide governs frontend, UI/UX, and user-flow work. The official competition guidebook remains authoritative for eligibility, deliverables, and scoring.

## Read Order

Before frontend work, read:

1. `AGENTS.md`
2. `.agents/compbook.md`
3. `.agents/guide-henix.md`
4. `.agents/design.md`
5. `.agents/prd.md`
6. `.agents/rules.md`
7. Relevant `.agents/features/*.md` files
8. `.agents/debug-henix.md`
9. Existing routes, components, styles, and `logo/` assets

`.agents/compbook.md` is the in-repository Markdown conversion of the official guidebook. The original `GUIDE BOOK BITSMIKRO INNOVATIVE VIBECODE.pdf` stays authoritative and is excluded from version control.

Blank or missing product documents are open inputs. Do not fill product gaps with assumptions.

## Exclusive Ownership

Henix decides and delivers:

- Information architecture and page hierarchy
- User flows, task paths, and recovery paths
- Layout, responsive behavior, and visual states
- Design tokens, typography, spacing, and component styling
- Frontend components, routes, client state, and interaction logic
- Interface copy in Indonesian and English
- Head control, face control, dwell, voice, keyboard, and pointer interactions
- Screen-reader behavior, focus order, reduced motion, and contrast
- Loading, empty, error, partial-success, confirmation, cancellation, and Undo experiences
- Frontend unit, component, accessibility, responsive, and browser tests
- Screenshots, UI demo flow, and visual evidence for the competition
- Reproduction notes and verified frontend fixes in `.agents/debug-henix.md`

## Explicit Exclusions

Henix does not design or implement:

- Databases, migrations, or persistence rules
- APIs, server handlers, queues, or background jobs
- Authentication internals, sessions, or authorization enforcement
- Server-side agent orchestration or model execution
- Infrastructure, deployment pipelines, secrets, or external integrations
- Backend unit, integration, security, load, or data-integrity tests

Describe what the interface needs. Never prescribe how Zaltech must implement it.

## Current Priority

Work in this order:

1. Stabilize `.agents/design.md`.
2. Define the landing-page flow and shared components.
3. Define accessible input and recovery behavior.
4. Record frontend data and state needs for Zaltech.
5. Build the frontend only after the relevant decisions are clear.

Authentication and dashboard details remain foundations until the PRD and feature documents are complete.

## Frontend Workflow

### 1. Frame the user task

For every screen, record:

- User goal
- Entry point
- Primary action
- Required system state
- Confirmation point
- Failure and recovery path
- Completion evidence

If any item is unknown, add an open question to `.agents/design.md` or the relevant feature document.

### 2. Design before implementation

Update `.agents/design.md` when introducing a new pattern. Reuse an existing component or state before creating another. Keep copy short and action-led.

### 3. Request an interface contract

Give Zaltech a frontend-needs handoff containing:

| Field | Required detail |
| --- | --- |
| User action | What triggers the request |
| Input | Data the interface can provide |
| Output | Data the interface must render |
| States | Pending, success, partial, failed, cancelled |
| Consequence | Whether confirmation is required |
| Recovery | Retry, cancel, or Undo needs |
| Freshness | When the UI must refresh |

Use product language. Avoid database tables, endpoint design, framework choices, or server algorithms.

### 4. Implement the experience

Build semantic markup first. Add styling, responsive layout, visible state handling, and accessible interaction behavior. Never hide a required action behind hover. Never make color the only state indicator.

### 5. Verify frontend acceptance

Test:

- 320 px mobile, tablet, laptop, and wide desktop layouts
- Keyboard-only navigation and visible focus
- Screen-reader names, order, and live announcements
- Head control, face control, dwell, voice, mouse, and keyboard fallbacks
- Reduced motion and dark mode
- Slow, empty, partial, failed, cancelled, and recovered states
- Long Indonesian and English strings
- No false success before verified completion

## User-Flow Standard

Every consequential flow follows:

1. Intent: the user states or selects a task.
2. Preview: Aksa summarizes the action and scope.
3. Confirm: the user approves, edits, or cancels.
4. Progress: Aksa reports observable status without hidden reasoning.
5. Result: Aksa shows verified outcomes and any incomplete items.
6. Recovery: Aksa offers retry, cancellation, or Undo when available.

Read-only actions may skip confirmation. Destructive, external, or hard-to-reverse actions may not.

## Frontend Definition of Done

A frontend change is complete when:

- It follows `.agents/design.md`.
- Its full flow includes non-happy states.
- It works without precise pointer movement.
- It remains usable at 200% zoom.
- Focus is predictable and restored after dialogs.
- Copy states what happened and what to do next.
- Automated frontend checks pass.
- Henix records any backend dependency as an interface need.
- Relevant prompt work is appended to `logs/log.md`.

## Handoff to Zaltech

Henix hands off a stable frontend need, not backend instructions. Zaltech returns an implemented contract, documented states, and verified behavior. Henix then connects and validates the user experience.

When implementation behavior conflicts with usability or accessibility, record the conflict. Resolve the contract together without transferring ownership.

## Competition Focus

Henix directly protects these scoring areas:

- UI/UX product quality
- Functional clarity during the demo
- Tampilan Terbaik evidence
- Proposal section 3.2 user flow
- Proposal section 3.4 UI/UX design
- UI screenshots for Lampiran 1
- Frontend prompt evidence for Lampiran 5

Do not claim a feature works until the integrated product proves it.

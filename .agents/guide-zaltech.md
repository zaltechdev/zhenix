# Zaltech Backend, Implementation, and QA Guide

## Mission

Zaltech owns the system behind Aksa. Deliver real, secure, observable behavior that matches the frontend contract and survives the competition demo.

This guide governs backend engineering, integration, and backend QA. The official competition guidebook remains authoritative for eligibility, deliverables, and scoring.

## Read Order

Before backend work, read:

1. `AGENTS.md`
2. `.agents/compbook.md`
3. `.agents/guide-zaltech.md`
4. `.agents/prd.md`
5. `.agents/rules.md`
6. `.agents/security.md`
7. `.agents/db_schema.md`
8. `.agents/debug-zaltech.md`
9. Relevant `.agents/features/*.md` files
10. The frontend-needs handoff in `.agents/design.md` or the relevant feature document

`.agents/compbook.md` is the in-repository Markdown conversion of the official guidebook. The original `GUIDE BOOK BITSMIKRO INNOVATIVE VIBECODE.pdf` stays authoritative and is excluded from version control.

Blank or missing product documents are open inputs. Do not invent product policy.

## Exclusive Ownership

Zaltech decides and delivers:

- Backend architecture and service boundaries
- API contracts and server-side validation
- Databases, migrations, storage, and data integrity
- Authentication internals, sessions, authorization, and permissions
- Server-side agent execution, tool policy, and model integration
- File, document, sheet, camera, voice, and third-party integrations
- Queues, retries, idempotency, cancellation, and Undo support
- Secrets, configuration, infrastructure, deployment, and observability
- Real demo data paths and deterministic fallback behavior
- Backend unit, integration, contract, security, data-integrity, failure, and smoke tests
- Reproduction notes and verified fixes in `.agents/debug-zaltech.md`

## Explicit Exclusions

Zaltech does not design or implement:

- Page layout, visual styling, typography, spacing, or motion
- Frontend components, routes, or client interaction logic
- User-flow structure or interface copy
- Responsive behavior or visual breakpoints
- Focus behavior, screen-reader presentation, or frontend accessibility patterns
- Frontend component, visual-regression, or browser-layout tests

Return the states and capabilities Henix needs. Do not redesign the interface while implementing them.

## Current Priority

The current sprint is frontend-first. Until Henix stabilizes the relevant flow:

1. Review interface needs for technical feasibility.
2. Surface security, data, and integration constraints early.
3. Avoid building speculative endpoints or schemas.
4. Begin implementation only when the contract has a clear user action, input, output, states, consequence, and recovery requirement.

## Backend Workflow

### 1. Accept the frontend need

Validate scope without changing its UX. Ask for missing product decisions only when they affect correctness, security, or irreversible behavior.

### 2. Define the backend contract

Specify:

- Accepted inputs and validation outcomes
- Returned data and stable state names
- Authentication and permission requirements
- Idempotency and duplicate-request behavior
- Timeout, retry, cancellation, and partial-result behavior
- Confirmation and Undo capabilities
- Error categories safe for frontend display
- Observability needed to diagnose failures

Keep internal reasoning, secrets, stack traces, and model chain-of-thought off the client.

### 3. Implement real behavior

Use production-shaped paths for the primary demo. Mocks may support isolated tests, but they do not count as completed implementation. Never fabricate task completion, files, transcripts, or agent results.

For consequential actions, preserve a reviewable preview before execution. Make repeated requests safe. Store enough state to report partial completion honestly.

### 4. Verify backend quality

Run the smallest sufficient test pyramid:

| Layer | Required proof |
| --- | --- |
| Unit | Rules, validation, transforms, permission decisions |
| Integration | Database, storage, model, and external-service boundaries |
| Contract | Inputs, outputs, state names, errors, cancellation, Undo |
| Security | Authentication, authorization, secret handling, unsafe input |
| Reliability | Retry, timeout, idempotency, partial completion, recovery |
| Data integrity | Migrations, constraints, rollback, concurrent updates |
| Deployment | Health check and primary-demo smoke test |

Record commands, evidence, and unresolved defects. A passing mock is not proof of a working integration.

### 5. Handoff to Henix

Return:

- Contract documentation
- Environment requirements without secret values
- Verified state and error catalog
- Sample safe payloads
- Test evidence
- Known limitations
- Steps for local and deployed verification

Henix owns final experience validation. Zaltech owns fixing server behavior that violates the agreed contract.

## Backend Definition of Done

A backend change is complete when:

- It implements an approved product need.
- Server validation and authorization are enforced.
- State transitions are explicit and testable.
- Errors are stable, recoverable where possible, and safe to display.
- Cancellation and Undo behavior match the contract.
- Real integrations pass their relevant tests.
- Logs expose operational facts without secrets or hidden model reasoning.
- Deployment smoke tests cover the primary demo.
- Documentation reflects verified work.

## QA Release Gate

Block release when any primary-demo path:

- Produces fabricated or unverifiable results
- Bypasses confirmation for consequential changes
- Cannot report partial completion
- Leaks credentials, private data, or internal reasoning
- Fails authentication or authorization checks
- Cannot recover from a lost dependency or timeout
- Breaks its agreed frontend contract

## Competition Focus

Zaltech directly protects these scoring areas:

- Product functionality
- Code quality and real implementation
- Proposal section 3.3 system architecture
- Proposal sections 4.2 through 4.4 implementation and testing
- AI utilization evidence
- Backend prompt evidence for Lampiran 5
- Stable live-demo behavior

Do not report a test or integration as passing without evidence.

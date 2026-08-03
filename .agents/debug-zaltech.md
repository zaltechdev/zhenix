# Debug History

This file records verified development issues and fixes.

Do not record speculation.
Do not record routine progress.
Do not include secrets, tokens, personal data, or hidden model reasoning.

Scope: backend, APIs, database, authentication internals, authorization, agent orchestration, provider integration, Google integrations, infrastructure, deployment, and backend tests. Owner: Zaltech.

Layout, component, copy, and frontend accessibility issues belong in `.agents/debug-henix.md`.

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

## Rules

- Append only issues that were actually observed and reproduced.
- Verify the root cause before writing it. If the cause is unknown, say `Root cause: not yet identified` and keep the entry open.
- Mark a fix as `workaround` or `permanent`. A workaround stays open until replaced.
- Close an entry only after the verification step passes on a real run. A passing mock is not verification of an integration.
- Link a duplicate to the original entry instead of writing a second investigation.
- Redact tokens, keys, identifiers that map to a real person, document content, email content, and transcripts.
- Never paste a provider payload or a stack trace containing credentials.
- Newest entries go at the bottom.

## Field Guidance

| Field | Expected content |
| --- | --- |
| Status | `open`, `workaround`, `fixed`, or `duplicate of <date and title>` |
| Owner | The person who verified the fix |
| Area | For example auth, session, authorization, schema, migration, agent loop, tool registry, provider routing, Drive, Docs, Sheets, Gmail, grounded search, confirmation, Undo, rate limiting, deployment |
| Symptoms | The observable system behavior, including the state the interface received |
| Reproduction | Exact request or command, input shape, account context, and environment |
| Expected | The contract from `.agents/prd.md`, `.agents/security.md`, `.agents/db_schema.md`, or the relevant feature document |
| Actual | The observed behavior, including the state name returned |
| Root cause | The verified mechanism, not a guess |
| Fix | What changed and whether it is a workaround or permanent |
| Files changed | Relative repository paths |
| Verification | The exact command run and the evidence it produced |
| Prevention | The test, constraint, schema change, or documentation change that stops a recurrence |
| Commit or PR | Reference once it exists |

## Security Incident Handling

A security-relevant issue follows the same template with three additions.

- Record it only after confirming it with a real request or a real file read. Never record a suspected incident as fact.
- If a secret was exposed, rotate first, then record the entry with the secret redacted and the rotation noted under Fix.
- Add the regression test identifier under Prevention. For authorization issues, reference the matching `SEC-T` case in `.agents/security.md` section 2.

## Entries

No verified issues recorded yet. Implementation has not started.

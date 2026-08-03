# Debug History

This file records verified development issues and fixes.

Do not record speculation.
Do not record routine progress.
Do not include secrets, tokens, personal data, or hidden model reasoning.

Scope: frontend, UI, UX, user flows, accessibility interactions, responsive behavior, interface copy, and frontend tests. Owner: Henix.

Backend, API, database, authentication internals, agent execution, and integration issues belong in `.agents/debug-zaltech.md`.

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
- Close an entry only after the verification step passes on a real run.
- Link a duplicate to the original entry instead of writing a second investigation.
- Redact file paths, values, or copy that would expose personal data.
- Newest entries go at the bottom.

## Field Guidance

| Field | Expected content |
| --- | --- |
| Status | `open`, `workaround`, `fixed`, or `duplicate of <date and title>` |
| Owner | The person who verified the fix |
| Area | For example landing page, onboarding, head control, dwell, command bar, workspace shell, artifact view, history, localization |
| Symptoms | What a user sees or experiences |
| Reproduction | Exact steps, browser, viewport, input mode, and locale |
| Expected | The behavior required by `.agents/design.md` or the relevant feature document |
| Actual | The observed behavior |
| Root cause | The verified mechanism, not a guess |
| Fix | What changed and whether it is a workaround or permanent |
| Files changed | Relative repository paths |
| Verification | The command or manual pass that proved the fix, including browser and assistive technology used |
| Prevention | The test, token, lint rule, or documentation change that stops a recurrence |
| Commit or PR | Reference once it exists |

## Entries

No verified issues recorded yet. Implementation has not started.

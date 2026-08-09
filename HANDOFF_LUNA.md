# Aksa emergency MVP continuation handoff

## Current HEAD

`e796e90` on `dev`, pushed to `origin/dev` before this handoff update.

## Completed

- Preserved real Better Auth, Google OAuth, bounded Docs, confirmation, verification, History, and Activity architecture.
- Added centralized deterministic Preview data for Sheets, Gmail, and Web Search.
- Added an explicit `live`, `preview`, `empty`, and `unavailable` surface contract.
- Added visible EN/ID Preview labels and concise helper text on frontend-only surfaces.
- Added interactive spreadsheet range/query, recent mail/read state/local draft, and cited search preview experiences.
- Expanded Home suggestions and Workspace entry points while keeping real Docs separate from Preview features.
- Kept Drive metadata search/list/open live.
- Verified Google Cloud project `henixhacking`, active account `gammafadhillah@gmail.com`, and enabled Drive, Docs, and Vertex APIs.
- Confirmed source OAuth scopes are Drive metadata, Docs, `openid`, and `email`.

## Verification

- `bun run i18n`: passed.
- `bun run typecheck`: passed.
- `bun run lint`: passed.
- `bun run test`: 44 files, 423 tests passed.
- `bun run build`: passed.
- Focused Preview tests: 40 passed.
- Fresh Chrome reached the real Aksa sign-up form.
- Live Aksa account, OAuth callback, Docs mutation, and History/Activity browser acceptance remain unverified.

## Human-only blocker

Browser policy requires action-time confirmation immediately before creating an Aksa account, creating persistent OAuth credentials, or saving OAuth scopes. The current OAuth client already has two enabled secrets, so Google blocks a third. The no-disable path is a separate Web OAuth client named `Aksa local PoC replacement` with origin `http://localhost:3000` and callback `http://localhost:3000/api/google/callback`.

Repository security rules prohibit agents from inspecting or editing `.env.local`. After Cloud creates the replacement client, the operator must paste its client ID and secret into ignored `.env.local`. Never share, log, stage, or commit either value.

## Remaining exact work

1. Receive action-time confirmation for local Aksa account creation, replacement OAuth client creation, and saving the four OAuth scopes.
2. Create the replacement Web OAuth client without disabling either old secret.
3. Save Drive metadata, Docs, `openid`, and `email` on Google Auth Platform Data Access.
4. Have the operator paste the new client ID and secret into ignored `.env.local`.
5. Restart Aksa and verify sign-in, reload persistence, Google consent, callback, Connected state, and reload persistence.
6. Use a disposable Google Doc to verify discovery, read, Cancel with zero mutation, Confirm with real mutation, and read-back.
7. Run one bounded Home Docs task and verify real History and Activity entries.
8. Disable no old secret unless authoritative per-secret dependency evidence proves it unused.

## Exact next commands

```powershell
git status --short
bun run dev
```

Do not read, print, stage, or commit `.env.local`, OAuth secrets, ADC files, or credential stores.

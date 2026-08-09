# Aksa emergency MVP continuation handoff

## Current HEAD

`ac16fa6` on `dev`, pushed to `origin/dev` before this handoff update.

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
- Created a separate Google Web OAuth client named `Aksa local PoC replacement`.
- Configured local and future production origins for `localhost:3000` and `aksawork.web.id`, with each matching `/api/google/callback` redirect URI.
- Verified both the original `Aksa local PoC` client and the replacement client still exist. No existing client or secret was changed or disabled.
- Reached the authenticated local Workspace with the existing Aksa browser session.

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

The replacement credential screen is open in Chrome. Repository security rules prohibit agents from inspecting or editing `.env.local`, so the operator must paste the replacement client ID and secret into ignored `.env.local`. Never share, log, stage, or commit either value.

The Google Auth Platform draft contains Drive metadata, Docs, `openid`, and email. Google keeps Save disabled until a real YouTube demo link is supplied for the restricted Drive scope. The scope page is open with truthful justifications entered; no placeholder or fabricated video link was used.

## Remaining exact work

1. Have the operator paste the replacement client ID and secret into ignored `.env.local`.
2. Provide a real YouTube demo URL for Google Auth Platform, then save Drive metadata, Docs, `openid`, and email.
3. Restart Aksa and verify sign-in, reload persistence, Google consent, callback, Connected state, and reload persistence.
4. Use a disposable Google Doc to verify discovery, read, Cancel with zero mutation, Confirm with real mutation, and read-back.
5. Run one bounded Home Docs task and verify real History and Activity entries.
6. Disable no old secret unless authoritative per-secret dependency evidence proves it unused.

## Exact next commands

```powershell
git status --short
bun run dev
```

Do not read, print, stage, or commit `.env.local`, OAuth secrets, ADC files, or credential stores.

# Aksa MVP continuation handoff

## Current HEAD

`f4acd9c` on `dev`, pushed to `origin/dev` before this handoff commit.

## Completed

- Protected Workspace with real Better Auth session checks and working sign-out action.
- Hardened Google OAuth readiness, bounded token requests, granted-scope capability checks, and user binding.
- Fixed bounded Home Docs planning for `Find my document Project Brief` followed by a context-bound edit.
- Preserved real Docs confirmation, cancel, batch update, read-back verification, History, and Activity architecture.
- Added real Drive list/search/open and honest unavailable states for unsupported integrations.
- Added Vertex provider support through ADC without credentials in source.
- Removed developer, environment, sample, fallback, and fabricated identity product states.
- Removed public Accessibility widget while preserving Workspace Accessibility.
- Added System, Light, Dark preview cards and persisted Standard/Increased Contrast.
- Widened Workspace and landing layouts and removed unsupported suggestion claims.

## Verification

- `bun run i18n`: passed.
- `bun run typecheck`: passed.
- `bun run lint`: passed.
- `bun run test`: 44 files, 419 tests passed.
- `bun run build`: passed.
- Focused Playwright auth protection, Appearance reload persistence, and 1366/1440/1920 width: 3/3 passed.
- Real Chrome previously verified signed-in session reload, EN to ID to EN continuity, clean Settings copy, and theme/contrast reload persistence.
- Latest Chrome tab returned to sign-in; browser control timed out while claiming it, so final sign-in was not repeated.

## External blocker

Google Cloud project `henixhacking` has the correct `http://localhost:3000` origin and exact callback. The OAuth client has two enabled masked secrets, so adding a replacement requires disabling one old secret first. Browser safety requires action-time user approval because this changes persistent OAuth access. The replacement secret must then be pasted by the operator into ignored `.env.local`; never log or commit it. OAuth Data Access scopes also still need saving.

## Remaining exact work

1. With user approval, disable the oldest masked OAuth secret and create one replacement.
2. Leave the new secret visible for the operator to paste into ignored local configuration.
3. Save Drive metadata, Docs, `openid`, and `email` scopes.
4. Restart Aksa and complete real Google consent and callback.
5. Use a disposable Google Doc to verify read, Cancel with zero mutation, Confirm with real mutation, and read-back.
6. Run one bounded Home composer Docs task and verify real History and Activity entries.
7. Commit only any resulting source changes, then push `origin/dev` without force.

## Exact next commands

```powershell
git status --short
git log --oneline --decorate -n 8
bun run dev
```

Do not read, print, stage, or commit `.env.local`, OAuth secrets, ADC files, or credential stores.

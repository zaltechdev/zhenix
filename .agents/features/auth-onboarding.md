# Authentication and Onboarding

Covers steps 1 to 8 of the primary flow in `.agents/prd.md` section 8.

## Purpose

Get a new user from the landing page to a workspace where head control and voice already work, without requiring a mouse and without asking for a camera before explaining why.

## User Stories

- As a visitor, I create an account with email and password so my calibration is saved.
- As a returning user, I sign in and my head control settings load without setup.
- As a visitor, I can continue with Google when I prefer provider-managed authentication.
- As a new user, I learn what the camera is used for before I am asked to allow it.
- As a user who cannot grant camera access, I still reach the workspace and use keyboard or mouse.
- As a user with limited hand movement, I complete the entire sign-up form without a pointer.
- As a user who wants to try Aksa quickly, I skip calibration and adjust later.
- As a user, I test my voice input and see the words before anything runs.

## Scope

- Sign up with email and password.
- Sign up and sign in through Google OAuth, handled server-side by Better Auth.
- Sign in, sign out, session persistence.
- Demo-only forgot-password acknowledgment that does not send email or change credentials.
- One workspace created automatically on first sign in.
- Onboarding: purpose explanation, camera consent, pointer test, calibration, microphone consent, voice test, first guided command.
- Visible camera preview is mirrored for familiar self-alignment only. MediaPipe input, pose mapping, and calibration coordinates remain unmirrored.
- Separate camera and microphone consent, each recorded.
- Accessibility profile persistence and reset.
- Resume onboarding after abandonment.
- Skip path at every permission and calibration step.

## Non-Goals

- Additional social providers, magic links, and multi-factor authentication.
- Password reset by email, deferred to Future Scope in `.agents/prd.md` section 25. The competition demo exposes an explicitly labeled frontend-only acknowledgment.
- Team invitations and workspace sharing.
- Guest access, tracked as OQ-9.
- Google identity and Workspace authorization remain separate security responsibilities but share one Google OAuth redirect. See `.agents/features/google-workspace.md`.

## User Flow

| Step | User | Aksa |
| --- | --- | --- |
| 1 | Selects `Try Aksa` on the landing page | Opens sign in with email, password, and Google choices plus a link to sign up |
| 2 | Creates an account or signs in | Establishes a session, creates the first workspace on first sign in, then sends the account to onboarding |
| 3 | Arrives in onboarding | Explains head control, what is processed, what is stored, and the skip path |
| 4 | Chooses `Allow camera` or `Skip` | Requests camera permission only after the explanation, records consent either way |
| 5 | Moves head | Shows the Aksa pointer following head pose, distinct from browser focus |
| 6 | Runs calibration | Guides a target sequence, shows progress, offers restart and skip |
| 7 | Adjusts sensitivity, dead zone, smoothing | Applies changes live, offers reset to defaults |
| 8 | Chooses dwell, gesture, or both | Configures dwell duration or gesture threshold and cooldown, demonstrates once |
| 9 | Confirms saving settings | Records settings-persistence consent, then saves the profile |
| 10 | Chooses `Allow microphone` or `Skip` | Requests microphone permission after explaining that recognition may leave the device |
| 11 | Speaks a test phrase | Shows an editable transcript and a working text field beside it |
| 12 | Reads the guided prompt to say `Open Google Docs` | Accepts voice or typed entry, then routes into the workspace |

Onboarding progress is saved after each completed step. Leaving and returning resumes at the last incomplete step.

The Head pointer calibration step keeps status, helper text, progress, and the calibration action in one panel. Skip remains a single footer navigation action so camera or calibration failure never traps the user.

## UI States

| Screen | States |
| --- | --- |
| Sign up | empty, focused, validating, field error, form-level error summary, submitting, success |
| Sign in | empty, field error, credentials error, rate limited, submitting, success |
| Onboarding intro | default, skip confirmation |
| Camera consent | explanation, requesting, granted, denied, unavailable device, insecure context |
| Pointer test | initializing model, no face detected, poor lighting, tracking active, tracking lost |
| Calibration | idle, step in progress, step failed, complete, restart offered, skipped |
| Settings tuning | default, adjusting with live preview, reset applied, unusable-setting guard |
| Selection setup | dwell selected, gesture selected, both, gesture not detected, cooldown demo |
| Microphone consent | explanation with recognition disclosure, requesting, granted, denied, unsupported browser |
| Voice test | idle, `Listening.`, `Writing your words.`, transcript editable, no speech detected, recognition error |
| First command | prompt shown, voice submitted, text submitted, unrecognized intent, success routing |

Every state carries text plus an icon. No state is communicated by color alone. Copy and announcements follow `.agents/design.md` sections 8 and 9.

## Frontend Responsibilities

Owner: Henix.

- Route structure for landing, sign up, sign in, onboarding steps, and workspace entry.
- Sign-up and sign-in forms with persistent labels, autofill support, inline field errors linked to inputs, and a form-level error summary that receives focus on failure.
- Google sign-in is the primary authentication CTA. It immediately opens Google's full-page account chooser in the same tab, creates the Aksa session, stores encrypted Workspace tokens, then continues to onboarding.
- Loading state that prevents duplicate submission without shifting layout.
- Onboarding step shell with visible progress, back, skip, and resume.
- Consent screens that explain purpose before any permission request.
- Camera preview, pointer rendering, and the calibration target sequence.
- Live preview for sensitivity, dead zone, and smoothing changes.
- Dwell and gesture configuration controls with a demonstration and a cooldown indicator.
- Transcript editing surface and the always-present text input.
- Capability detection for speech recognition before offering a microphone control.
- Keyboard and mouse parity for every onboarding action.
- Local cache of the accessibility profile in IndexedDB for immediate startup, treating the server value as authoritative.
- Indonesian and English copy for every screen and announcement.
- Frontend tests: form validation states, keyboard-only completion, focus management, skip and resume paths, reduced motion, long-string layout.

The frontend never decides whether a session is valid. It renders the session state it receives.

## Backend Responsibilities

Owner: Zaltech.

- Authentication library integration for sign up, sign in, sign out, and session lifecycle.
- Better Auth authorization-code exchange for Google identity, encrypted provider tokens, and validated post-sign-in destinations.
- Session cookie configuration, rotation on sign in, revocation on sign out, absolute and idle expiry.
- Sign-in rate limiting per account and per address, with identical responses for existing and non-existing accounts.
- Workspace creation on first sign in, plus the single `owner` row in `workspace_members`.
- Accessibility profile read, write, and reset endpoints, authorized by session.
- Consent recording per type with policy version, one row per grant.
- Onboarding progress state so the frontend can resume.
- Audit log entries for `sign_in`, `sign_in_failed`, `sign_out`, and `session_revoked`.
- Minimal DTOs. No password hash, session token, or internal identifier reaches the client.
- Backend tests: validation, authorization, session expiry, rate limiting, consent immutability, profile ownership.

## Agent Tools

None. Onboarding does not invoke the agent.

The first guided command in step 12 is handed to the orchestrator described in `.agents/features/agent-orchestration.md`. Onboarding only captures and forwards the command.

## Data Requirements

Tables from `.agents/db_schema.md`: `users`, `accounts`, `sessions`, `workspaces`, `workspace_members`, `accessibility_profiles`, `consent_records`, `audit_logs`.

| Need | Detail |
| --- | --- |
| Account identity | `users` with lowercase unique email and locale |
| Session | `sessions` storing a token hash, never the token |
| Workspace | one `workspaces` row per user in MVP, with the matching `workspace_members` owner row |
| Settings | one `accessibility_profiles` row per user, containing no biometric data |
| Consent | `consent_records` rows for `camera`, `microphone`, and `settings_persistence`, each with `policy_version` |
| Security trail | `audit_logs` for authentication events |

Never stored: camera frames, landmark coordinates, blendshape series, calibration imagery, audio, password in plaintext.

## Security and Permissions

Requirements from `.agents/security.md` sections 1 and 7.

- Established authentication library. No custom password hashing or session cryptography.
- Google sign-in opens Google's full-page account chooser in the current tab and uses a server-side authorization-code exchange.
- One Google redirect establishes the Aksa session and stores encrypted Workspace provider tokens server-side.
- HTTP-only, `Secure`, `SameSite=Lax` session cookie. No token in `localStorage` or a URL.
- Session rotation on sign in. Server-side revocation on sign out.
- Account enumeration prevented on sign in and any future reset flow.
- Camera and microphone require a secure context. `Permissions-Policy` grants both to self only.
- Consent is requested after the explanation and recorded separately per type.
- Post-authentication redirect targets are validated against an allowlist of internal paths.
- An accessibility profile is readable and writable only by its owner, derived from the session.
- A profile request carrying another user's identifier is refused. Covered by SEC-T5.

## Errors and Recovery

| Failure | Behavior | Recovery |
| --- | --- | --- |
| Email already registered | Same generic response as a successful submission path, with a sign-in prompt | Sign in, or use a different email |
| Weak or short password | Inline field error stating the requirement | Correct and resubmit |
| Invalid credentials | Single generic message, no hint about which field | Retry, rate limit applies |
| Too many attempts | States that attempts are limited and when to retry | Wait, then retry |
| Session expired mid-onboarding | Preserves onboarding progress and any typed command | Sign in, resume at the same step |
| Camera permission denied | Explains that head control needs the camera, keeps the account usable | Retry permission, keyboard, mouse |
| No camera device | States that no camera was found | Continue with keyboard or mouse |
| Insecure context | States that camera access needs a secure connection | Open the secure URL |
| Landmark model fails to load | States that head control could not start, keeps onboarding usable | Retry, skip |
| No face detected | Positioning and lighting hint, nothing captured | Adjust, retry, skip |
| Tracking lost during calibration | `Face control paused.`, freezes the pointer, stops dwell | Retry camera, keyboard, mouse |
| Calibration failed | Keeps the previous saved profile, names the failed step | Restart, adjust manually, skip |
| Setting leaves the pointer unusable | Guard prevents the user from being trapped, offers reset | Reset to defaults |
| Profile save failed | States that settings were not saved, keeps them active in the session | Retry save, continue unsaved |
| Microphone permission denied | Switches the command bar to text mode and says so | Retry permission, type |
| Speech recognition unsupported | Microphone control is never offered; text mode is default | Type the command |
| No speech detected | States that nothing was heard | Retry, type |
| Recognition error | Preserves any partial transcript | Retry, type |
| First command not understood | States that the command was not recognized, offers the exact guided phrase and text entry | Retry, type, skip to workspace |

Every recovery path keeps the user signed in. No failure in onboarding blocks workspace access.

## Accessibility

- Every step is completable by keyboard only and by mouse only.
- Onboarding never requires the camera or the microphone to proceed.
- Focus moves to the error summary on failed submission, then follows document order.
- Enter submits a valid form. Escape does not erase input.
- Calibration steps and completion are announced.
- Camera and microphone active indicators are visible in the interface, independent of browser indicators.
- Dwell progress has a static indicator under `prefers-reduced-motion`.
- All targets are at least 44 by 44 px with at least 8 px separation.
- Password requirements are visible before submission, not only after failure.
- Screen-reader names describe results, not icons.
- Usable at 200 percent zoom with no horizontal scrolling at 320 px.

## Acceptance Criteria

1. A new visitor creates an account with email and password or Google, then reaches onboarding using only the keyboard.
2. A returning user's accessibility profile loads on sign in without reconfiguration.
3. Camera consent is requested only after the purpose explanation is shown.
4. Camera and microphone consent are recorded as separate rows with a policy version.
5. Skipping camera, calibration, and microphone still ends in a usable workspace.
6. Sensitivity, dead zone, smoothing, selection mode, dwell duration, gesture threshold, and cooldown all persist and reload.
7. Reset to defaults restores a usable pointer configuration.
8. Leaving onboarding and returning resumes at the last incomplete step.
9. Speech recognition capability is detected before a microphone control appears.
10. The test transcript is editable, and the same command works typed.
11. `Open Google Docs` routes to the workspace from voice and from text.
12. A session-expiry mid-onboarding returns the user to the same step with typed input preserved.
13. Requesting another user's accessibility profile is refused server-side.
14. No password, session token, or internal identifier appears in a client payload.
15. Every screen renders correctly in Indonesian and English.
16. Automated accessibility checks report zero critical violations on all onboarding screens.

## Test Scenarios

| ID | Scenario | Expected |
| --- | --- | --- |
| AO-1 | Sign up with an existing email | Generic response, no enumeration |
| AO-2 | Sign up with a password below the minimum length | Inline field error, no account created |
| AO-3 | Sign in with wrong credentials repeatedly | Rate limit engages, message states when to retry |
| AO-4 | Complete onboarding using only Tab, Enter, and Escape | Full completion, focus always visible |
| AO-5 | Deny camera permission | Explanation plus keyboard and mouse options, workspace reachable |
| AO-6 | Revoke camera permission mid-calibration | `Face control paused.`, previous profile intact |
| AO-7 | Set sensitivity to an extreme value | Guard prevents an unusable pointer, reset available |
| AO-8 | Save profile with the network offline | Honest failure, settings remain active in the session |
| AO-9 | Deny microphone permission | Text mode becomes default, microphone control removed |
| AO-10 | Open onboarding in a browser without speech recognition | No microphone control offered at any point |
| AO-11 | Abandon onboarding after calibration, sign in again | Resumes at the microphone step |
| AO-12 | Submit a profile update containing another user's identifier | Session values used, injected values ignored, SEC-T5 |
| AO-13 | Request another user's profile directly | Not found |
| AO-14 | Expire the session during the voice test | Sign in again, resume with the typed command preserved |
| AO-15 | Render every onboarding screen in Indonesian at 320 px and 200 percent zoom | No overflow, no clipped copy |
| AO-16 | Enable `prefers-reduced-motion` and run calibration | Static progress indication, no animated transitions |

## Demo Scenario

Minutes 2.5 to 4 of the pitch in `.agents/prd.md` section 23.

1. Open the deployed landing page and select `Try Aksa`.
2. Sign in with the prepared demo account.
3. Show the camera explanation, then allow the camera.
4. Move the head and show the Aksa pointer tracking.
5. Run one short calibration pass and show a sensitivity change taking effect live.
6. Allow the microphone and show the disclosure that recognition may leave the device.
7. Speak a test phrase and show the editable transcript with the text field beside it.
8. Say `Open Google Docs` and continue into the workspace.

Prepared fallback: if the presenter's camera or microphone fails, deny the permission deliberately and narrate the keyboard fallback as designed behavior rather than a defect.

## Open Questions

| ID | Question | Blocks |
| --- | --- | --- |
| AOQ-1 | Better Auth is selected. Revisit only if a verified implementation blocker appears. | Backend responsibilities |
| AOQ-2 | Is guest or demo access offered, and how is its data isolated and expired? Tracked as OQ-9. | Scope |
| AOQ-3 | Default sensitivity, dead zone, smoothing, and dwell duration values. Tracked as OQ-5. | Step 7 and 8 |
| AOQ-4 | Which facial gesture is the default selection trigger? Tracked as OQ-4. | Step 8 |
| AOQ-5 | Resolved for the competition demo: show a frontend-only acknowledgment. Real password reset remains Future Scope. | Non-goals |
| AOQ-6 | Default locale and language detection behavior. Tracked as OQ-7. | Localization |
| AOQ-7 | Absolute and idle session expiry durations. | Backend responsibilities |
| AOQ-8 | Exact disclosure wording for browser speech recognition leaving the device, pending Henix copy approval. | Step 10 |

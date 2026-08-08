# Accessibility Controls

Head-controlled pointing, selection, and the input fallbacks that keep Aksa usable when the camera is not available. Supports steps 4 to 8 and every later step of the primary flow in `.agents/prd.md` section 8.

## Purpose

Give a user who cannot operate a mouse a reliable way to point and select anywhere in Aksa, with settings they can tune, a pause they can always reach, and a fallback that never leaves them stuck.

## User Stories

- As a user with limited arm movement, I move a pointer by turning my head.
- As a user whose head movement is small, I raise sensitivity so I can reach the whole screen.
- As a user with involuntary movement, I raise the dead zone and smoothing so the pointer stays steady.
- As a user who cannot click, I select by holding the pointer on a target.
- As a user who prefers a deliberate action, I select with a facial gesture instead of dwell.
- As a user who keeps activating things by accident, I lengthen dwell and add a cooldown.
- As a user who needs a break, I pause head control with one action and resume later.
- As a user whose camera fails, I continue with the keyboard without losing my work.
- As a user sensitive to motion, I turn off animated progress and still see dwell state.

## Scope

- Head-pose pointer with sensitivity, dead zone, and smoothing.
- Internal semantic Target Assist for eligible controls, with no additional user-facing tuning panel.
- Dwell selection with configurable duration and immediate cancel on leaving a target.
- One configurable facial gesture for selection, with a threshold and a cooldown.
- Pause and resume from a single always-reachable control.
- Keyboard and mouse parity for every action in Aksa.
- Tracking-loss detection and recovery.
- Calibration persistence and reset.
- Accidental-activation prevention, including the rule that dwell or gesture alone cannot approve a consequential action.
- Reduced-motion behavior for all control feedback.

## Non-Goals

- Eye tracking or gaze estimation. Aksa uses head pose and facial gesture only.
- Multiple simultaneous gestures mapped to different actions. One selection gesture in MVP.
- Drag, multi-touch, pinch, or gesture-driven scrolling by head movement.
- Switch, sip-and-puff, or other external assistive hardware.
- Mobile front-camera head control. Not a supported input per `.agents/prd.md` section 12.
- Screen-reader-only operation as the primary interface.

## User Flow

### Pointer control loop

| Step | User | Aksa |
| --- | --- | --- |
| 1 | Grants camera access | Starts landmark inference in the browser, off the main thread where practical |
| 2 | Faces the screen | Detects the face, shows the Aksa pointer at a neutral position |
| 3 | Turns head | Maps head pose to pointer position using sensitivity, dead zone, and smoothing |
| 4 | Holds on a target | Starts dwell only when the target is eligible and the pointer is stable |
| 5 | Holds until complete | Activates the target, then enters cooldown |
| 6 | Moves away early | Cancels dwell immediately with no activation |

### Target Assist

- Target Assist considers only visible, enabled semantic controls: buttons, linked anchors, inputs, textareas, selects, checkboxes, radios, switches, supported interactive roles, and explicit Aksa interactive markers.
- It measures pointer distance to each control rectangle, not its centre. Generic containers, body text, disabled controls, hidden controls, and inert content are never candidates.
- Outside the internal assist radius, the pointer follows filtered head movement normally. Inside it, a restrained magnetic approach helps finish the final pixels without teleporting the cursor.
- A clearly nearest candidate must remain stable briefly before lock. While locked, minor pose noise does not release the target and dwell or gesture uses that target.
- The release radius is larger than the acquisition radius. A larger raw-pointer displacement, high pointer velocity, invalid target, or leaving the release radius clears the lock and cancels dwell immediately.
- Similar adjacent candidates remain unlocked until movement makes one clearly nearest. A valid current lock remains preferred over a new nearby candidate.
- Assist configuration is internal and centralized in the client controller. It is not exposed as engineering controls in accessibility settings.

### Rest Lock

- After pose filtering and mapping, Rest Lock freezes a rendered pointer that remains inside a small stability envelope for a short interval.
- Its release boundary is larger than its acquisition envelope. A sustained, directional movement releases promptly, while one isolated frame does not.
- Rest Lock clears on tracking loss, pause, restart, calibration, and disable. An already acquired Target Assist target continues to receive the unheld pointer input so its intentional escape logic remains authoritative.

### Pointer feedback

- The runtime pointer uses the supplied Aksa SVG asset, remains compact, and never participates in hit testing.
- An acquired target adds restrained pointer emphasis. Its dwell ring reflects live `DwellController` progress and clears with any dwell cancellation or target release.
- A brief activation pop occurs only after the shared DOM selection dispatch succeeds. Reduced-motion mode keeps the progress readable without animated pointer feedback.

### Gesture selection

| Step | User | Aksa |
| --- | --- | --- |
| 1 | Points at a target | Shows the target as ready for selection |
| 2 | Performs the configured gesture above threshold | Activates the target once |
| 3 | Holds the gesture | Ignores repeats until the signal is released, including after cooldown |
| 4 | Performs the gesture off-target | No activation |

### Pause and resume

| Step | User | Aksa |
| --- | --- | --- |
| 1 | Activates pause from the always-reachable control, keyboard shortcut, or the voice word `Pause` | Stops processing, releases the pointer, keeps the camera indicator honest about the stream state |
| 2 | Works with keyboard or mouse | Full parity, no degraded features |
| 3 | Resumes | Restores the pointer at a neutral position, no queued dwell |

### Runtime ownership

The root application layout owns one head-control provider. Route transitions, Workspace child navigation, and locale refreshes reuse that runtime instead of opening another camera or model. Explicit disable, runtime failure, or root unmount releases the owned stream and model. The Workspace header provides Start head control and Calibrate head control actions, and guided calibration consumes frames from that shared engine.

The authenticated server profile supplied by `readWorkspaceContext` is authoritative. A user-scoped IndexedDB profile is read only when no server profile was supplied. Changing users immediately resets the active scope before that user's cache can resolve.

The current MVP runs Face Landmarker inference on the browser main thread with a 25 ms minimum processing interval. It does not claim worker isolation or measured frame rate. Worker migration and device performance remain open questions ACQ-5 and ACQ-6.

### Confirmation guard

A confirmation dialog opens with inherited dwell cleared and the gesture detector disarmed. A held gesture cannot approve it. The signal must first fall below its configured threshold, then a fresh gesture may select. Dwell starts from idle and completes a new stabilization and dwell cycle. Head control remains available inside the dialog after those re-arm conditions are met.

Tracking loss, pause, restart, and camera recovery use the same boundary reset. They clear the active target, dwell state, gesture state, smoothing history, and partial calibration samples. Five stable raw-pose frames establish a fresh session neutral baseline, and interaction starts on a later frame. Duplicate, stale, and invalid frame timestamps are discarded before pointer state. The held signal present during recovery is never treated as fresh.

## UI States

| Surface | States |
| --- | --- |
| Aksa pointer | hidden, neutral, moving, over eligible target, dwelling, cooldown, paused |
| Tracking status | initializing, active, no face detected, poor lighting, lost, paused, disabled |
| Dwell indicator | idle, progressing, cancelled, complete, suppressed by reduced motion |
| Gesture indicator | ready, detected, below threshold, in cooldown, not configured |
| Control panel | default, adjusting with live preview, reset applied, unusable-setting guard, saved, save failed |
| Fallback banner | camera paused, camera denied, camera unavailable, model failed to load |
| Confirmation guard | movement held, dwell cleared, awaiting deliberate approval |

The Aksa pointer is always visually distinct from browser focus. Both can be visible at once without ambiguity.

## Frontend Responsibilities

Owner: Henix.

- Camera stream acquisition, MediaPipe Tasks Vision Face Landmarker setup in live-stream mode, and teardown that stops all tracks.
- GPU model initialization with a CPU fallback, using the pinned model and WASM hosts permitted by CSP.
- Off-main-thread inference through a Web Worker or an equivalent approach where practical.
- Head-pose to pointer mapping, including sensitivity, dead zone, and smoothing curves.
- Pointer rendering, target eligibility detection, and hit testing.
- Dwell timing, progress indication, immediate cancel on leaving a target, and cooldown.
- Gesture detection from blendshape scores with a user threshold and cooldown.
- Pause and resume control, always reachable, plus a keyboard shortcut.
- Tracking-loss detection, the `Face control paused.` state, and the recovery options.
- Calibration sequence, live preview of setting changes, and the unusable-setting guard.
- Local IndexedDB cache of the profile for immediate startup.
- Keyboard and mouse parity across the whole application.
- Reduced-motion behavior for dwell and pointer feedback.
- Accessible announcements for tracking state changes through a polite live region.
- Frontend tests: mapping math, dwell timing, cancel-on-leave, cooldown, pause, tracking-loss transitions, keyboard parity, reduced motion.

The frontend never sends frames, landmarks, or blendshape series anywhere.

## Backend Responsibilities

Owner: Zaltech.

- Read, write, and reset the accessibility profile, authorized by session.
- Validate profile values against the ranges and enumerations in `.agents/db_schema.md` section 3.6, rejecting out-of-range input.
- Record `settings_persistence` consent before the first profile write.
- Return the profile as a minimal DTO on session establishment so the frontend can start with saved values.
- Reject any profile request that carries a client-supplied user identifier.
- Backend tests: range validation, enumeration validation, ownership, consent precondition, reset behavior.

The backend does not process camera data, does not receive landmarks, and does not compute pointer positions.

## Agent Tools

None. Accessibility control is a client interaction layer, not an agent capability.

The agent never moves the pointer, never triggers a selection, and never changes an accessibility setting. A spoken request to change a setting is routed to the settings interface for the user to complete, not executed as a tool.

## Data Requirements

Tables from `.agents/db_schema.md`: `accessibility_profiles`, `consent_records`.

| Stored | Detail |
| --- | --- |
| `pointer_sensitivity`, `dead_zone`, `smoothing` | Normalized 0 to 100 integers |
| `selection_mode` | `dwell`, `gesture`, `both`, or `off` |
| `dwell_duration_ms` | Integer, null when dwell is off |
| `gesture_type` | `mouth_open`, `brow_raise`, `eye_blink_long`, or `smile` |
| `gesture_threshold`, `gesture_cooldown_ms` | Integers, null when gesture is off |
| `reduced_motion` | User override of the system preference |
| `calibrated_at` | Timestamp of the last successful calibration |
| Consent | `camera` and `settings_persistence` rows with policy version |

Never stored or transmitted: raw frames, cropped face images, landmark coordinates, blendshape series, transformation matrices, calibration imagery, or any derived value that could reconstruct a face.

Client-side only: the current pointer position, dwell progress, and the live landmark stream. All of it is discarded frame by frame.

## Security and Permissions

Requirements from `.agents/security.md` section 7.

- Landmark inference runs in the browser. Frames never reach an Aksa server for control.
- No frame storage and no frame transmission, under any setting.
- Camera access requires a secure context. `Permissions-Policy` grants `camera` to self only.
- Consent is captured after the purpose explanation and before the permission request.
- A visible in-application camera indicator is shown whenever the stream is open.
- Pause stops processing. Disable stops every track on the stream, not only the loop.
- Profile reads and writes are authorized from the session, never from client-supplied identifiers.
- Dwell or gesture alone cannot approve a consequential action, per `.agents/rules.md` section 9. This is an accessibility control that is also a security control against ASI09 in `.agents/security.md` section 5.

## Errors and Recovery

| Failure | Behavior | Recovery |
| --- | --- | --- |
| Camera permission denied | Explains the loss of head control, keeps everything else working | Retry, keyboard, mouse |
| Camera permission revoked while active | `Face control paused.`, pointer frozen, dwell cleared, work preserved | Retry camera, keyboard, mouse |
| No camera device | States that no camera was found | Keyboard, mouse |
| Camera in use by another application | States that the camera is unavailable | Close the other application, retry, keyboard |
| Landmark model fails to load | Stops the stream and states that head control could not start | Retry with GPU or CPU initialization, keyboard, mouse |
| Inference too slow for usable control | States that head control is running slowly and offers to reduce processing quality | Reduce quality, keyboard, mouse |
| No face detected | Positioning and lighting hint, nothing captured | Adjust position, retry, skip |
| Poor lighting | Same hint, tracking continues if usable | Adjust lighting |
| Tracking lost mid-task | Pointer freezes, dwell stops, current task is untouched | Retry camera, keyboard, mouse |
| Calibration failed | Previous profile retained, failed step named | Restart, manual adjust, skip |
| Setting leaves the pointer unusable | Guard blocks the state, reset offered through a keyboard-reachable control | Reset to defaults |
| Gesture never detected | States that the gesture was not recognized and offers a lower threshold or dwell | Lower threshold, switch to dwell |
| Repeated accidental activation | Offers longer dwell, a longer cooldown, or gesture-only selection | Adjust settings |
| Profile save failed | States that settings were not saved, keeps them active in the session | Retry, continue unsaved |
| Profile load failed | Falls back to the IndexedDB cache, then to defaults, and says which is in use | Retry load |

No failure in this feature blocks any Aksa capability. Every failure degrades to keyboard and mouse.

## Accessibility

- Keyboard and mouse reach every action, including all of the controls in this feature.
- The pause control is reachable at all times by pointer, keyboard shortcut, and voice.
- Targets are at least 44 by 44 px with at least 8 px separation, which is also what makes dwell reliable.
- The Aksa pointer never replaces or hides browser focus.
- Dwell progress is visible next to or around the target, and static under `prefers-reduced-motion`.
- Tracking state changes announce through a polite live region. Tracking loss announces assertively.
- Setting controls use plain language, not raw numbers alone, and show a live preview.
- No control depends on hover.
- Status carries text plus an icon, never color alone.
- Movement is held while a confirmation opens so the dialog cannot be approved by momentum.
- Reduced motion never removes state visibility.

## Acceptance Criteria

1. Head movement moves the Aksa pointer, visually distinct from browser focus.
2. Sensitivity, dead zone, and smoothing each change behavior with a live preview and persist across sessions.
3. Dwell activates only after the configured duration on a stable eligible target.
4. Moving off a target cancels dwell immediately with no activation.
5. One configured facial gesture activates a target, respects its threshold, and respects its cooldown.
6. Dwell and gesture can be enabled independently or together.
7. Pause stops control from a single always-reachable action and resume restores it at a neutral position.
8. Every Aksa action is completable with keyboard only and with mouse only.
9. Losing the camera shows `Face control paused.`, stops dwell, and preserves the current task.
10. Calibration values persist and reload on the next sign in.
11. Reset to defaults always produces a usable configuration.
12. A confirmation cannot be approved by the same dwell or gesture that opened it.
13. No camera frame, landmark set, or blendshape series is stored or sent anywhere.
14. Under `prefers-reduced-motion`, dwell progress is shown without animation.
15. An out-of-range profile value submitted directly to the server is rejected.
16. Requesting another user's profile is refused server-side.

## Test Scenarios

| ID | Scenario | Expected |
| --- | --- | --- |
| AC-1 | Set sensitivity low, then high, and reach all four screen corners | Reachable at the high setting, stable at the low setting |
| AC-2 | Set dead zone high and hold the head still with small tremor | No pointer drift |
| AC-3 | Set smoothing high and move quickly | Smooth path, lag still within the NFR-1 target |
| AC-4 | Dwell on a target and leave at 80 percent progress | No activation, progress resets |
| AC-5 | Dwell to completion twice in rapid succession | Second activation blocked until cooldown elapses |
| AC-6 | Perform the gesture while pointing at empty space | No activation |
| AC-7 | Perform the gesture below threshold | No activation, indicator shows below threshold |
| AC-8 | Hold the gesture continuously | Exactly one activation |
| AC-9 | Open a confirmation by dwell, then continue dwelling on Approve | Approval requires a deliberate second signal |
| AC-10 | Revoke camera permission during an active task | `Face control paused.`, dwell cleared, task state unchanged |
| AC-11 | Cover the camera | No face detected state, no activation, nothing captured |
| AC-12 | Pause, then complete a full task with the keyboard | Full parity, no missing capability |
| AC-13 | Set an extreme sensitivity that would trap the user | Guard blocks it, keyboard-reachable reset available |
| AC-14 | Enable `prefers-reduced-motion` and dwell | Static progress indication |
| AC-15 | Submit a profile with `dwell_duration_ms` far outside the accepted range | Server rejects with a validation error |
| AC-16 | Submit a profile write containing another user's identifier | Session values used, injected values ignored, SEC-T5 |
| AC-17 | Sign in on a second browser | Server profile loads, IndexedDB cache is populated from it |
| AC-18 | Inspect all network traffic during 60 seconds of head control | No frame, landmark, or blendshape payload leaves the browser |

## Demo Scenario

Woven through minutes 2.5 to 4 and referenced again during the confirmation moment at minute 6.5 of the pitch in `.agents/prd.md` section 23.

1. Show the pointer following head movement with the camera indicator visible.
2. Raise sensitivity and show the reach change immediately.
3. Dwell on a control to activate it, then start a dwell and move away to show the cancel.
4. Perform the configured gesture to select, showing the cooldown indicator.
5. Press pause, complete one action with the keyboard, then resume.
6. During the later Drive move, point out that the confirmation requires a deliberate approval rather than dwell momentum.

State plainly during the demo that Aksa uses head pose and facial gesture, not eye tracking, and that frames never leave the browser.

## Open Questions

| ID | Question | Blocks |
| --- | --- | --- |
| ACQ-1 | Default sensitivity, dead zone, smoothing, and dwell duration after usability testing. Tracked as OQ-5. | Acceptance criterion 2 |
| ACQ-2 | Which gesture is the default, and which of the four enumerated types survive testing? Tracked as OQ-4. | Scope |
| ACQ-3 | What counts as the deliberate second signal for confirmation approval: a longer dwell on a dedicated control, a gesture plus dwell combination, or a spoken word? | Acceptance criterion 12 |
| ACQ-4 | Default gesture threshold and cooldown values. | Gesture selection |
| ACQ-5 | Whether Web Worker inference is achievable within the window, or whether main-thread inference with a reduced frame rate is the MVP path. | NFR-1 and NFR-2 |
| ACQ-6 | Frame rate and model complexity settings that keep pointer lag under the NFR-1 target on the demo machine. | NFR-1 |
| ACQ-7 | Whether a voice `Pause` word is reliable enough to be a documented control, or whether it stays keyboard and pointer only. | Pause and resume |

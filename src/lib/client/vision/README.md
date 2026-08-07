# Vision boundary

MediaPipe Tasks Vision runs browser-only head control here. The engine owns its camera stream, inference loop, track listeners, and model lifecycle. Every failed, replaced, disabled, or unmounted run stops owned tracks and detaches video.

Onboarding and Workspace use separate route-scoped providers. Leaving onboarding releases its stream and runtime calibration. Workspace exposes explicit Start and Calibrate controls and keeps that provider alive across Workspace child routes.

The saved accessibility profile comes from the authenticated server response. Its user-scoped IndexedDB entry is only a cache when no server profile is available. Camera frames, landmarks, blendshape sequences, and raw calibration samples never leave the browser or enter storage.

The pinned MediaPipe WASM and face model load from `cdn.jsdelivr.net` and `storage.googleapis.com`. The CSP allowlist retains only those runtime hosts plus `wasm-unsafe-eval`; wildcard access is not required.

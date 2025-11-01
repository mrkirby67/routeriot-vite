# Speed Bump Visibility Repair Pass

## Validation Summary
- `npm run aicp-validate -- --fix` → ✅
- `npm run aicp-integrity` → ✅
- `npm run build` → ✅

## Implementation Notes
- Control panel buttons now write to `speedBumps/{teamId}` using normalized lowercase IDs and emit `showFlashMessage('Speed Bump Sent!')` on success.
- Player listener normalizes team IDs, logs snapshot errors via `console.warn`, and dispatches `showSpeedBumpOverlay(type, { team })` while clearing docs with `updateDoc({ active: false })`.
- Overlay module schedules visibility on the next frame, applies fade-in/out transitions, and logs `[SpeedBump] Overlay displayed for team …` / `[SpeedBump] Cleared in 4 s`.
- Firestore rules explicitly allow read/write on `speedBumps/{teamId}` for the sandbox setup; tighten before production rollout.

## Follow-Up
- Smoke-test `/control.html` and `/player.html` in both local and staging environments to observe the overlay timings with live Firestore data.

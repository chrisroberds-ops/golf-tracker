# MISSION: Indoor Foam-Ball Pitching Tracker & 2-Player Green (G-O-L-F)

You are building a single-page web app that tracks a foam golf ball's launch off a short
indoor pitch/chip shot using a browser camera feed, estimates carry distance and
lateral miss, and displays the result on a stylized target green with a 2-player
G-O-L-F (HORSE-style) game mode.

This is a PRACTICE TOOL, not a commercial launch monitor. Repeatability and "close
enough to be fun" matter more than lab-grade accuracy. Say so in comments where
relevant so future-you doesn't over-engineer.

---

## HARD CONSTRAINTS (read before writing any tracking code)

1. **No native slow-motion access.** This is a browser app using `getUserMedia`.
   Android/Chrome does NOT expose the phone's 120/240fps native slow-motion capture
   modes to web pages — that requires Camera2/CameraX, a native API. Real-world
   ceiling here is **~30-60fps**, dictated by whatever camera + browser negotiate.
   Do not design around higher frame rates being available. Request:
   ```js
   const constraints = {
     video: {
       deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
       width: { ideal: 1280 },
       height: { ideal: 720 },
       frameRate: { ideal: 60 }   // ideal, NOT exact — some devices will refuse "exact"
     }
   };
   ```
   Log the *actual* negotiated frame rate/resolution after `getUserMedia` resolves
   (via `track.getSettings()`) and display it in the UI. Don't assume the ideal was granted.

2. **Multi-device, one codebase.** This must run identically from a phone's rear
   camera OR a USB webcam plugged into a Chromebook/laptop. Use
   `navigator.mediaDevices.enumerateDevices()` to list video inputs and show a
   simple dropdown on the calibration screen so the user picks which camera to use.
   Do not hardcode "front" or "rear" camera assumptions.

3. **Multi-frame velocity/angle estimation, not a 2-frame diff.** Do NOT calculate
   launch angle and speed from just two consecutive frames — at 30-60fps that's too
   noisy (a 1-2px detection jitter swings the result wildly). Instead:
   - Track the ball's (x,y) center across every frame from first detected motion
     until it leaves the frame or hits the net (aim for at least 5-8 samples).
   - Fit a linear regression (least squares) to the x(t) and y(t) position series
     separately to get smoothed velocity components, THEN compute launch angle and
     speed from the fitted slopes, not raw frame-to-frame deltas.
   - If fewer than 4 valid frames are captured for a shot, discard it and prompt
     "shot not captured cleanly, try again" rather than reporting a bogus number.

4. **Foam ball physics are NOT real golf ball physics.** Implement carry-distance
   estimation via simple numerical integration (Euler or RK2 is fine) using:
   - High drag coefficient (Cd ≈ 0.5–0.6) and low mass appropriate for a foam ball
     (make both tunable constants at the top of the file, clearly labeled, expect
     to hand-tune them against real measured shots).
   - No spin/Magnus modeling — we are not measuring spin, and pretending otherwise
     would be a fake precision. Comment this explicitly.

5. **Lateral (left/right) deviation is a stretch goal, not a v1 requirement.**
   Do not build the "ball shrinks as it moves away" pixel-width depth trick as the
   primary approach — at this frame rate and capture distance it's unreliable.
   For v1: report carry distance only, and let the "miss the green" outcome handle
   wildly mis-hit shots. Revisit lateral tracking only after distance tracking is
   proven solid.

---

## STACK & ARCHITECTURE

- Single-file `index.html` (or a small Next.js page if it's easier to iterate in
  this project's existing stack — your call, keep it simple).
- OpenCV.js via CDN for HSV color masking + contour detection.
- No backend, no database. Fully client-side.
- Must run as a PWA (manifest + service worker) so it can be added to the home
  screen on Android — reuse the same pattern already used in the Ovis and
  SafePark projects (network-first service worker).
- Secure context (https) is required for camera access — this will need a real
  Vercel deploy to test properly; localhost also works for dev.

## COMPUTER VISION PLAN

1. Calibration screen:
   - Camera device picker (see constraint #2).
   - "Lock Focus & Exposure" button using `applyConstraints` on the track where
     supported, to stop autofocus/auto-exposure hunting mid-swing.
   - HSV threshold calibration UI: live preview + sliders (or tap-to-sample the
     ball's color from the frame) to isolate a bright pink/orange/yellow foam ball
     against a dark backdrop.
   - Show live negotiated FPS/resolution (constraint #1) so the user knows what
     they're actually getting.
2. Shot detection: watch the tracked ball centroid; trigger "shot in progress"
   when it starts moving rapidly from a resting position.
3. Capture frames until the ball leaves frame bounds or several consecutive frames
   show no detection (ball left the net/frame).
4. Run the regression from constraint #3, get launch angle + speed.
5. Run the physics integration from constraint #4, get carry distance in yards,
   clamped/labeled for the 20–70 yard target range.
6. Speak the result via `window.speechSynthesis` (e.g. "42 yards").

## DISPLAY / GAME LAYER

A working reference prototype for this half already exists
(`golf_green_prototype.html`) — a perspective target green, distance rings, pin,
ball-flight animation, and full 2-player G-O-L-F turn/letter logic, currently wired
to a `simulateShot()` stand-in instead of real tracking data.

A second reference prototype (`calibration_prototype.html`) covers the camera
side of the UI: device enumeration/picker, live preview, negotiated FPS display,
a best-effort focus/exposure lock via `applyConstraints`, tap-to-sample HSV color
picking, tolerance sliders, and a bounding-box color-threshold detector used as a
stand-in for OpenCV.js contour detection. Reuse this UI and its calibration flow;
swap the bounding-box detector for OpenCV.js contour detection per the vision plan
below, but keep the tap-to-sample interaction and device-picker pattern as-is.

**Integration point:** replace calls to `simulateShot()` with the real distance
value (in feet-from-pin, or null for a clean miss) produced by the tracking
pipeline above, calling the existing `recordShot(distanceFeetOrNull)` function.
Do not rewrite the game-state logic in that file unless something is actually
broken — it already implements the standard-setting/beating rules, letter
tracking, turn switching, and win condition.

Keep the camera/calibration UI and the green/game display as either:
- two views in one page (toggle or split-screen), or
- one page that adapts by screen size (phone = camera+calibration, larger
  screen/TV = green+game) — your call, whichever is less code to keep in sync.

---

## QUALITY GATES & AUTONOMOUS INSTRUCTIONS

1. Scaffold the file(s), get OpenCV.js loading and the camera device picker working
   first, before writing any tracking math. Confirm in your embedded browser tool
   that the page renders without console errors and the device picker populates.
2. Build calibration (HSV masking + focus lock) next, and visually confirm via
   screenshot that a bright-colored test object gets a bounding contour drawn
   around it in your embedded browser preview.
3. Build shot detection + the regression-based angle/speed calculation. Since you
   cannot swing a real club in a screenshot, write this as testable pure functions
   (feed in a synthetic array of (x,y,t) points, assert the fitted angle/speed are
   reasonable) so you can verify the math without a live camera.
4. Wire in the physics integration and confirm output stays within sane bounds for
   the 20-70 yard target range given reasonable synthetic inputs.
5. Wire the tracking pipeline's output into `recordShot()` from the existing green
   prototype, don't duplicate the game logic.
6. Do not claim the camera pipeline is "done" or "accurate" — flag clearly in your
   final summary that HSV thresholds, drag/mass constants, and pixel-to-real-world
   calibration all require in-person tuning with the actual foam ball, lighting,
   and camera that will be used, and that this is expected, not a bug.

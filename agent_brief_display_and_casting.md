# MISSION: Integrate photo-based green display + split Capture/Display views for TV casting

Two related pieces of work, described together since the second depends on the first.

---

## PART 1 — Integrate the photo-based green display

A working reference prototype exists: `golf_green_photo_prototype.html` (attached alongside
this brief). It replaces the flat-color CSS trapezoid green with three real course photos
(70yd/50yd/35yd base distances), and includes:

- A distance slider (20-70yd) that picks the closest-matching photo and applies a modest
  CSS `transform:scale()` zoom within it, anchored on the flag's pixel position via
  `transform-origin`, so zooming feels like walking toward the pin rather than just
  cropping the frame.
- **Corrected, hand-calibrated pin anchor coordinates** for all three photos (measured by
  cropping/zooming into each flag directly — do not re-guess these from a quick glance,
  they were wrong the first two times and this cost real debugging effort to fix).
- A **"Calibrate Pin" mode**: toggle it, set the slider to a photo's own base distance
  (70/50/35 exactly, so scale=1 and no zoom math is in the way), click directly on the
  base of the flagstick (not the flag cloth — the stick's base is the fixed ground-truth
  point) in the photo, and it reads back exact `pinX`/`pinY` percentages. Keep this mode —
  it's the mechanism for fixing calibration drift later, not just a one-time tool to throw
  away.
- A **proximity box** (top-left corner) showing distance-to-pin in feet, or "Missed green"
  in red — this replaced an earlier concentric-rings design that was harder to read.
- **Grounded ball placement logic**: close shots land in a tight radius around the pin with
  a soft shadow beneath the marker (grounding cue so it doesn't look like it's floating);
  missed shots are pushed clearly outside the green's normal radius so a miss can never be
  visually confused with a near-miss. Vertical spread is deliberately tighter than
  horizontal and biased toward staying at or below the pin's screen height — a ball resting
  on the green should never render above the flag's base.

**Do:** pull this photo/scale/calibration/proximity-box/grounding logic into the real app as
the primary green display, replacing the flat-color trapezoid from the earlier prototype.
Wire the existing `recordShot(distanceFeetOrNull)` entry point to drive the photo version's
ball placement the same way it drove the old one — the game/turn logic in G-O-L-F mode
should not need to change, only what renders underneath.

**Images:** the three compressed JPEGs used in the prototype are embedded as base64 in the
HTML file directly. Extract them to real image files in the project (e.g.
`public/green-70.jpg`, `green-50.jpg`, `green-35.jpg`) rather than keeping them inlined as
base64 in application code — inlining was only done for this prototype's portability.

---

## PART 2 — Split into Capture view and Display view, synced for TV casting

**The real-world setup this needs to support:** one Chromebook, two browser tabs. Tab A
(Capture) stays open on the laptop screen and does everything camera-related — device
picker, HSV calibration, OpenCV detection, the shot state machine, voice intent tagging.
Tab B (Display) shows only the green/photo/proximity-box/game UI, gets cast to a TV via
Chrome's built-in tab-casting, and has no camera code running in it at all.

**Sync mechanism: `BroadcastChannel`, not WebSocket.**
Both tabs are same-origin, same-browser, same-device — `BroadcastChannel` is the correct,
simplest tool here: zero server, zero network round-trip, works instantly between tabs.
Do NOT reach for WebSocket/PeerJS/Firebase for this — that complexity is only justified if
the display needs to run on a genuinely separate physical device, which is not this
person's current setup. (If that changes later, this is a distinct, separate piece of work
— flag it rather than building it speculatively now.)

**Implementation:**
1. Add a route/query-param split: default view (`/` or no param) is the existing Capture
   experience. A `?view=display` (or dedicated `/display` route, whichever fits the current
   project structure better) renders ONLY the green/photo/proximity-box/game UI from Part 1
   — no camera permission request, no OpenCV load, nothing camera-related at all. This
   matters: requesting camera access in the Display tab would be pointless and could
   prompt for permissions on a screen the person isn't looking at.
2. In the Capture view, on every `recordShot()` call (real detection or the existing
   simulate-shot path), also broadcast the result via a shared `BroadcastChannel` (e.g.
   channel name `golf-tracker-shots`), with a plain payload like
   `{ type: 'shot', distanceFeet: number|null, timestamp }`.
3. In the Display view, listen on the same channel and call the local `recordShot()`
   equivalent when a message arrives, driving the ball placement / game state exactly as
   it would if detection were running locally.
4. Also broadcast game-state-relevant events that originate in Capture (target distance
   changes, G-O-L-F turn/letter updates if those are triggered from Capture-side UI) so
   both tabs stay in sync, not just shot results.
5. Handle the channel not existing yet gracefully — if Display is opened before Capture
   (or vice versa), neither should error; state should just sync from whichever
   fires next.

**How this gets used, for reference (no code needed for this part, just context):**
Open the app normally on the Chromebook (defaults to Capture view) — that tab stays on the
laptop screen for camera/calibration. Open a second tab at the `?view=display` URL, then
use Chrome's "Cast" feature on that second tab specifically (not the whole desktop) to send
it to the TV. The two tabs communicate locally via BroadcastChannel the whole time.

---

## Quality gates

1. Confirm the Display view genuinely requests zero camera permissions and loads zero
   OpenCV code — check the network tab / permissions prompt to verify, don't just assume
   because the route doesn't call the camera functions.
2. Test the BroadcastChannel sync with two tabs open side by side before assuming it
   works — trigger a simulated shot in Capture and confirm Display updates without a
   manual refresh.
3. Confirm the pin calibration values and grounding-shadow ball logic from the prototype
   survived the integration unchanged — this took real debugging effort to get right and
   shouldn't regress during the refactor.

# Swipe-gesture pattern

> The same pointer-event arbitration appears in two places — `SwipeRow`
> for swipe-to-delete on history rows, and the page-level carousel on
> `/game/done`. They differ in commit behaviour but share the same
> direction-arbitration rules, which exist for iOS Safari reasons.

## Rules of engagement

1. **Don't capture pointer on `pointerdown`.** Capturing kills the
   synthetic click on a no-movement tap, which breaks tap-to-navigate
   on anchors and buttons inside the swipe surface. Capture later,
   inside `pointermove`, only after horizontal direction is confirmed.
2. **Direction is decided once per gesture**, with a small hysteresis
   threshold (8–10px). Until `|dx|` or `|dy|` crosses that threshold,
   both axes are live. The moment one wins, the gesture is locked into
   that axis until pointerup.
3. **Vertical win → release the gesture.** Set `dragging = false`, snap
   transform to 0. The browser owns the rest of the touch (page scrolls
   normally).
4. **Horizontal win → capture pointer + own the gesture.** Translate the
   surface with `dragX`. Apply rubber-banding past the boundary
   conditions (no neighbour to swipe to).
5. **Commit threshold is fractional**, not absolute. A fraction of the
   surface width (30–45% depending on use). Past the threshold on
   pointerup → commit; otherwise → snap back to 0.
6. **Edge dead zone at the left.** If `pointerdown.clientX < 24`, don't
   start a horizontal gesture — iOS Safari's swipe-back lives there.
7. **`touch-action: pan-y`** on the swipe surface. Lets vertical scroll
   stay native while horizontal motion is delivered to our handlers.

## Two implementations

### `SwipeRow.svelte` — swipe-left-to-delete

Used inside the history list. The surface is one history-card row; the
"delete tray" underneath is rendered conditionally and shows a flat red
gradient.

- Direction threshold: **8px**.
- Commit ratio: **0.45** of row width.
- Drag is **left-only**: positive `dx` rubber-bands at 15% with a 24px
  cap (a tiny "elastic" feel without revealing anything underneath).
  Negative `dx` is allowed up to `-rowWidth`.
- On commit: animate to `-rowWidth`, then call `onDelete()` after
  `setTimeout(180ms)`. The actual IDB deletion is the parent's
  responsibility.
- On snap-back: animate `dragX = 0`, then drop the `.snapping` class
  after the transition.
- The red tray is rendered only when `dragging || dragX !== 0`. No DOM
  when idle → no 1px anti-aliased seam at rounded corners on iOS.

```ts
// Critical lines from SwipeRow:
function onPointerDown(e) {
  // ...
  // Critical: do NOT setPointerCapture here.
}

function onPointerMove(e) {
  // ...
  if (decided === null) {
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
      decided = Math.abs(dx) > Math.abs(dy);
      if (!decided) { dragging = false; dragX = 0; return; }
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
    }
  }
  // ...
}
```

### `/game/done` — page-level prev/next carousel

The whole match view is one of three panels in a horizontal track that
translates with the gesture. On commit, the panel data is rebound
atomically and the translate snaps back to 0 — see
`docs/ARCHITECTURE.md` for the data side and the bullets below for the
gesture side.

- Direction threshold: **10px** (slightly higher than rows because the
  swipe area is large and we want vertical scrolling to win more often).
- Commit ratio: **0.3** of slot width.
- `dragX` is **bidirectional**: positive (drag right) → prev, negative
  (drag left) → next. Rubber-band at 25% when the boundary panel is
  null.
- Slot width is measured from the track element's `clientWidth`
  (not `window.innerWidth`) so it accounts for `.shell` padding.
- On commit:
  1. Animate `dragX` to `±slotWidth` over 220ms.
  2. On animation end (`setTimeout(220ms)`), in one synchronous tick:
     - Reassign `center / prevPanel / nextPanel` so the previously
       adjacent panel is now in the centre slot.
     - Reset `dragX = 0` with `.snapping` off (no transition).
     - `goto(url, { replaceState: true, noScroll: true, keepFocus: true })`
       to sync URL, with a `loadedForId` guard so the URL-driven
       `$effect` doesn't trigger a re-fetch.
  3. The `$effect` watching neighbours reactively fetches the new
     far-side panel from IDB.
- The `committed` flag blocks new gestures while the animation is in
  flight.

## Why this pattern over a library

- Total LOC is ~60 per implementation; a touch-gesture library would
  be larger and would still need the same iOS quirks documented above.
- We control the exact behaviour of edge cases (rubber-band, dead zone,
  capture timing). Libraries hide those.
- The two use sites genuinely differ in commit behaviour (delete vs
  navigate); shoehorning them into one abstraction wouldn't simplify
  much.

## Testing

- **Real touch on a phone is the only reliable test.** Chrome DevTools
  MCP can dispatch synthetic `PointerEvent`s, but Svelte 5's delegated
  event handlers do not get invoked by them, so the gesture won't run
  even though the events fire. Verified during /game/done carousel
  development.
- Button-driven navigation paths (`Previous match` / `Next match` /
  swipe-to-delete trash buttons) are the practical regression test for
  the carousel / delete data flow.
- The geometry can be inspected via `evaluate_script` in DevTools:
  positions of `.panel.center / .panel.side.prev / .panel.side.next`
  before / during / after a manually-animated transform reveal whether
  the layout math is sound.

## Adding a third swipe surface

If a future feature needs another swipe gesture:

1. Decide if it's row-scoped or page-scoped. Row-scoped → consider
   reusing `SwipeRow` directly (it takes a `children` snippet).
2. If page-scoped and substantially different, copy `/game/done`'s
   gesture logic and adapt; don't try to generalize prematurely.
3. Preserve the seven rules above. They're scarred-in.

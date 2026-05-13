# iOS PWA quirks and constraints

> The deployment target is an installed PWA on iPhone (iOS Safari engine).
> This doc captures the platform-specific gotchas that aren't obvious from
> reading the code.

## What "PWA" means here

The user adds the deployed site to their home screen ("A2HS") from
iOS Safari. iOS launches it in **standalone** mode, which is a
WebKit-backed app shell with no browser chrome. It's not a true native
app — it's the same WebKit, plus a few standalone-mode quirks.

`app.html` sets:

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="theme-color" content="#1a1a2e" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="apple-mobile-web-app-title" content="Krusty" />
```

- `viewport-fit=cover` — content extends behind the status bar / home
  indicator. **Required** for `env(safe-area-inset-*)` to return non-zero.
- `black-translucent` status bar — content shows through, so we have
  to pad ourselves (see below).
- `apple-mobile-web-app-capable: yes` is the legacy switch that makes
  iOS treat the A2HS launch as standalone.

## Safe-area insets

The status bar / notch / home indicator sit *over* our content unless we
push it out of the way. The shell does this once in
`src/routes/+layout.svelte`:

```css
.shell {
  padding-top: max(16px, calc(env(safe-area-inset-top) + 8px));
  padding-right: max(16px, env(safe-area-inset-right));
  padding-bottom: max(16px, calc(env(safe-area-inset-bottom) + 8px));
  padding-left: max(16px, env(safe-area-inset-left));
}
```

Pages should **not** duplicate this — let the shell own the global
inset. Per-page sticky elements like the top-bar on `/game/done`
re-use `env(safe-area-inset-top)` in their `top:` calc so they sit just
below the inset, not behind it.

## File pickers

The OS file picker is the only file I/O surface available to us.

- **`<input type="file" accept=".json">`** works in standalone PWA. On
  iOS this opens the Files-app picker with iCloud Drive integration.
  Used by the History modal's Import flow.
- **Save via `<a download="…" href="blob:…">.click()`** works in
  standalone PWA. iOS opens the "Save to Files" sheet; the user picks
  iCloud Drive. The `download` attribute's value is the default
  filename; iOS lets the user edit it before saving.

What we **don't** get:

- **No File System Access API** (`showOpenFilePicker` /
  `showSaveFilePicker`) — Chrome-only, Safari doesn't ship it. So we
  cannot remember a "this file is my backup, write to it again" handle.
  Every save is a fresh user-driven Save sheet.
- **No directory access**, no way to enumerate files.
- **No file pickers from non-user-gesture code.** Must come from a
  click handler.

## Service worker is HTTPS-only (with a localhost carve-out)

This is the big one for testing:

- On `localhost` / `127.0.0.1` — service worker runs in dev (we have
  it disabled anyway via `devOptions.enabled: false`, but it could be
  flipped on).
- On a LAN IP over plain HTTP — **no service worker**. The "Add to
  Home Screen" install path is also degraded. You can run the app and
  IDB will work, but you're testing the in-Safari experience, not the
  installed-PWA experience.
- On `https://prwhite.github.io/gintown-pwa/` — full PWA experience.

To verify standalone-mode behaviour, you have to push to Pages.

## IndexedDB persistence

iOS Safari can evict IDB under storage pressure. The mitigation is
`navigator.storage.persist()`, called once in `+layout.svelte` on mount.
- iOS typically **grants** persistence for installed PWAs.
- iOS typically **denies** it for regular Safari tabs.

The console warning `"persistent storage not granted; history may be
evicted under storage pressure"` is expected outside of standalone-PWA
mode and is harmless.

## iOS Safari "swipe back" gesture

Swiping from the very-left edge of the screen triggers iOS Safari's
back navigation. We coexist with it on `/game/done`:

- The match-history swipe surface has `touch-action: pan-y`, which
  delivers horizontal swipes to our JS (so iOS doesn't claim them as
  back-gestures everywhere).
- An `EDGE_DEAD_ZONE` of 24px at the left edge is reserved — if the
  pointerdown lands in there, we don't start a carousel gesture. The
  user can use the BackButton instead.

See `docs/SWIPE-PATTERN.md` for full mechanics.

## Tap-vs-swipe and `setPointerCapture`

iOS Safari is touchy about synthetic clicks. If you call
`setPointerCapture()` on `pointerdown`, the synthetic click that fires
on a no-movement tap is suppressed, which kills tap-to-navigate on
anchors and buttons inside a swipe surface.

**Rule:** never capture on `pointerdown`. Only capture inside
`pointermove`, after the horizontal-vs-vertical direction has been
arbitrated (≥10px movement on the X axis with X-movement > Y-movement).

## Common visual snags

- **`-webkit-touch-callout: none`** is fine and prevents the long-press
  callout. But **avoid `user-select: none` on anchors** — iOS Safari
  uses text-selection as a precondition for click in some paths;
  disabling it breaks taps on anchors. Use `-webkit-touch-callout: none`
  and `draggable="false"` instead.
- **Rounded corners + colored backgrounds underneath** can show a 1px
  anti-aliased seam on iOS even when the surface is at full opacity.
  The fix in `SwipeRow.svelte` is to **conditionally render** the
  underneath tray only when actively dragging — no DOM, no AA seam.
- **`@keyframes` animations only play on mount.** If you swap the prop
  on a long-lived component, the animation won't replay. We
  intentionally don't replay the hero animation when navigating
  match-to-match in the carousel — the carousel motion is the
  animation.

## Standalone-mode detection

`window.matchMedia('(display-mode: standalone)').matches` is `true` in
installed-PWA mode. We don't currently use it, but it's there if a
future feature needs to behave differently in standalone vs Safari tab.

## Things to test on every iOS-affecting change

1. Safe-area: launch the installed PWA, confirm nothing sits behind the
   status bar or home indicator.
2. Save backup: tap Save, confirm the Save-to-Files sheet appears and
   "On My iPhone" / "iCloud Drive" are pickable destinations.
3. Import: tap Import, navigate to a saved bundle in Files / iCloud,
   confirm it loads.
4. Swipe carousel on `/game/done`: confirm horizontal carousel swipes
   work, vertical scroll still works, and iOS swipe-back from the left
   edge still works.
5. Tap-to-navigate on history-list rows (which sit inside a
   swipe-to-delete row): tap should navigate.
6. Update toast: after a deploy, the next launch should show the
   "update available" toast.

## Resources worth remembering

- The Files-app picker UX (iCloud Drive integration) is the entire
  reason we standardized on JSON-blob backup over any clever
  built-in-cloud-sync scheme.
- `apple-mobile-web-app-*` meta tags are legacy but still required.
  Don't drop them in favour of the W3C manifest equivalents — iOS
  reads the meta tags.

# Claude Code Notes — gintown-pwa

> Read this file first. Topical deep-dives live in `docs/`. The aim is that
> a future Claude (or future you) opening a fresh session in this repo
> can be productive without recovering context from elsewhere.

## What this is

An offline-first PWA for keeping score during in-person Krusty Gin games.
Single-user, single-device. Lifts visual identity and Krusty rules from
the multi-user [gintown](https://github.com/prwhite/gintown) repo, but
shares no code or runtime — this is a standalone SvelteKit app deployed
to GitHub Pages.

Not a sync engine, not multiplayer. The point of the PWA is to replace
a paper scoresheet at the table.

## Stack at a glance

- **SvelteKit + Svelte 5 (runes)** — `$state`, `$derived`, `$effect`,
  `$props`. SSR/prerender off; runtime is pure CSR. Adapter is
  `@sveltejs/adapter-static` so the build output is a flat directory.
- **IndexedDB via `idb`** — `src/lib/db.ts`. Schema v3. See
  `docs/ARCHITECTURE.md`.
- **vite-plugin-pwa + Workbox** — auto-update service worker,
  `generateSW` strategy, manual reload toast in `+layout.svelte`.
- **GitHub Pages** via `.github/workflows/pages.yml`. Base path
  `/gintown-pwa` injected at build time. See `docs/DEPLOYMENT.md`.
- **No backend.** Persistence is IDB + a JSON backup/import flow through
  the OS file picker.

## Footguns (read every session)

### 1. Svelte 5 `$state` Proxies vs `db.put` (IndexedDB structured-clone)

**Symptom:** `Error: The object can not be cloned` from any IDB write.

**Cause:** Svelte 5 deep-proxies anything stored in `$state`. IDB's
`structuredClone` algorithm refuses to serialize Proxies.

**Fix:** Don't hand `$state`-wrapped values directly to `db.put`,
`db.add`, `tx.store.put`, `bulkPutGames`, etc. Patterns that work:
- Hold the to-be-persisted value in a plain `let foo = ...` (non-reactive).
  Only put display metadata into `$state`.
- Or at write time: `$state.snapshot(value)` returns a plain copy.

The `writable` stores in `src/lib/stores/*.ts` are NOT deep-proxied —
this gotcha only affects values declared via `$state`. Hit so far on:
- `/game/done` rematch path (passed `game.players` through `currentGame.start`).
- `HistoryModal` import path (parsed games held in `$state.status`).

### 2. Svelte scoped-CSS does not match across components

**Symptom:** A CSS rule like `.top-bar > * { pointer-events: auto }`
silently doesn't apply to a child element rendered by an imported
component (`<BackButton />` etc.).

**Cause:** Svelte hashes selectors per-component. A selector in
`+page.svelte` only matches elements with `+page.svelte`'s scope hash;
elements rendered by `BackButton.svelte` carry BackButton's hash.

**Fix:** Use `:global(.back-btn)` for cross-component selectors, or move
the rule into the child component's own `<style>` block. (We learned
this the hard way when the back button on `/game/done` silently stopped
working.)

### 3. iOS Safari + `setPointerCapture` on `pointerdown` eats clicks

Capturing on `pointerdown` suppresses the synthetic click on a stationary
tap, which breaks tap-to-navigate on anchors inside a swipe surface.
**Fix:** Defer `setPointerCapture` to `pointermove`, only after horizontal
direction is confirmed. See `docs/SWIPE-PATTERN.md` and `SwipeRow.svelte`.

### 4. Global gitignore matches `Icon?`

The user's global gitignore has a `Icon?` rule (macOS Finder cruft)
that matches `icon-*.png` case-insensitively. The local `.gitignore`
re-includes `static/icons/` to keep the generated PWA icons trackable.
Don't remove that exception.

## Krusty Gin rules — the scoring model in code

- Two players, fixed indices 0 and 1. Names are free text.
- Each *hand* has exactly one **ginner** (winner of the hand) and one
  **defender**. The ginner's `ginnerTotal` and the defender's
  `defenderTotal` (which can be negative) get added to their game totals.
- `defenderDeadwood` and `defenderLayoffs` are metadata for posterity;
  they're displayed but not summed (the player announces the total
  directly).
- The **dealer** alternates strictly each hand starting from
  `firstDealerIndex`. `dealerIndexFor()` in `src/lib/scoring.ts` is the
  only place that math should live.
- First player to reach `targetScore` (default 300) wins. Ties on the
  same hand resolve to player 0.

Krusty's defining quirk vs. standard gin: ginner totals start at 50
(not 25), defender totals can be **negative**, and the announced totals
are the source of truth — we don't reconstruct from deadwood/layoffs.

## Communication style

- This is a single-user, single-device app — when discussing UX, the
  user is testing on an iPhone (installed PWA) or in iOS Safari over
  LAN. Desktop-only behaviour (Chrome DevTools, hover states) is
  developer ergonomics, not the target experience.
- The user is the sole player base ("Kirsty" and "Rusty") plus
  historical OCR'd scoresheets. Don't generalize to multi-user.
- "frontend" / "backend" jargon is irrelevant here — there's no backend.
  Talk about IDB, the service worker, the build, etc. directly.
- The user prefers terse answers with the why surfaced. Don't bury
  decisions in implementation detail.

## How to develop

```sh
make install      # one-time
make run-dev      # vite on :5173, --host so phones can hit it over LAN
make build        # produces ./build (static, ready for Pages)
make preview      # serve ./build locally
make check        # svelte-check (types + a11y warnings)
make icons        # regenerate PWA icons from static/icon-source.png
make seed-history # convert history.nogit/*.json → seed bundle
```

After frontend changes, the build is **not** required for the user to
test — vite-dev hot-reloads. The build is what GitHub Actions runs on
push to `main`. See `docs/DEPLOYMENT.md`.

## Testing approach

There is no test suite. Verification is:
1. `make check` for types/lint.
2. Manual smoke in the browser on `localhost:5173`.
3. Chrome DevTools MCP to drive flows when useful (it can `click`,
   `evaluate_script`, etc., but **synthetic PointerEvents do not route
   to Svelte 5's delegated handlers** — real touch input is needed to
   exercise swipe gestures). Test swipes by visiting on a phone.
4. Iterate on the user's phone for any iOS-specific UI work
   (safe-area, A2HS, standalone-mode behaviour).

## Where things live

```
src/
  routes/
    +layout.svelte           shell, PWA SW registration, update toast
    +page.svelte             main page (history list, hero, History/Stats buttons)
    new/+page.svelte         player names, target score, first-dealer picker
    game/+page.svelte        live hand entry (the actual scoring screen)
    game/done/+page.svelte   completed-game view + match-history carousel
    stats/+page.svelte       Kirsty-vs-Rusty stats dashboard
  lib/
    db.ts                    IDB schema + CRUD + bulk helpers
    scoring.ts               pure scoring functions, defaults, ranges
    history-format.ts        durable JSON bundle parse/build
    stats.ts                 aggregation pipelines for /stats
    stores/
      currentGame.ts         in-progress game (svelte/store writable)
      history.ts             full match list (svelte/store writable)
    components/
      BackButton.svelte      house-glyph circular back-to-home
      HandRow.svelte         one hand in the history list (swipe-to-delete)
      SwipeRow.svelte        reusable swipe-left-to-delete wrapper
      MatchView.svelte       display-only render of a single match
      HistoryButton.svelte   folder-circle trigger for HistoryModal
      HistoryModal.svelte    save/import/clear backup UI
      StatsButton.svelte     trigger for /stats
      Stepper.svelte         numeric stepper with hold-to-repeat
      WinnerPicker.svelte    in-hand winner selector
      CardFan.svelte         decorative card fan on main page
      charts/
        Doughnut.svelte      hand-rolled SVG doughnut
        BarChart.svelte      hand-rolled SVG bar chart (grouped/stacked/signed)
scripts/
  convert-ocr-history.mjs    one-shot OCR → durable seed bundle
  gen-icons.mjs              regenerate icons from icon-source.png
static/
  cards/                     deck card images (abs deck for backs)
  splash/                    in-app splash artwork (ace-of-spades)
  icons/                     generated PWA icons (gitignore exception)
  icon-source.png            source for icon generation (abs back @2x)
docs/                        deep-dives — see below
```

## docs/ deep-dives

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — IDB schema (v1→v3),
  stores, routing, page lifecycle.
- [`docs/HISTORY-FORMAT.md`](docs/HISTORY-FORMAT.md) — durable JSON
  bundle, stable UUIDs, OCR pipeline.
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — GitHub Pages workflow,
  base path, cache-busting, service worker.
- [`docs/IOS-PWA.md`](docs/IOS-PWA.md) — iOS PWA constraints and quirks.
- [`docs/SWIPE-PATTERN.md`](docs/SWIPE-PATTERN.md) — direction
  arbitration, pointer capture, edge dead zone.
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — non-obvious decisions and
  why they're the way they are.

## Convention quick-reference

- **Icons** are SF-Symbol-style hand-rolled SVGs (50%-alpha white
  circle + dark glyph): `BackButton` (house), `HistoryButton`
  (folder), `StatsButton` (chart bars), match-nav chevrons. Don't pull
  in an icon font.
- **Modals** use the shared `.modal-overlay` / `.modal` /
  `.btn-primary` / `.btn-secondary` chrome from `src/app.css`. Look at
  `HistoryModal.svelte` for the canonical example.
- **Top bars** on sub-pages: sticky, `top: calc(env(safe-area-inset-top) + 8px)`,
  flex space-between with BackButton on the left and an actions group
  on the right.
- **Safe-area insets** come from the shell padding in `+layout.svelte`.
  Don't duplicate the math in pages — let the shell own it.
- **Stable IDs.** `newGameId()` from `db.ts` uses `crypto.randomUUID()`.
  The OCR seed script uses a SHA-256-derived UUID over the game
  fingerprint so re-imports dedup naturally — see `docs/HISTORY-FORMAT.md`.

## Out of scope (don't reopen without a reason)

- Multi-user / multi-device sync. Use the gintown repo for that.
- A real backend. Persistence is IDB plus user-driven JSON backups.
- Dedup on re-import beyond "same UUID = skip". Adequate for now.
- Automatic periodic backup.
- Per-hand dealer override (we infer strictly alternating from
  `firstDealerIndex`).
- Multi-file picker for import. Single bundle is enough.

## When making changes

- Run `make check` before committing.
- For UI work, also bounce against the dev server in Chrome (and the
  phone if it's iOS-specific).
- Pages route is updated on push to `main`. Don't worry about
  versioning the static output.
- Tag a release (`git tag -a vX.Y.Z`) when shipping notable user-facing
  changes; push with `--tags`.

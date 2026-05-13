# Architecture

> Reading this file should answer: where does state live, how does data flow,
> what's the lifecycle of a hand / game / match, and what reactivity model
> is in play.

## Krusty scoring model (the rules in code)

- Two players, fixed indices `0` and `1`. Names are free text per game
  (defaults pre-fill from the `meta` store's `lastNames`).
- Each *hand* has exactly one **ginner** (the hand winner) and one
  **defender**. The ginner's `ginnerTotal` and the defender's
  `defenderTotal` get summed into per-player totals via `Hand.scores`.
- `defenderTotal` **can be negative** — Krusty's defining quirk vs.
  standard gin. Ranges are codified in `RANGES` in `src/lib/scoring.ts`.
- `defenderDeadwood` and `defenderLayoffs` are metadata for posterity
  (shown in the per-hand row, not summed). The player announces the
  total directly; we don't reconstruct from deadwood.
- The **dealer alternates strictly each hand** starting from
  `firstDealerIndex`. The only place this math lives is
  `dealerIndexFor()` in `src/lib/scoring.ts`. Don't reimplement it.
- First player to reach `targetScore` (default 300) wins. Tied totals
  on the winning hand resolve to player 0 (`winnerIfAny()` in
  `scoring.ts`).

## High level

There is no server. Every byte of state is either:

1. **IndexedDB** — durable, the source of truth for finished games and
   the in-progress game.
2. **localStorage** — one key, `gintown-pwa.currentGameId`, a pointer to
   the in-progress game's IDB id. Lets us re-hydrate on cold start without
   a full IDB scan.
3. **Memory (Svelte stores + `$state`)** — derived views of the above
   for the UI.

Anything outside that triple is ephemeral.

## IndexedDB schema (`src/lib/db.ts`)

```
DB:      gintown-pwa
Version: 3
Stores:
  games   keyPath: 'id'     index 'by-createdAt' on createdAt
  meta    out-of-line key, holds small KV records
```

### Game shape

```ts
interface Game {
  id: string;                // UUID — generated or hash-derived (OCR seed)
  createdAt: number;         // ms epoch
  endedAt: number | null;    // null while in progress
  players: [string, string]; // index 0, index 1
  targetScore: number;       // default 300
  hands: Hand[];
  winner: 0 | 1 | null;
  firstDealerIndex: 0 | 1;   // who dealt hand #1; rest alternates strictly
}

interface Hand {
  index: number;             // 1-based
  ginnerIndex: 0 | 1;        // hand winner
  ginnerTotal: number;       // announced total for the ginner
  defenderTotal: number;     // announced total for the defender (CAN BE NEGATIVE)
  defenderDeadwood: number;  // metadata, not summed
  defenderLayoffs: number;   // metadata, not summed
  scores: [number, number];  // canonical player-slot order, what gets summed
  createdAt: number;
}
```

`scores` is the projection used by `totalFor(hands, playerIndex)` — every
totals computation goes through it.

### Schema migration history

- **v1 → v2.** Renamed `ginnerMeldPoints` / `defenderMeldPoints` to
  `ginnerTotal` / `defenderTotal`. The old fields modeled meld-only
  scoring; the new model records the **announced total** (deadwood
  already subtracted by the player at the table). Backfill walks every
  row in the upgrade callback.
- **v2 → v3.** Added `Game.firstDealerIndex`. Backfill: every existing
  row got `firstDealerIndex = 0` (Kirsty, since she dealt first in
  Krusty's house rules, and that's the only data we had).

If the schema needs to change again: bump `DB_VERSION`, add a guarded
`oldVersion < N` block to the upgrade callback, and write the migration
in place. **Never** remove an existing migration block — IDB upgrades
chain through all of them when a user is N versions behind.

### Meta store

A tiny KV store for things that don't justify a separate object store:

- `lastNames` — `[string, string]` — pre-fills the New-game form.
- `lastTargetScore` — `number` — same.
- `lastFirstDealerIndex` — `0 | 1` — same.
- `persistRequestedAt` — `number` — set when we successfully asked the
  browser for persistent storage.

## Stores (`src/lib/stores/`)

Two `svelte/store` writables. Deliberately NOT `$state` — see the
footgun about Proxies-vs-IDB in `CLAUDE.md`.

### `currentGame` (`stores/currentGame.ts`)

Wraps the in-progress game and mirrors every mutation back to IDB. API:

- `hydrateFromStorage()` — read the `currentGameId` from localStorage,
  load the game from IDB, set the store. Called from page mount.
- `start(players, targetScore?, firstDealerIndex?)` — new game; writes
  to IDB, sets localStorage pointer.
- `recordHand(input)` — append a hand; recomputes `scores`, updates
  totals, sets `winner` + `endedAt` if the target's been hit, writes.
- `clear()` — drop the localStorage pointer (does **not** delete from IDB).

The game in this store is the live one. `/game/done` reads it for the
"no id query param" case (showing the just-finished or still-in-progress
game).

### `history` (`stores/history.ts`)

A list of every game in IDB, newest first. API:

- `refresh()` — re-read all games via `listGames()` and `set()`.

Called on mount of any page that displays history, and after import /
clear / delete.

## Routing

SvelteKit pages, all CSR (`prerender = true; ssr = false` in
`src/routes/+layout.ts`). The shell wraps everything in `.shell`.

```
/                      Main page: hero, history list, History/Stats triggers
/new                   New-game form: names, target, first dealer
/game                  Live scoring screen: per-hand input
/game/done             Completed game view (URL ?id=<gameId>) OR the in-progress
                       game if no id. Also hosts the match-history carousel.
/stats                 Stats dashboard (Kirsty-vs-Rusty aggregations)
```

`/stats` is explicitly listed in `svelte.config.js`'s prerender entries
because nothing links to it via a static `<a href>` — without that,
the prerender crawler skips it and GitHub Pages serves the SPA 404
fallback (which works but with an ugly status code).

## Page lifecycle highlights

### `/game/done`

The single most reactive page. Lives in `src/routes/game/done/+page.svelte`.

- Reads `?id=` from `$page.url.searchParams`. If null, falls back to
  the in-progress game via `currentGame.hydrateFromStorage()`.
- Renders a 3-panel carousel (prev / center / next) backed by the
  newest-first `history` store sorted into chronological order.
- A `$effect` loads the **center** game when the URL `id` changes,
  guarded by a `loadedForId` token so internal swipe-driven URL
  updates don't re-fetch what's already loaded.
- A second `$effect` reactively loads `prevPanel` and `nextPanel` when
  either `center` or the chronological list changes. Skips fetches
  for slots whose id already matches the loaded panel.
- See `docs/SWIPE-PATTERN.md` for the gesture mechanics.

### `/game`

Live hand entry. Each saved hand calls `currentGame.recordHand(input)`,
which writes to IDB. If the hand pushes a player to / past
`targetScore`, the store flips `winner` + `endedAt`, the user is bumped
to `/game/done`, and the in-progress pointer in localStorage is cleared.

### `/stats`

Reads from `history` (so always up-to-date after a refresh) and runs
the pipelines in `src/lib/stats.ts`. No persistence here; everything
is derived. Charts are hand-rolled SVG components in
`src/lib/components/charts/`.

## Reactivity model

- **Svelte 5 runes** in components: `$state`, `$derived`, `$effect`,
  `$props`.
- **Classic `svelte/store` writables** for cross-page state (`currentGame`,
  `history`). Subscribed via the `$store` auto-syntax in components.
- We deliberately mix the two because of the `$state`-Proxy / IDB
  structured-clone footgun (see `CLAUDE.md`). Cross-page persistent
  state goes through a `writable`; per-component view state goes in
  `$state`.

## Service worker

Registered in `+layout.svelte` via `useRegisterSW` from
`virtual:pwa-register/svelte`. Strategy: **manual update prompt**. When
a new SW finds new content, we show an "update available" toast
instead of auto-reloading, so an in-progress hand isn't yanked from
under the user.

Service worker file is generated by Workbox (`generateSW` strategy in
`vite.config.ts`).

## What does NOT live in this repo

- Anything multi-user, multi-device, server-rendered, or
  authentication-related. Use the gintown repo for those.
- The historical OCR JSONs themselves (under `history.nogit/` and
  gitignored). Lives only on the user's machine.

## File layout

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
```

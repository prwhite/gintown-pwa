# Decisions

> Non-obvious choices and why they're the way they are. Read this before
> revisiting one of them — most have history that doesn't survive in the
> code or commit log.

## 1. Standalone repo, not a directory inside `gintown`

The multi-user app and the offline scoring PWA share visual identity
and rules but **no code**. Keeping the PWA as its own repo keeps the
deploy (GitHub Pages from `main`) trivial, the dependencies decoupled
(no Svelte/Vite version pinning conflicts), and the iteration cycle
fast.

If we ever want to share code, the right move is to extract the
shared bits into a third repo, not to merge these two.

## 2. IndexedDB, not localStorage

- IDB has no 5MB cap. After ~50 OCR-imported games + ongoing play we'd
  bump the localStorage ceiling.
- IDB is less aggressively evicted under storage pressure (especially
  combined with `navigator.storage.persist()`).
- IDB supports indexed sort by `createdAt`, which we use for the
  main-page history list.
- The downsides (no `await` ergonomics natively, transaction model) are
  papered over by the `idb` library.

localStorage is still used for **one** thing: `gintown-pwa.currentGameId`,
the pointer to the in-progress game's IDB id. Sync access on cold start
means we can re-hydrate without a full IDB query.

## 3. Svelte 5 runes + classic `svelte/store` writables — mixed deliberately

We use both, not because of indecision, but because they have different
constraints:

- **`$state`** deep-proxies its contents. Proxies cannot be
  `structuredClone`'d, so they can't be handed to IDB. Useful for
  per-component view state; dangerous as a vehicle for anything that
  will be persisted.
- **`writable`** stores are not proxied. Used for cross-page persistent
  state (`currentGame`, `history`) — the things that get written to IDB.

This mix is the rule, not a transitional state. See `CLAUDE.md`
footgun #1.

## 4. Krusty announces totals, we don't reconstruct from deadwood

The earliest schema (v1) tried to model meld points + deadwood + layoffs
and derive the hand total. In practice, the player at the table
announces the total directly ("I had 95, you had 30"). v2 renamed the
fields to `ginnerTotal` / `defenderTotal` and kept deadwood / layoffs
only as posterity metadata — not summed.

This is intentional. Don't add "compute total from deadwood" logic;
it'd be wrong for the announced-total cases and add no value.

## 5. Dealer alternates strictly, no per-hand override

`firstDealerIndex` is stored on the game; every subsequent dealer is
computed by `dealerIndexFor(firstDealerIndex, handIndex)`. There's no
field on `Hand` to override the dealer for a specific hand.

Why: in Krusty house rules, dealer strictly alternates. The data we
have (live play + OCR'd scoresheets) is consistent with this. Adding
per-hand override would complicate every code path that reads the
dealer in exchange for a feature we don't need.

## 6. Offline OCR conversion, not in-app translation

The 52-ish OCR'd JSON scoresheets are not the durable format. They
could be translated at import time, but instead:

1. The user runs `scripts/convert-ocr-history.mjs` once.
2. It produces a single seed bundle in the durable format.
3. The PWA's importer only knows the durable format.

Why:

- The runtime path stays small — the importer is one strict-format
  parser, no per-source-shape branching.
- The OCR mapping rules (K=0, R=1, TIE resolution, dealer inference,
  date synthesis) live in one place that can be audited offline.
- Future source formats just need another offline converter; the PWA
  doesn't need to grow knowledge of them.

## 7. Stable UUIDs for OCR'd games, random UUIDs for live games

- Live games use `crypto.randomUUID()` (full random v4). Their ids
  never need to be reproducible.
- OCR-converted games use SHA-256(content fingerprint) → UUID. Same
  input → same id across runs, so re-importing the seed bundle is
  idempotent (the import path dedups by id).

A side-benefit: if the user edits an OCR JSON, the fingerprint changes,
producing a new id. The edited version imports alongside the old — the
user can swipe-delete the stale row. Acceptable since OCR edits are
rare.

## 8. Merge-only import, no `--replace` mode

Import always adds and never deletes. If the user wants to start
fresh, the Clear button in the History modal wipes everything; then
import.

Why: the user is the sole operator and an accidental "replace" with a
bad bundle is worse than a duplicate-row situation, which they can fix
by swipe-deleting.

## 9. No automated tests

The app is small, single-user, and visual. The cost of writing and
maintaining a test suite would exceed the catches. Verification is:

- `make check` (svelte-check) — types and a11y warnings.
- Manual smoke in the browser.
- Chrome DevTools MCP scripts when a particular flow needs proving.
- Phone testing for iOS-specific UX.

If the app grows in ways that erode confidence (more players, alternate
rule sets, sync, etc.), revisit this. For now: not worth it.

## 10. Manual update prompt for the service worker

`registerType: 'autoUpdate'` checks for updates, but we **do not**
auto-reload. The user has to tap an "update available" toast. Why: a
mid-hand reload is destructive UX; a delayed update isn't.

## 11. SF-Symbol-style hand-rolled SVG icons

Every icon (`BackButton` = house, `HistoryButton` = folder,
`StatsButton` = chart, prev/next chevrons) is a hand-authored SVG: 50%
white circle, dark glyph cut through. No icon font, no Lucide / Heroicons
dependency, no bundle cost. Visual consistency comes from a shared
viewBox/stroke convention.

If you add a new icon, follow the convention: `viewBox="0 0 24 24"`,
`<circle cx="12" cy="12" r="11" fill="rgba(255, 255, 255, 0.5)" />`,
glyph as a `<path>` with `stroke="var(--bg-dark)"` and stroke widths
~1.6–2.4.

## 12. Generated icons, not committed-by-hand

`make icons` produces every PWA icon from `static/icon-source.png`
(currently the `abs` deck card back at 2x). The script center-crops to
the largest square + writes the maskable variant with proper safe-zone
inset.

When the source art changes, run `make icons` and bump the `?v=` query
on the favicon links in `app.html` (iOS Safari caches favicons
aggressively).

## 13. No File System Access API path

Save/import uses `<a download>` + `<input type="file">`, which work
everywhere including iOS PWAs. `showSaveFilePicker` would be nicer on
Chrome desktop (a persistent handle, write-without-prompt) but Safari
doesn't ship it and dual-paths weren't worth it.

This also means we don't have a "this is my backup file, write to it
again" affordance. Every save is a fresh OS sheet. Acceptable.

## 14. Prerender `/` and `/stats`; nothing else

`/game`, `/game/done`, `/new` are CSR-only (they need IDB and the
in-progress game). `/` is a fine prerender target — it doesn't depend
on IDB for the initial paint. `/stats` would be a fine prerender too
**if** the crawler reached it; we list it explicitly in
`svelte.config.js`'s `prerender.entries`.

## 15. `static/_test-seed.json` is the committed test fixture

A history bundle (durable `gintown-history` format) used to exercise the
stats/import paths during local dev. Lives in `static/` so the dev server
serves it at `/_test-seed.json`. **It is committed** — it's central to
testing and needs to be present on any machine the project is cloned to.
(Earlier this was deliberately untracked; that was reversed once it became
the canonical test dataset rather than a throwaway.) Keep it in the
durable bundle shape; the in-app importer only accepts that format.

## 16. Intentionally out of scope

Things to **not reopen** without a specific reason:

- Multi-user / multi-device sync. Use the gintown repo.
- A real backend. Persistence is IDB + user-driven JSON backups.
- Dedup-on-import beyond "same UUID = skip" — fingerprinting beyond
  the OCR-stable-UUID scheme.
- Automatic periodic backup.
- Per-hand dealer override (we infer strictly alternating from
  `firstDealerIndex`).
- Multi-file picker for import. Single bundle is enough.
- Test suite (see #9).
- File System Access API path (see #13).

## 17. Visible version: tag only

No `version` field is exposed in the UI. The deployed bundle is
identified by the GitHub Actions run + the latest commit on `main`.
Tags (`v1.0.0`, `v1.1.0`, ...) mark milestones in git for our reference.
If we ever want an in-app "About" string, read it from `package.json`
at build time.

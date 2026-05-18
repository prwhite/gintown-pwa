# Claude Code Notes — gintown-pwa

Offline-first PWA for in-person Krusty Gin scoring. Single user, single device. Deployed to GitHub Pages at <https://prwhite.github.io/gintown-pwa/>. Independent of the multi-user [gintown](https://github.com/prwhite/gintown) repo (shares visual identity + rules, not code).

## Dev

- `make run-dev` — vite on `:5173`, host-bound so phones can hit it over LAN.
- `make build` — writes `./build`; what GitHub Pages serves.
- `make check` — svelte-check. Run before every commit.
- `make icons` / `make seed-history` — regenerate icons / OCR seed bundle.
- Push to `main` auto-deploys. Tag `vX.Y.Z` for milestones; `git push --tags`.
- **Bump `package.json` `version` on every committed change** — at least the maintenance (patch) number, always (it shows in the home-page top-left so you can tell if the PWA reloaded). Minor for small additive features, major for big changes.

## Footguns (memorize)

1. **Svelte 5 `$state` Proxies break IDB writes.** Never hand a `$state`-wrapped value to `db.put` / `bulkPutGames` etc. — `structuredClone` rejects Proxies with `The object can not be cloned`. Hold persistable values in a plain `let`, or call `$state.snapshot(value)` at write time. `svelte/store` writables are not deep-proxied and are fine.
2. **Svelte scoped CSS does not cross components.** A selector like `.parent > *` in a page's `<style>` does **not** match children rendered by an imported component (each component has its own scope hash). Use `:global(.foo)` or move the rule into the child's `<style>`.
3. **Never `setPointerCapture` on `pointerdown`.** Capturing kills the synthetic click that fires on a stationary tap, breaking tap-to-navigate inside swipe surfaces. Capture later in `pointermove`, only after horizontal direction is confirmed.
4. **Global gitignore `Icon?` matches `icon-*.png`.** Don't remove the `!static/icons/` exception in `.gitignore`, or generated PWA icons silently vanish from commits and prod 404s.

## Communication style

- Single-user app, no backend. Don't propose multi-user, sync, or server changes — those belong in the gintown repo.
- Deployment target is the iPhone-installed PWA. Desktop is dev ergonomics, not the product surface.
- Two players, hard-coded in the OCR script: Kirsty = index 0, Rusty = index 1.
- Terse responses preferred. Lead with the *why* of decisions; don't bury them in implementation detail.

## Read before deeper work

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — IDB schema/migrations, stores, routing, reactivity model, Krusty scoring model, file layout.
- [docs/HISTORY-FORMAT.md](docs/HISTORY-FORMAT.md) — durable JSON bundle, stable UUIDs, offline OCR pipeline, dedup-on-import.
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — GitHub Pages workflow, base-path discipline, SW behaviour, icon generation, prod-like local testing.
- [docs/IOS-PWA.md](docs/IOS-PWA.md) — safe-area insets, file pickers, no File System Access API, SW-https-only, swipe-back coexistence.
- [docs/SWIPE-PATTERN.md](docs/SWIPE-PATTERN.md) — the seven rules of the pointer arbitration shared by `SwipeRow` and the `/game/done` carousel.
- [docs/DECISIONS.md](docs/DECISIONS.md) — non-obvious choices and their rationale; also what's intentionally out of scope.

## Conventions (one-liners)

- **Icons** are hand-rolled SVG, `viewBox="0 0 24 24"`, 50%-alpha white circle + dark glyph. Don't pull in an icon font.
- **Modals** use the shared `.modal-overlay` / `.modal` / `.btn-primary` / `.btn-secondary` chrome from `src/app.css` — see `HistoryModal.svelte`.
- **Top bars** on sub-pages: sticky, `top: calc(env(safe-area-inset-top) + 8px)`, BackButton left + actions right.
- **Internal links** use `{base}` from `$app/paths` (`<a href="{base}/...">`). Never hard-code `/gintown-pwa`.
- **IDs**: `newGameId()` (random UUID v4) for live games; SHA-256-derived UUIDs for OCR'd games (see HISTORY-FORMAT).

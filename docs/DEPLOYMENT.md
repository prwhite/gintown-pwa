# Deployment

> Static site, GitHub Pages, fully automated on push to `main`. This doc
> covers the workflow, base path handling, icon generation, service-worker
> behaviour, and how to test against the production URL.

## Pipeline

`.github/workflows/pages.yml` runs on every push to `main`:

1. Checkout, set up Node 20, `npm ci`.
2. `npm run build` with `BASE_PATH=/gintown-pwa` exported into the
   environment. SvelteKit + vite-pwa pick that up and bake it into every
   generated path.
3. `actions/configure-pages@v5` + `actions/upload-pages-artifact@v3`
   (uploads `build/`).
4. `actions/deploy-pages@v4` publishes.

Permissions are minimal (`contents: read`, `pages: write`,
`id-token: write`), `concurrency: pages` with cancel-in-progress so an
older deploy doesn't clobber a newer one.

Live URL: <https://prwhite.github.io/gintown-pwa/>.

## Base path discipline

GitHub Pages serves the site under `/gintown-pwa/`. Everything generated
must be prefixed with that base. The mechanism:

- `BASE_PATH=/gintown-pwa` env var in the workflow.
- `svelte.config.js` reads `process.env.BASE_PATH` into `kit.paths.base`.
- `vite.config.ts` reads the same to set the vite-pwa plugin's `base`,
  `scope`, and the manifest's `start_url` / `scope`.
- In components, internal links use `$app/paths.base`:
  `<a href="{base}/game/done?id=...">`. Never hard-code `/gintown-pwa`.
- Local dev runs with `BASE_PATH` unset → `base = ''`, so everything
  works at the root.

If you see a 404 on a CSS / JS / icon file in production but it works
locally, it's almost always a missing `{base}` somewhere.

## Static adapter quirks

- `@sveltejs/adapter-static` with `fallback: '404.html'`. GitHub Pages
  serves `404.html` for any unknown path, and SvelteKit's runtime
  picks up the client route from there. That's what makes deep links
  like `/stats` work without server-side routing.
- `kit.prerender.entries = ['*', '/stats']` is set explicitly in
  `svelte.config.js`. Without `'/stats'`, the prerender crawler
  doesn't reach it (no static `<a>` links to it) and the route falls
  back to the 404 page in production — works, but with the wrong HTTP
  status.
- `strict: false` on the adapter — SvelteKit isn't fussy about
  unprerendered dynamic params.

## Service worker

Configured in `vite.config.ts` via `@vite-pwa/sveltekit`:

- `registerType: 'autoUpdate'` — workbox checks for updates on every
  page load.
- `strategies: 'generateSW'` — workbox writes the SW for us; we don't
  hand-author one. The `workbox.globPatterns` array decides what gets
  pre-cached: JS, CSS, HTML, SVG, PNG, WebP, woff2, ico.
- `manifest` block defines name, icons, start_url, scope. All
  base-path-aware.

**Update strategy is manual.** `+layout.svelte` calls
`useRegisterSW({ onNeedRefresh })`, which surfaces an "update available"
toast in the corner. The user taps it to reload. Rationale: an
in-progress hand isn't yanked by an unexpected reload.

`devOptions.enabled: false` — the SW does **not** run in dev. Test the
SW against `npm run build && npm run preview`, or against the deployed
site.

## Icon generation

Icons are generated, not hand-authored. Source: `static/icon-source.png`
(currently the `abs` deck card back at 2x). Run:

```sh
make icons       # or: npm run icons
```

`scripts/gen-icons.mjs` (uses `sharp`) emits three files into
`static/icons/`:

- `icon-192.png` (square-cropped back, no padding) — used by the
  manifest's standard 192 slot and by `<link rel="icon">`.
- `icon-512.png` (same, larger).
- `icon-maskable-512.png` — the back art inset into the 80% safe zone
  with a `#1a1a2e` plate so Android adaptive icons render correctly.

### Favicon cache-busting

iOS Safari aggressively caches favicons across PWA installs. After a
visual change to the icon, bump the `?v=` query string in
`src/app.html`:

```html
<link rel="icon" href="%sveltekit.assets%/icons/icon-192.png?v=3" />
<link rel="apple-touch-icon" href="%sveltekit.assets%/icons/icon-192.png?v=3" />
```

The query string is only there to defeat the cache; the file path is
unchanged.

### gitignore exception

The user's global gitignore matches `Icon?` (a macOS Finder thing).
Local `.gitignore` re-includes `static/icons/` and `static/icons/*.png`
specifically. Don't remove those exceptions or the generated icons
won't be committed and prod builds will 404 on them.

## Persistent storage

`+layout.svelte` calls `navigator.storage.persist()` on mount. If the
browser grants it, IDB won't be evicted under storage pressure. iOS
typically grants this for installed PWAs but not for in-Safari pages.
The console warning "persistent storage not granted; history may be
evicted under storage pressure" is expected when running in a regular
browser tab and is harmless.

## Testing against production-like builds

```sh
make build       # writes ./build
make preview     # serves ./build on :4173 (vite preview, --host enabled)
```

Note: `make preview` runs at base-path-`/`, not `/gintown-pwa/`, unless
you also set `BASE_PATH=/gintown-pwa` before the build. For a true
prod simulation:

```sh
BASE_PATH=/gintown-pwa npm run build
npx serve build -p 4173
# then visit http://localhost:4173/gintown-pwa/
```

## Phone-on-LAN testing

- **iOS Safari over plain HTTP to your LAN dev server works for most
  flows** (IDB, scoring, swipe, navigation), but the "Add to Home
  Screen" install path won't offer the PWA chrome — service worker is
  https-only outside of localhost. To test the installed-PWA experience,
  push and use the Pages deployment.
- vite dev binds to `0.0.0.0` (Makefile already runs `vite dev --host`).
- Find your machine's LAN IP: `ipconfig getifaddr en0`. Phone visits
  `http://<that-ip>:5173/`.

## Testing approach

There is no test suite. Verification is:

1. `make check` — `svelte-check` for types and a11y warnings.
2. Manual smoke in Chrome on `localhost:5173`.
3. Chrome DevTools MCP to drive flows when useful — it can `click`,
   `evaluate_script`, `navigate_page`, etc. Caveat: **synthetic
   `PointerEvent`s do not route to Svelte 5's delegated handlers**, so
   gesture flows (swipe-to-delete, the `/game/done` carousel) cannot
   be exercised this way. Use button-driven equivalents to test the
   underlying data flow; test the actual gesture by visiting on a
   phone.
4. Iterate on the user's iPhone for any iOS-specific UI work
   (safe-area, A2HS, standalone-mode behaviour).

## Releasing

- Tag when shipping notable user-facing changes:
  ```sh
  git tag -a vX.Y.Z -m "<short summary>"
  git push --tags
  ```
- No changelog file. Tag message is the record.
- No release artifacts beyond the live site — there's nothing to ship
  outside of the deployed Pages bundle.

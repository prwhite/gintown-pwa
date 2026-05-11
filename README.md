# gintown-pwa — Krusty Gin scoring PWA

An offline-first PWA for keeping score during in-person Krusty Gin games. Built independently of the multiplayer [gintown](https://github.com/prwhite/gintown) app, but lifts its visual identity and the Krusty scoring rules.

## Develop

```sh
make install     # one-time
make run-dev     # vite dev server on :5173
make build       # produces ./build for GitHub Pages
```

## Deploy

Pushes to `main` deploy automatically via `.github/workflows/pages.yml`. Live at https://prwhite.github.io/gintown-pwa/.

# gintown-pwa Makefile

.PHONY: help install run-dev build preview check clean icons seed-history

help:
	@echo "gintown-pwa - Available targets:"
	@echo ""
	@echo "  Development:"
	@echo "    make install        Install npm dependencies"
	@echo "    make run-dev        Start vite dev server (host 0.0.0.0, port 5173)"
	@echo "    make build          Build static site for production (./build)"
	@echo "    make preview        Preview the built site locally"
	@echo "    make check          Run svelte-check (type/lint)"
	@echo "    make clean          Remove build artifacts"
	@echo ""
	@echo "  Asset / data tools (run as needed, not in the regular dev cycle):"
	@echo "    make icons          Regenerate PWA icons from static/icon-source.png"
	@echo "    make seed-history   Convert OCR JSONs in history.nogit/ into the"
	@echo "                          single durable seed bundle the PWA can import."
	@echo ""

install:
	npm install

run-dev:
	npm run dev

build:
	npm run build

preview:
	npm run preview

check:
	npm run check

clean:
	rm -rf build .svelte-kit dev-dist node_modules/.vite

icons:
	npm run icons

seed-history:
	node scripts/convert-ocr-history.mjs

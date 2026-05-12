#!/usr/bin/env node
/**
 * Convert the historical OCR scoresheet JSONs in `history.nogit/` into a
 * single bundle file in the PWA's durable format. Run once to seed the
 * PWA's IDB on a fresh install.
 *
 *   node scripts/convert-ocr-history.mjs
 *
 * Reads:  gintown-pwa/history.nogit/*.json (one game per file, OCR shape)
 * Writes: gintown-pwa/history.nogit/gintown-history-seed.json
 *
 * Player mapping is hard-coded: K → Kirsty (index 0), R → Rusty (index 1).
 *
 * Dates are synthesized: games are spread by `game_id` in 1-hour increments
 * ending one day before this script runs, preserving order but placing
 * everything clearly in the past.
 */

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const HISTORY_DIR = resolve(here, '..', 'history.nogit');
const OUT_FILE = join(HISTORY_DIR, 'gintown-history-seed.json');

const PLAYERS = ['Kirsty', 'Rusty']; // K=0, R=1
const TARGET_SCORE = 300;

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function newGameId() {
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 8);
  return `seed-${t}-${r}`;
}

function inferFirstDealer(hands) {
  // Dealer alternates strictly. Find the first hand with a known dealer
  // and reverse-alternate from its index to determine hand-1's dealer.
  const seed = hands.find((h) => h.dealer === 'K' || h.dealer === 'R');
  if (!seed) return 0;
  const dealerIdx = seed.dealer === 'K' ? 0 : 1;
  const n = seed.hand_number;
  return (((dealerIdx - n + 1) % 2) + 2) % 2;
}

function convert(src, fileLabel, gameCreatedAt, warnings) {
  if (!Array.isArray(src.hands) || src.hands.length === 0) {
    warnings.push(`${fileLabel}: empty/missing hands — skipped`);
    return null;
  }

  const firstDealerIndex = inferFirstDealer(src.hands);
  if (!src.hands.some((h) => h.dealer === 'K' || h.dealer === 'R')) {
    warnings.push(
      `${fileLabel}: no dealer info in source; defaulting to Kirsty deals first`
    );
  }

  const hands = src.hands.map((h, i) => {
    let ginnerIndex;
    if (h.hand_winner === 'K') ginnerIndex = 0;
    else if (h.hand_winner === 'R') ginnerIndex = 1;
    else if (h.hand_winner === 'TIE') {
      ginnerIndex = h.k_score === h.r_score ? 0 : h.k_score > h.r_score ? 0 : 1;
      warnings.push(
        `${fileLabel}: hand ${h.hand_number} is TIE — resolved to ${PLAYERS[ginnerIndex]} by score`
      );
    } else {
      // Fallback: whoever scored more wins the hand
      ginnerIndex = h.k_score >= h.r_score ? 0 : 1;
      warnings.push(
        `${fileLabel}: hand ${h.hand_number} has unknown hand_winner=${JSON.stringify(h.hand_winner)} — inferred ${PLAYERS[ginnerIndex]} by score`
      );
    }
    const ginnerTotal = ginnerIndex === 0 ? h.k_score : h.r_score;
    const defenderTotal = ginnerIndex === 0 ? h.r_score : h.k_score;
    return {
      index: h.hand_number,
      ginnerIndex,
      ginnerTotal,
      defenderTotal,
      defenderDeadwood: 0,
      defenderLayoffs: 0,
      scores: [h.k_score, h.r_score],
      createdAt: gameCreatedAt + i * 30_000
    };
  });

  let winner = null;
  if (src.winner === 'K') winner = 0;
  else if (src.winner === 'R') winner = 1;

  return {
    id: newGameId(),
    createdAt: gameCreatedAt,
    endedAt: winner !== null ? gameCreatedAt + hands.length * 60_000 : null,
    players: [...PLAYERS],
    targetScore: TARGET_SCORE,
    hands,
    winner,
    firstDealerIndex
  };
}

// --- read source files ----------------------------------------------------
const allFiles = readdirSync(HISTORY_DIR)
  .filter((f) => f.endsWith('.json') && f !== 'gintown-history-seed.json')
  .sort();

const parsed = [];
const warnings = [];

for (const file of allFiles) {
  const path = join(HISTORY_DIR, file);
  let json;
  try {
    json = JSON.parse(readFileSync(path, 'utf-8'));
  } catch (e) {
    warnings.push(`${file}: JSON parse failed (${e.message}) — skipped`);
    continue;
  }
  parsed.push({ file, src: json, gameId: typeof json.game_id === 'number' ? json.game_id : null });
}

// Sort by game_id ascending (older first); fall back to filename order
parsed.sort((a, b) => {
  if (a.gameId !== null && b.gameId !== null) return a.gameId - b.gameId;
  return a.file.localeCompare(b.file);
});

// --- synthesize timestamps ------------------------------------------------
const now = Date.now();
const total = parsed.length;
const games = [];

parsed.forEach(({ file, src }, i) => {
  // game at index i (0-based) sits at: (now - DAY) - (total - 1 - i) * HOUR
  const createdAt = now - DAY - (total - 1 - i) * HOUR;
  const game = convert(src, file, createdAt, warnings);
  if (game) games.push(game);
});

// --- write bundle ---------------------------------------------------------
const bundle = {
  format: 'gintown-history',
  version: 1,
  exportedAt: new Date().toISOString(),
  games
};

writeFileSync(OUT_FILE, JSON.stringify(bundle, null, 2));

const totalHands = games.reduce((s, g) => s + g.hands.length, 0);
console.log(`Wrote ${games.length} games (${totalHands} hands) → ${OUT_FILE}`);
if (warnings.length) {
  console.log(`\n${warnings.length} warning${warnings.length === 1 ? '' : 's'}:`);
  for (const w of warnings) console.log(`  - ${w}`);
} else {
  console.log('No warnings.');
}

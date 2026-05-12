/**
 * Pure-function load/save helpers for the JSON history bundle the
 * `convert-ocr-history.mjs` script produces and the Save backup action
 * generates. Single canonical shape:
 *
 *   { format: "gintown-history", version: 1, exportedAt, games: Game[] }
 *
 * Each game is the IDB `Game` shape verbatim, so a round-trip
 * (import → IDB → export) is identity.
 */

import type { Game, Hand } from './db';

export const FORMAT_ID = 'gintown-history';
export const FORMAT_VERSION = 1;

export interface HistoryBundle {
  format: typeof FORMAT_ID;
  version: number;
  exportedAt: string;
  games: Game[];
}

export interface ParseResult {
  bundle: HistoryBundle | null;
  error: string | null;
}

/**
 * Try to parse a raw JSON string as a history bundle. Returns either a
 * validated bundle or a human-readable error suitable for surfacing in the
 * modal. Performs only structural validation — fields we don't recognize
 * are passed through untouched so future format extensions don't break old
 * builds.
 */
export function parseHistoryBundle(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return { bundle: null, error: `Not valid JSON: ${(e as Error).message}` };
  }
  if (typeof raw !== 'object' || raw === null) {
    return { bundle: null, error: 'Top-level value is not an object.' };
  }
  const obj = raw as Record<string, unknown>;
  if (obj.format !== FORMAT_ID) {
    return {
      bundle: null,
      error: `Wrong format. Expected "${FORMAT_ID}", got ${JSON.stringify(obj.format)}.`
    };
  }
  if (!Array.isArray(obj.games)) {
    return { bundle: null, error: 'Missing or invalid `games` array.' };
  }
  // Light per-game validation — anything that doesn't look like a Game is
  // dropped with no fatal error, since one busted entry shouldn't sink the
  // whole import.
  const games: Game[] = [];
  for (const g of obj.games) {
    if (looksLikeGame(g)) games.push(g as Game);
  }

  return {
    bundle: {
      format: FORMAT_ID,
      version: typeof obj.version === 'number' ? obj.version : FORMAT_VERSION,
      exportedAt: typeof obj.exportedAt === 'string' ? obj.exportedAt : new Date().toISOString(),
      games
    },
    error: null
  };
}

function looksLikeGame(g: unknown): g is Game {
  if (typeof g !== 'object' || g === null) return false;
  const x = g as Record<string, unknown>;
  return (
    typeof x.id === 'string' &&
    typeof x.createdAt === 'number' &&
    Array.isArray(x.players) &&
    x.players.length === 2 &&
    typeof x.targetScore === 'number' &&
    Array.isArray(x.hands) &&
    (x.winner === null || x.winner === 0 || x.winner === 1) &&
    (x.firstDealerIndex === 0 || x.firstDealerIndex === 1)
  );
}

/**
 * Sum of hands across all games — used for status reporting.
 */
export function countHands(games: readonly Game[]): number {
  return games.reduce((s, g) => s + g.hands.length, 0);
}

/**
 * Pretty-printed bundle string for the Save backup action.
 */
export function buildExportBundle(games: readonly Game[]): string {
  const bundle: HistoryBundle = {
    format: FORMAT_ID,
    version: FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    games: games as Game[]
  };
  return JSON.stringify(bundle, null, 2);
}

/**
 * Default filename for a save: `gintown-YYYYMMDD-HHMM.json`, local time.
 */
export function defaultBackupFilename(now: Date = new Date()): string {
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  const yyyy = now.getFullYear();
  const mm = pad(now.getMonth() + 1);
  const dd = pad(now.getDate());
  const hh = pad(now.getHours());
  const mi = pad(now.getMinutes());
  return `gintown-${yyyy}${mm}${dd}-${hh}${mi}.json`;
}

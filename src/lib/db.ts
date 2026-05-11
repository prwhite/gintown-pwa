/**
 * IndexedDB layer for game history + small metadata (last-used names, etc.).
 *
 * Why IDB over localStorage:
 *  - Survives PWA updates the same way (origin-scoped) but with no 5MB cap.
 *  - Less aggressively evicted by browsers under storage pressure.
 *  - Structured queries (sort by createdAt index).
 *
 * Schema versions:
 *  v1: initial (had ginnerMeldPoints / defenderMeldPoints fields)
 *  v2: rename fields to ginnerTotal / defenderTotal to match the simpler
 *      "players announce their total" input model. Migration preserves data.
 */

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

export interface Hand {
  index: number; // 1-based within a game
  ginnerIndex: 0 | 1;
  ginnerTotal: number;       // announced score, replaces v1 ginnerMeldPoints
  defenderTotal: number;     // announced score, replaces v1 defenderMeldPoints
  defenderDeadwood: number;  // metadata only (not summed into score)
  defenderLayoffs: number;   // metadata only (not summed into score)
  scores: [number, number];  // delta per player (stored for fidelity)
  createdAt: number;
}

export interface Game {
  id: string;
  createdAt: number;
  endedAt: number | null;
  players: [string, string];
  targetScore: number;
  hands: Hand[];
  winner: 0 | 1 | null;
}

export interface MetaRecord {
  lastNames?: [string, string];
  lastTargetScore?: number;
  persistRequestedAt?: number;
}

interface KrustyDB extends DBSchema {
  games: {
    key: string;
    value: Game;
    indexes: { 'by-createdAt': number };
  };
  meta: {
    key: string;
    value: unknown;
  };
}

const DB_NAME = 'gintown-pwa';
const DB_VERSION = 2;

let dbPromise: Promise<IDBPDatabase<KrustyDB>> | null = null;

function getDB(): Promise<IDBPDatabase<KrustyDB>> {
  if (!dbPromise) {
    dbPromise = openDB<KrustyDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, _newVersion, tx) {
        if (oldVersion < 1) {
          const games = db.createObjectStore('games', { keyPath: 'id' });
          games.createIndex('by-createdAt', 'createdAt');
          db.createObjectStore('meta');
        }
        if (oldVersion < 2) {
          // Migrate v1 → v2: rename ginnerMeldPoints/defenderMeldPoints to ginnerTotal/defenderTotal.
          // Under v1 logic, ginnerMeldPoints WAS the ginner's score, so it maps 1:1.
          // The defender's previous score is preserved via the existing `scores` array.
          const store = tx.objectStore('games');
          store.openCursor().then(async function step(cursor): Promise<void> {
            if (!cursor) return;
            type LegacyHand = Hand & { ginnerMeldPoints?: number; defenderMeldPoints?: number };
            const game = cursor.value as Game & { hands: LegacyHand[] };
            game.hands = game.hands.map((h: LegacyHand) => {
              const ginnerTotal = h.ginnerTotal ?? h.ginnerMeldPoints ?? 0;
              const defenderIdx = h.ginnerIndex === 0 ? 1 : 0;
              const defenderTotal = h.defenderTotal ?? h.scores?.[defenderIdx] ?? 0;
              const next: Hand = {
                index: h.index,
                ginnerIndex: h.ginnerIndex,
                ginnerTotal,
                defenderTotal,
                defenderDeadwood: h.defenderDeadwood ?? 0,
                defenderLayoffs: h.defenderLayoffs ?? 0,
                scores: h.scores,
                createdAt: h.createdAt
              };
              return next;
            });
            await cursor.update(game);
            return step(await cursor.continue());
          });
        }
      }
    });
  }
  return dbPromise;
}

export async function listGames(): Promise<Game[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex('games', 'by-createdAt');
  return all.reverse();
}

export async function getGame(id: string): Promise<Game | undefined> {
  const db = await getDB();
  return db.get('games', id);
}

export async function putGame(g: Game): Promise<void> {
  const db = await getDB();
  await db.put('games', g);
}

export async function deleteGame(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('games', id);
}

export async function getMeta<K extends keyof MetaRecord>(
  key: K
): Promise<MetaRecord[K] | undefined> {
  const db = await getDB();
  return db.get('meta', key) as Promise<MetaRecord[K] | undefined>;
}

export async function setMeta<K extends keyof MetaRecord>(
  key: K,
  value: MetaRecord[K]
): Promise<void> {
  const db = await getDB();
  await db.put('meta', value, key);
}

export function newGameId(): string {
  const rnd = Math.random().toString(36).slice(2, 10);
  return `${Date.now().toString(36)}-${rnd}`;
}

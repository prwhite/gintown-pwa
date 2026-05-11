/**
 * IndexedDB layer for game history + small metadata (last-used names, etc.).
 *
 * Why IDB over localStorage:
 *  - Survives PWA updates the same way (origin-scoped) but with no 5MB cap.
 *  - Less aggressively evicted by browsers under storage pressure.
 *  - Structured queries (sort by createdAt index).
 *
 * Schema version bumps go through `onupgradeneeded` in a migration chain — same
 * shape as the Off-Tonal v1→v2→v3 pattern so future schema changes don't wipe.
 */

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

export interface Hand {
  index: number; // 1-based within a game
  ginnerIndex: 0 | 1;
  ginnerMeldPoints: number;
  defenderMeldPoints: number;
  defenderDeadwood: number;
  defenderLayoffs: number;
  scores: [number, number]; // computed delta per player (stored for fidelity)
  createdAt: number; // ms epoch
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
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<KrustyDB>> | null = null;

function getDB(): Promise<IDBPDatabase<KrustyDB>> {
  if (!dbPromise) {
    dbPromise = openDB<KrustyDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        // Migration chain — each `if` is a one-way step from a prior version.
        if (oldVersion < 1) {
          const games = db.createObjectStore('games', { keyPath: 'id' });
          games.createIndex('by-createdAt', 'createdAt');
          db.createObjectStore('meta');
        }
      }
    });
  }
  return dbPromise;
}

export async function listGames(): Promise<Game[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex('games', 'by-createdAt');
  return all.reverse(); // newest first
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

/** Tiny uuid: enough entropy for local history, no need for crypto-uuid. */
export function newGameId(): string {
  const rnd = Math.random().toString(36).slice(2, 10);
  return `${Date.now().toString(36)}-${rnd}`;
}

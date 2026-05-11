/**
 * Reactive store wrapping the in-progress game. Mirrors to IndexedDB on every
 * mutation so a crash/refresh mid-game doesn't lose hands.
 */

import { writable, get } from 'svelte/store';
import {
  getGame,
  newGameId,
  putGame,
  setMeta,
  type Game,
  type Hand
} from '$lib/db';
import { DEFAULT_TARGET_SCORE, scoreHand, totalFor, winnerIfAny, type HandInput } from '$lib/scoring';

const KEY = 'gintown-pwa.currentGameId';

interface CurrentGameState {
  game: Game | null;
  loading: boolean;
}

function createStore() {
  const { subscribe, set, update } = writable<CurrentGameState>({ game: null, loading: false });

  async function hydrateFromStorage() {
    if (typeof localStorage === 'undefined') return;
    const id = localStorage.getItem(KEY);
    if (!id) return;
    update((s) => ({ ...s, loading: true }));
    const game = await getGame(id);
    set({ game: game ?? null, loading: false });
  }

  async function start(players: [string, string], targetScore: number = DEFAULT_TARGET_SCORE) {
    const game: Game = {
      id: newGameId(),
      createdAt: Date.now(),
      endedAt: null,
      players,
      targetScore,
      hands: [],
      winner: null
    };
    await putGame(game);
    await setMeta('lastNames', players);
    await setMeta('lastTargetScore', targetScore);
    if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, game.id);
    set({ game, loading: false });
    return game;
  }

  async function addHand(input: HandInput) {
    const state = get({ subscribe });
    if (!state.game) throw new Error('no current game');
    const scores = scoreHand(input);
    const hand: Hand = {
      index: state.game.hands.length + 1,
      ginnerIndex: input.ginnerIndex,
      ginnerMeldPoints: input.ginnerMeldPoints,
      defenderMeldPoints: input.defenderMeldPoints,
      defenderDeadwood: input.defenderDeadwood,
      defenderLayoffs: input.defenderLayoffs,
      scores,
      createdAt: Date.now()
    };
    const next: Game = { ...state.game, hands: [...state.game.hands, hand] };

    const totals: [number, number] = [totalFor(next.hands, 0), totalFor(next.hands, 1)];
    const w = winnerIfAny(totals, next.targetScore);
    if (w !== null) {
      next.winner = w;
      next.endedAt = Date.now();
    }
    await putGame(next);
    update((s) => ({ ...s, game: next }));
    return { hand, totals, winner: w };
  }

  async function removeHand(index: number) {
    const state = get({ subscribe });
    if (!state.game) return;
    const filtered = state.game.hands.filter((h) => h.index !== index);
    // Re-index sequentially so display stays clean.
    const renumbered = filtered.map((h, i) => ({ ...h, index: i + 1 }));
    const totals: [number, number] = [totalFor(renumbered, 0), totalFor(renumbered, 1)];
    const w = winnerIfAny(totals, state.game.targetScore);
    const next: Game = {
      ...state.game,
      hands: renumbered,
      winner: w,
      endedAt: w !== null ? state.game.endedAt : null
    };
    await putGame(next);
    update((s) => ({ ...s, game: next }));
  }

  async function clear() {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(KEY);
    set({ game: null, loading: false });
  }

  return {
    subscribe,
    hydrateFromStorage,
    start,
    addHand,
    removeHand,
    clear
  };
}

export const currentGame = createStore();

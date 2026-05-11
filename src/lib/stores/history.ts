import { writable } from 'svelte/store';
import { listGames, type Game } from '$lib/db';

function createHistoryStore() {
  const { subscribe, set } = writable<Game[]>([]);

  async function refresh() {
    const all = await listGames();
    set(all);
  }

  return {
    subscribe,
    refresh
  };
}

export const history = createHistoryStore();

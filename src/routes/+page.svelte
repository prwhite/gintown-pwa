<script lang="ts">
  import { base } from '$app/paths';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { history } from '$lib/stores/history';
  import { deleteGame, type Game } from '$lib/db';
  import SwipeRow from '$lib/components/SwipeRow.svelte';
  import CardFan from '$lib/components/CardFan.svelte';
  import StatsButton from '$lib/components/StatsButton.svelte';
  import { canonicalizePair } from '$lib/stats';

  onMount(() => history.refresh());

  function formatDate(ms: number): string {
    const d = new Date(ms);
    const today = new Date();
    const sameYear = d.getFullYear() === today.getFullYear();
    const opts: Intl.DateTimeFormatOptions = sameYear
      ? { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }
      : { year: 'numeric', month: 'short', day: 'numeric' };
    return d.toLocaleString(undefined, opts);
  }

  function totals(g: Game): [number, number] {
    return g.hands.reduce<[number, number]>(
      (acc, h) => [acc[0] + h.scores[0], acc[1] + h.scores[1]],
      [0, 0]
    );
  }

  function winnerLabel(g: Game): string {
    if (g.winner === null) return 'In progress';
    return `${g.players[g.winner]} wins`;
  }

  async function onDelete(id: string) {
    await deleteGame(id);
    await history.refresh();
  }

  function gameHref(g: Game): string {
    return g.winner === null ? `${base}/game` : `${base}/game/done?id=${g.id}`;
  }

  function onGameClick(g: Game) {
    if (g.winner === null) {
      localStorage.setItem('gintown-pwa.currentGameId', g.id);
    }
  }

  function openStats(e: MouseEvent, g: Game) {
    e.preventDefault();
    e.stopPropagation();
    const [p1, p2] = canonicalizePair(g.players[0], g.players[1]);
    goto(`${base}/stats?p1=${encodeURIComponent(p1)}&p2=${encodeURIComponent(p2)}`);
  }
</script>

<header class="hero">
  <CardFan />
  <h1>Krusty Score</h1>
  <p class="subtitle">Offline scoring for in-person Krusty Gin.</p>
</header>

<section class="cta">
  <a class="btn-primary big" href="{base}/new">New game</a>
</section>

<section class="history">
  <h2>History</h2>
  {#if $history.length === 0}
    <p class="empty">No games yet — start one.</p>
  {:else}
    <ul class="games">
      {#each $history as g (g.id)}
        {@const t = totals(g)}
        <li class="game-slot">
          <SwipeRow onDelete={() => onDelete(g.id)}>
            <a
              class="game"
              href={gameHref(g)}
              onclick={() => onGameClick(g)}
              data-sveltekit-preload-data="off"
              draggable="false"
              ondragstart={(e) => e.preventDefault()}
            >
              <div class="meta">
                <span class="date">{formatDate(g.createdAt)}</span>
                <span class="status" class:done={g.winner !== null}>{winnerLabel(g)}</span>
              </div>
              <div class="players">
                <div class="player" class:winner={g.winner === 0}>
                  <span class="name">{g.players[0] || 'P1'}</span>
                  <span class="score">{t[0]}</span>
                </div>
                <div class="player" class:winner={g.winner === 1}>
                  <span class="name">{g.players[1] || 'P2'}</span>
                  <span class="score">{t[1]}</span>
                </div>
              </div>
              <div class="target">to {g.targetScore} · {g.hands.length} hand{g.hands.length === 1 ? '' : 's'}</div>
            </a>
            <div class="stats-corner">
              <StatsButton onclick={(e) => openStats(e, g)} label="View stats for {g.players[0]} vs {g.players[1]}" />
            </div>
          </SwipeRow>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  .hero {
    text-align: center;
    padding: 16px 0 8px;
  }

  h1 {
    font-size: 32px;
    background: linear-gradient(135deg, var(--accent), var(--accent-hover));
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    margin-bottom: 6px;
    letter-spacing: 0.5px;
  }

  .subtitle {
    color: var(--text-muted);
    font-size: 13px;
  }

  .cta {
    margin: 24px 0;
    display: flex;
    justify-content: center;
  }

  .big {
    padding: 16px 32px;
    font-size: 16px;
    border-radius: 12px;
    text-decoration: none;
    display: inline-block;
  }

  .history {
    margin-top: 16px;
  }

  .history h2 {
    font-size: 14px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 12px;
  }

  .empty {
    color: var(--text-muted);
    font-size: 14px;
    text-align: center;
    padding: 32px 0;
  }

  .games {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .game-slot {
    position: relative;
  }

  .game {
    display: block;
    padding: 14px 16px;
    text-decoration: none;
    color: var(--text);
    -webkit-touch-callout: none;
  }

  .meta {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 8px;
  }

  .status.done {
    color: var(--warning);
  }

  .players {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .player {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .player .name {
    font-size: 12px;
    color: var(--text-muted);
  }

  .player .score {
    font-family: ui-monospace, 'SF Mono', Menlo, monospace;
    font-size: 22px;
    font-weight: 700;
  }

  .player.winner .name {
    color: var(--warning);
  }

  .player.winner .score {
    color: var(--warning);
  }

  .target {
    margin-top: 8px;
    font-size: 11px;
    color: var(--text-muted);
    text-align: center;
  }

  /* Stats button is absolutely positioned over the card's bottom-right. It's
     inside the swipe surface (so it moves during swipe-to-delete) but its
     click stops propagation so the card's main navigation isn't triggered. */
  .stats-corner {
    position: absolute;
    right: 10px;
    bottom: 10px;
    z-index: 2;
  }
</style>

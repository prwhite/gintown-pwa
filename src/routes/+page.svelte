<script lang="ts">
  import { base } from '$app/paths';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { history } from '$lib/stores/history';
  import { deleteGame, type Game } from '$lib/db';
  import SwipeRow from '$lib/components/SwipeRow.svelte';
  import CardFan from '$lib/components/CardFan.svelte';
  import StatsButton from '$lib/components/StatsButton.svelte';
  import HistoryButton from '$lib/components/HistoryButton.svelte';
  import HistoryModal from '$lib/components/HistoryModal.svelte';
  import { canonicalizePair, currentWinStreak } from '$lib/stats';

  let showHistoryModal = $state(false);

  onMount(() => history.refresh());

  const MAX_GAMES = 100;

  function monthLabel(ms: number): string {
    return new Date(ms).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }

  /** Group an already-sorted (newest-first) games list by calendar month. */
  function groupByMonth(games: Game[]): Array<{ label: string; games: Game[] }> {
    const groups: Array<{ label: string; games: Game[] }> = [];
    let current: string | null = null;
    for (const g of games) {
      const label = monthLabel(g.createdAt);
      if (label !== current) {
        current = label;
        groups.push({ label, games: [] });
      }
      groups[groups.length - 1].games.push(g);
    }
    return groups;
  }

  let streak = $derived(currentWinStreak($history));
  let displayedGames = $derived($history.slice(0, MAX_GAMES));
  let groupedGames = $derived(groupByMonth(displayedGames));
  let isTruncated = $derived($history.length > MAX_GAMES);

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

<div class="top-bar">
  <span class="version">v{__APP_VERSION__}</span>
  <HistoryButton onclick={() => (showHistoryModal = true)} />
</div>

<header class="hero">
  <CardFan />
  <h1>Krusty Score</h1>
  <p class="subtitle">Offline scoring for in-person Krusty Gin.</p>
</header>

{#if showHistoryModal}
  <HistoryModal onClose={() => (showHistoryModal = false)} />
{/if}

<section class="cta">
  <a class="btn-primary big" href="{base}/new">New game</a>
</section>

<section class="history">
  <h2>History</h2>
  {#if $history.length === 0}
    <p class="empty">No games yet — start one.</p>
  {:else}
    {#if streak}
      <p class="streak"><em>{streak.name} has won {streak.count} in a row</em></p>
    {/if}
    {#each groupedGames as group (group.label)}
      <div class="month-group">
        <h3 class="month-header">{group.label}</h3>
        <ul class="games">
          {#each group.games as g (g.id)}
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
      </div>
    {/each}
    {#if isTruncated}
      <p class="truncated">Showing {MAX_GAMES} most-recent · {$history.length - MAX_GAMES} older game{$history.length - MAX_GAMES === 1 ? '' : 's'} hidden</p>
    {/if}
  {/if}
</section>

<style>
  /* Top-bar holds the right-aligned HistoryButton above the hero. Normal
     flow (not floating); the button itself is small. */
  .top-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: -4px;
  }

  .version {
    font-size: 10px;
    color: var(--text-muted);
    letter-spacing: 0.5px;
  }

  .hero {
    text-align: center;
    padding: 8px 0 8px;
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

  .streak {
    font-size: 14px;
    font-style: italic;
    color: var(--text-muted);
    text-align: center;
    margin-bottom: 14px;
  }

  .month-group {
    margin-bottom: 20px;
  }

  .month-header {
    font-size: 11px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.8px;
    margin: 4px 4px 8px;
    font-weight: 600;
  }

  .games {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .truncated {
    text-align: center;
    color: var(--text-muted);
    font-size: 11px;
    font-style: italic;
    margin-top: 16px;
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
    right: 16px;
    bottom: 12px;
    z-index: 2;
  }
</style>

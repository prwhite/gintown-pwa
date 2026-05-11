<script lang="ts">
  import { base } from '$app/paths';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import HandRow from '$lib/components/HandRow.svelte';
  import { currentGame } from '$lib/stores/currentGame';
  import { deleteGame, getGame, type Game } from '$lib/db';
  import { history } from '$lib/stores/history';
  import { totalFor } from '$lib/scoring';

  let id = $derived($page.url.searchParams.get('id'));
  let game = $state<Game | null>(null);
  let loading = $state(true);

  // True when this page is showing the just-finished current game, not a past one.
  let isCurrent = $derived(!id);

  onMount(async () => {
    const queryId = $page.url.searchParams.get('id');
    if (queryId) {
      game = (await getGame(queryId)) ?? null;
    } else {
      await currentGame.hydrateFromStorage();
      game = $currentGame.game;
    }
    loading = false;
  });

  let totals = $derived<[number, number]>(
    game ? [totalFor(game.hands, 0), totalFor(game.hands, 1)] : [0, 0]
  );

  async function backToMain() {
    if (isCurrent) await currentGame.clear();
    goto(`${base}/`);
  }

  async function rematch() {
    if (!game) return;
    await currentGame.clear();
    await currentGame.start(game.players, game.targetScore);
    goto(`${base}/game`);
  }

  let confirmingDelete = $state(false);

  async function doDelete() {
    if (!game) return;
    await deleteGame(game.id);
    if (isCurrent) await currentGame.clear();
    await history.refresh();
    goto(`${base}/`);
  }
</script>

{#if loading}
  <p class="loading">Loading…</p>
{:else if game}
  <header class="hero" class:in-progress={game.winner === null}>
    <img src="{base}/splash/ace-spades.png" alt="" class="splash" />
    {#if game.winner !== null}
      <h1>{game.players[game.winner]} wins!</h1>
      <p class="subtitle">First to {game.targetScore} · {game.hands.length} hands</p>
    {:else}
      <h1 class="in-progress-title">In progress</h1>
      <p class="subtitle">to {game.targetScore} · {game.hands.length} hand{game.hands.length === 1 ? '' : 's'}</p>
    {/if}
  </header>

  <!-- Hand history (top) — read-only on this view. -->
  {#if game.hands.length > 0}
    <section class="hands">
      <h2>Hand history</h2>
      <ul>
        {#each game.hands as hand (hand.index)}
          <li><HandRow {hand} players={game.players} /></li>
        {/each}
      </ul>
    </section>
  {/if}

  <!-- Match totals (middle, the headline). -->
  <section class="totals">
    {#each [0, 1] as i (i)}
      <div class="total" class:winner={game.winner === i}>
        <div class="name">{game.players[i]}</div>
        <div class="score">{totals[i]}</div>
      </div>
    {/each}
  </section>

  <!-- Actions (bottom): Back, Rematch (if applicable), Delete — small but
       clearly buttons; all btn-secondary so they're subordinate to the totals. -->
  <section class="actions">
    <button type="button" class="btn-secondary" onclick={backToMain}>Back</button>
    {#if game.winner !== null}
      <button type="button" class="btn-secondary" onclick={rematch}>Rematch</button>
    {/if}
    {#if confirmingDelete}
      <button type="button" class="btn-danger" onclick={doDelete}>Confirm delete</button>
      <button type="button" class="btn-secondary" onclick={() => (confirmingDelete = false)}>Cancel</button>
    {:else}
      <button type="button" class="btn-secondary" onclick={() => (confirmingDelete = true)}>Delete</button>
    {/if}
  </section>
{:else}
  <p class="loading">Match not found.</p>
{/if}

<style>
  .loading {
    text-align: center;
    color: var(--text-muted);
    margin-top: 48px;
  }

  .hero {
    text-align: center;
    padding: 24px 0 16px;
    animation: hero-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  @keyframes hero-in {
    0% {
      opacity: 0;
      transform: scale(1.15) rotate(-1.5deg);
    }
    100% {
      opacity: 1;
      transform: scale(1) rotate(0deg);
    }
  }

  .splash {
    width: 80px;
    height: auto;
    filter: drop-shadow(0 8px 18px rgba(251, 191, 36, 0.32));
    margin-bottom: 10px;
  }

  .hero.in-progress .splash {
    filter: drop-shadow(0 4px 10px rgba(0, 0, 0, 0.5));
  }

  h1 {
    font-size: 26px;
    color: var(--warning);
    margin-bottom: 6px;
    text-shadow: 0 0 24px rgba(251, 191, 36, 0.3);
  }

  .in-progress-title {
    font-size: 22px;
    color: var(--text-muted);
    text-shadow: none;
  }

  .subtitle {
    color: var(--text-muted);
    font-size: 13px;
  }

  .hands {
    margin: 20px 0 16px;
  }

  .hands h2 {
    font-size: 11px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 6px;
  }

  .hands ul {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .totals {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin: 12px 0 16px;
  }

  .total {
    padding: 16px;
    background: rgba(255, 255, 255, 0.04);
    border-radius: var(--radius-md);
    text-align: center;
    border: 2px solid transparent;
  }

  .total.winner {
    border-color: var(--warning);
    background: rgba(251, 191, 36, 0.08);
  }

  .total .name {
    font-size: 12px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 6px;
  }

  .total.winner .name {
    color: var(--warning);
  }

  .total .score {
    font-family: ui-monospace, 'SF Mono', Menlo, monospace;
    font-size: 36px;
    font-weight: 700;
    line-height: 1;
  }

  .total.winner .score {
    color: var(--warning);
  }

  /* Buttons subordinate to the totals — small but clearly buttons. */
  .actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;
    margin-top: 8px;
    padding-top: 12px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }

  .actions button {
    padding: 8px 18px;
    font-size: 13px;
    font-weight: 600;
  }

  .btn-danger {
    background: rgba(239, 68, 68, 0.18);
    color: var(--danger);
    border: 1px solid rgba(239, 68, 68, 0.4);
    border-radius: var(--radius-sm);
  }

  .btn-danger:hover {
    background: rgba(239, 68, 68, 0.28);
  }
</style>

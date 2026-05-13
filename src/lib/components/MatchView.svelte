<script lang="ts">
  /**
   * Display-only view of a single match — hero banner, hand history,
   * totals, and (when interactive) Rematch/Delete buttons. Used by
   * /game/done as the panel content inside the swipe carousel.
   */
  import { base } from '$app/paths';
  import HandRow from './HandRow.svelte';
  import { dealerIndexFor, totalFor } from '$lib/scoring';
  import type { Game } from '$lib/db';

  interface Props {
    game: Game;
    /** Render Rematch/Delete buttons (center panel only). */
    interactive?: boolean;
    onRematch?: () => void;
    onDelete?: () => void;
  }

  let { game, interactive = false, onRematch, onDelete }: Props = $props();

  let totals = $derived<[number, number]>([
    totalFor(game.hands, 0),
    totalFor(game.hands, 1)
  ]);
</script>

<header class="hero" class:in-progress={game.winner === null}>
  <img src="{base}/splash/ace-spades.png" alt="" class="splash" />
  {#if game.winner !== null}
    <h1>{game.players[game.winner]} wins!</h1>
    <p class="subtitle">First to {game.targetScore} · {game.hands.length} hands</p>
  {:else}
    <h1 class="in-progress-title">In progress</h1>
    <p class="subtitle">
      to {game.targetScore} · {game.hands.length} hand{game.hands.length === 1 ? '' : 's'}
    </p>
  {/if}
</header>

{#if game.hands.length > 0}
  <section class="hands">
    <h2>Hand history</h2>
    <ul>
      {#each game.hands as hand (hand.index)}
        <li>
          <HandRow
            {hand}
            players={game.players}
            dealerIndex={dealerIndexFor(game.firstDealerIndex, hand.index)}
          />
        </li>
      {/each}
    </ul>
  </section>
{/if}

<section class="totals">
  {#each [0, 1] as i (i)}
    <div class="total" class:winner={game.winner === i}>
      <div class="name">{game.players[i]}</div>
      <div class="score">{totals[i]}</div>
    </div>
  {/each}
</section>

{#if interactive}
  <section class="actions">
    {#if game.winner !== null}
      <button type="button" class="btn-secondary" onclick={onRematch}>Rematch</button>
    {/if}
    <button type="button" class="btn-secondary" onclick={onDelete}>Delete</button>
  </section>
{/if}

<style>
  .hero {
    text-align: center;
    padding: 24px 0 16px;
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
</style>

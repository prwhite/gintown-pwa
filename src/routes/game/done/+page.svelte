<script lang="ts">
  import { base } from '$app/paths';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import HandRow from '$lib/components/HandRow.svelte';
  import { currentGame } from '$lib/stores/currentGame';
  import { totalFor } from '$lib/scoring';

  onMount(async () => {
    await currentGame.hydrateFromStorage();
    if (!$currentGame.game) {
      goto(`${base}/`);
    }
  });

  let game = $derived($currentGame.game);
  let totals = $derived<[number, number]>(
    game ? [totalFor(game.hands, 0), totalFor(game.hands, 1)] : [0, 0]
  );

  async function backToMain() {
    await currentGame.clear();
    goto(`${base}/`);
  }

  async function rematch() {
    if (!game) return;
    const players = game.players;
    const target = game.targetScore;
    await currentGame.clear();
    await currentGame.start(players, target);
    goto(`${base}/game`);
  }
</script>

{#if game}
  <header class="hero">
    <img src="{base}/splash/ace-spades.svg" alt="" class="splash" />
    <h1>
      {game.winner !== null ? game.players[game.winner] : '—'} wins!
    </h1>
    <p class="subtitle">First to {game.targetScore} · {game.hands.length} hands</p>
  </header>

  <section class="totals">
    {#each [0, 1] as i (i)}
      <div class="total" class:winner={game.winner === i}>
        <div class="name">{game.players[i]}</div>
        <div class="score">{totals[i]}</div>
      </div>
    {/each}
  </section>

  <section class="actions">
    <button type="button" class="btn-primary rematch" onclick={rematch}>Rematch</button>
    <button type="button" class="btn-secondary done" onclick={backToMain}>Back to main</button>
  </section>

  <section class="hands">
    <h2>Hand history</h2>
    <ul>
      {#each game.hands as hand (hand.index)}
        <li><HandRow {hand} players={game.players} /></li>
      {/each}
    </ul>
  </section>
{/if}

<style>
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
    width: 96px;
    height: auto;
    filter: drop-shadow(0 8px 18px rgba(233, 69, 96, 0.4));
    margin-bottom: 12px;
  }

  h1 {
    font-size: 28px;
    background: linear-gradient(135deg, var(--accent), var(--accent-hover));
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    margin-bottom: 6px;
  }

  .subtitle {
    color: var(--text-muted);
    font-size: 13px;
  }

  .totals {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin: 24px 0;
  }

  .total {
    padding: 16px;
    background: rgba(255, 255, 255, 0.04);
    border-radius: var(--radius-md);
    text-align: center;
    border: 2px solid transparent;
  }

  .total.winner {
    border-color: var(--success);
    background: rgba(74, 222, 128, 0.08);
  }

  .total .name {
    font-size: 12px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 6px;
  }

  .total.winner .name {
    color: var(--success);
  }

  .total .score {
    font-family: ui-monospace, 'SF Mono', Menlo, monospace;
    font-size: 40px;
    font-weight: 700;
    line-height: 1;
  }

  .actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin-bottom: 32px;
  }

  .rematch,
  .done {
    padding: 16px;
    font-size: 15px;
    font-weight: 700;
  }

  .hands h2 {
    font-size: 12px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 8px;
  }

  .hands ul {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
</style>

<script lang="ts">
  import { base } from '$app/paths';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import Stepper from '$lib/components/Stepper.svelte';
  import { getMeta } from '$lib/db';
  import { currentGame } from '$lib/stores/currentGame';
  import { DEFAULT_TARGET_SCORE, RANGES } from '$lib/scoring';

  let p1 = $state('');
  let p2 = $state('');
  let targetScore = $state<number>(DEFAULT_TARGET_SCORE);
  let firstDealerIndex = $state<0 | 1>(0);

  onMount(async () => {
    const lastNames = await getMeta('lastNames');
    const lastTarget = await getMeta('lastTargetScore');
    const lastDealer = await getMeta('lastFirstDealerIndex');
    if (lastNames) {
      p1 = lastNames[0] ?? '';
      p2 = lastNames[1] ?? '';
    }
    if (typeof lastTarget === 'number') targetScore = lastTarget;
    if (lastDealer === 0 || lastDealer === 1) firstDealerIndex = lastDealer;
  });

  let canStart = $derived(p1.trim().length > 0 && p2.trim().length > 0);

  async function start() {
    if (!canStart) return;
    await currentGame.start([p1.trim(), p2.trim()], targetScore, firstDealerIndex);
    goto(`${base}/game`);
  }
</script>

<header class="header">
  <a class="back" href="{base}/" aria-label="Back">‹ Back</a>
  <h1>New game</h1>
</header>

<form
  class="form"
  onsubmit={(e) => {
    e.preventDefault();
    start();
  }}
>
  <div class="players-row">
    <label class="field">
      <span class="label">Player 1</span>
      <input type="text" bind:value={p1} autocomplete="off" autocapitalize="words" maxlength="20" placeholder="Name" />
    </label>
    <label class="field">
      <span class="label">Player 2</span>
      <input type="text" bind:value={p2} autocomplete="off" autocapitalize="words" maxlength="20" placeholder="Name" />
    </label>
  </div>

  <div class="field">
    <Stepper
      label="Target score"
      value={targetScore}
      onChange={(n) => (targetScore = n)}
      min={RANGES.targetScore.min}
      max={RANGES.targetScore.max}
      step={5}
      resetTo={DEFAULT_TARGET_SCORE}
    />
  </div>

  <div class="field">
    <span class="label">Who deals first?</span>
    <div class="dealer-grid">
      {#each [0, 1] as i (i)}
        <button
          type="button"
          class="dealer-tile"
          class:active={firstDealerIndex === i}
          onclick={() => (firstDealerIndex = i as 0 | 1)}
        >
          {(i === 0 ? p1 : p2).trim() || `Player ${i + 1}`}
        </button>
      {/each}
    </div>
  </div>

  <button type="submit" class="btn-primary start" disabled={!canStart}>Start</button>
</form>

<style>
  .header {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 16px 0 24px;
  }

  .back {
    color: var(--text-muted);
    text-decoration: none;
    font-size: 14px;
  }

  .back:hover {
    color: var(--text);
  }

  h1 {
    font-size: 24px;
    font-weight: 700;
  }

  .form {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .players-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .players-row input {
    /* min-width: 0 lets the input shrink to its grid cell on narrow viewports */
    min-width: 0;
    width: 100%;
  }

  .label {
    font-size: 12px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .dealer-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .dealer-tile {
    height: 44px;
    border-radius: var(--radius-md);
    background: rgba(255, 255, 255, 0.04);
    border: 2px solid rgba(255, 255, 255, 0.1);
    color: var(--text);
    font-size: 14px;
    font-weight: 600;
    transition: all 0.15s;
    touch-action: manipulation;
    padding: 0;
  }

  .dealer-tile:hover:not(.active) {
    background: rgba(255, 255, 255, 0.08);
  }

  .dealer-tile.active {
    background: rgba(251, 191, 36, 0.16);
    border-color: var(--warning);
    color: var(--text);
    box-shadow: 0 0 16px rgba(251, 191, 36, 0.32);
  }

  .start {
    margin-top: 12px;
    padding: 16px;
    font-size: 16px;
    font-weight: 700;
  }
</style>

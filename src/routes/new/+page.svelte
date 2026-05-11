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

  onMount(async () => {
    const lastNames = await getMeta('lastNames');
    const lastTarget = await getMeta('lastTargetScore');
    if (lastNames) {
      p1 = lastNames[0] ?? '';
      p2 = lastNames[1] ?? '';
    }
    if (typeof lastTarget === 'number') targetScore = lastTarget;
  });

  let canStart = $derived(p1.trim().length > 0 && p2.trim().length > 0);

  async function start() {
    if (!canStart) return;
    await currentGame.start([p1.trim(), p2.trim()], targetScore);
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
  <label class="field">
    <span class="label">Player 1</span>
    <input type="text" bind:value={p1} autocomplete="off" autocapitalize="words" maxlength="20" placeholder="Name" />
  </label>

  <label class="field">
    <span class="label">Player 2</span>
    <input type="text" bind:value={p2} autocomplete="off" autocapitalize="words" maxlength="20" placeholder="Name" />
  </label>

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

  .label {
    font-size: 12px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .start {
    margin-top: 12px;
    padding: 16px;
    font-size: 16px;
    font-weight: 700;
  }
</style>

<script lang="ts">
  import { base } from '$app/paths';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import Stepper from '$lib/components/Stepper.svelte';
  import WinnerPicker from '$lib/components/WinnerPicker.svelte';
  import HandRow from '$lib/components/HandRow.svelte';
  import { currentGame } from '$lib/stores/currentGame';
  import { DEFAULTS, RANGES, scoreHand, totalFor, type HandInput } from '$lib/scoring';

  // Inputs for the next hand — reset to defaults after each save.
  let ginnerIndex = $state<0 | 1>(0);
  let ginnerTotal = $state<number>(DEFAULTS.ginnerTotal);
  let defenderTotal = $state<number>(DEFAULTS.defenderTotal);
  let defenderDeadwood = $state<number>(DEFAULTS.defenderDeadwood);
  let defenderLayoffs = $state<number>(DEFAULTS.defenderLayoffs);

  let tick0 = $state(false);
  let tick1 = $state(false);

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
  let remaining = $derived<[number, number]>(
    game ? [Math.max(0, game.targetScore - totals[0]), Math.max(0, game.targetScore - totals[1])] : [0, 0]
  );

  let preview = $derived(() => {
    const input: HandInput = {
      ginnerIndex,
      ginnerTotal,
      defenderTotal,
      defenderDeadwood,
      defenderLayoffs
    };
    return scoreHand(input);
  });

  function fmt(n: number): string {
    return n > 0 ? `+${n}` : String(n);
  }

  function resetInputs() {
    ginnerTotal = DEFAULTS.ginnerTotal;
    defenderTotal = DEFAULTS.defenderTotal;
    defenderDeadwood = DEFAULTS.defenderDeadwood;
    defenderLayoffs = DEFAULTS.defenderLayoffs;
  }

  async function save() {
    if (!game) return;
    const before = totals;
    const res = await currentGame.addHand({
      ginnerIndex,
      ginnerTotal,
      defenderTotal,
      defenderDeadwood,
      defenderLayoffs
    });
    const after = res.totals;
    if (after[0] !== before[0]) {
      tick0 = false;
      requestAnimationFrame(() => (tick0 = true));
    }
    if (after[1] !== before[1]) {
      tick1 = false;
      requestAnimationFrame(() => (tick1 = true));
    }
    resetInputs();
    if (res.winner !== null) {
      setTimeout(() => goto(`${base}/game/done`), 700);
    }
  }

  async function deleteHand(index: number) {
    await currentGame.removeHand(index);
  }

  function urgency(remainingPoints: number): string {
    if (remainingPoints <= 0) return 'won';
    if (remainingPoints <= 25) return 'red';
    if (remainingPoints <= 50) return 'amber';
    return '';
  }

  let defenderIndex = $derived<0 | 1>(ginnerIndex === 0 ? 1 : 0);
</script>

{#if game}
  <header class="header">
    <a class="back" href="{base}/" aria-label="Back to main">‹</a>
    <div class="title">Hand #{game.hands.length + 1}</div>
    <div class="target">to {game.targetScore}</div>
  </header>

  <!-- Hand history: chronological (hand 1 first), swipe-left to delete. -->
  {#if game.hands.length > 0}
    <section class="hands">
      <h2>This game</h2>
      <ul>
        {#each game.hands as hand (hand.index)}
          <li>
            <HandRow {hand} players={game.players} onDelete={() => deleteHand(hand.index)} />
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  <!-- Running totals -->
  <section class="totals">
    {#each [0, 1] as i (i)}
      <div class="total">
        <div class="name">{game.players[i]}</div>
        <div class="score" class:score-tick={i === 0 ? tick0 : tick1}>{totals[i]}</div>
        <div class="remaining {urgency(remaining[i])}">
          {remaining[i] === 0 ? '✓' : `${remaining[i]} to go`}
        </div>
      </div>
    {/each}
  </section>

  <!-- Editing frame -->
  <section class="editor">
    <WinnerPicker players={game.players} value={ginnerIndex} onChange={(i) => (ginnerIndex = i)} />

    <Stepper
      label="{game.players[ginnerIndex]} score (ginner)"
      value={ginnerTotal}
      onChange={(n) => (ginnerTotal = n)}
      min={RANGES.ginnerTotal.min}
      max={RANGES.ginnerTotal.max}
      resetTo={DEFAULTS.ginnerTotal}
    />

    <Stepper
      label="{game.players[defenderIndex]} score"
      value={defenderTotal}
      onChange={(n) => (defenderTotal = n)}
      min={RANGES.defenderTotal.min}
      max={RANGES.defenderTotal.max}
      resetTo={DEFAULTS.defenderTotal}
    />

    <div class="metadata">
      <div class="meta-label">For posterity (not summed)</div>
      <div class="meta-row">
        <Stepper
          label="Deadwood"
          value={defenderDeadwood}
          onChange={(n) => (defenderDeadwood = n)}
          min={RANGES.defenderDeadwood.min}
          max={RANGES.defenderDeadwood.max}
          resetTo={DEFAULTS.defenderDeadwood}
          compact
        />
        <Stepper
          label="Layoffs"
          value={defenderLayoffs}
          onChange={(n) => (defenderLayoffs = n)}
          min={RANGES.defenderLayoffs.min}
          max={RANGES.defenderLayoffs.max}
          resetTo={DEFAULTS.defenderLayoffs}
          compact
        />
      </div>
    </div>

    <div class="preview">
      <div class="player">
        <span class="name">{game.players[0]}</span>
        <span class="delta" class:pos={preview()[0] > 0} class:neg={preview()[0] < 0}>
          {fmt(preview()[0])}
        </span>
      </div>
      <div class="player">
        <span class="name">{game.players[1]}</span>
        <span class="delta" class:pos={preview()[1] > 0} class:neg={preview()[1] < 0}>
          {fmt(preview()[1])}
        </span>
      </div>
    </div>

    <button type="button" class="btn-primary save" onclick={save}>Save hand</button>
  </section>
{/if}

<style>
  .header {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 12px;
    padding: 8px 0 12px;
  }

  .back {
    color: var(--text-muted);
    text-decoration: none;
    font-size: 22px;
    padding: 2px 6px;
  }

  .back:hover {
    color: var(--text);
  }

  .title {
    font-size: 16px;
    font-weight: 700;
    text-align: center;
  }

  .target {
    font-size: 11px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .hands {
    margin-bottom: 16px;
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
    gap: 10px;
    margin-bottom: 16px;
  }

  .total {
    padding: 10px;
    background: rgba(255, 255, 255, 0.04);
    border-radius: var(--radius-md);
    text-align: center;
  }

  .total .name {
    font-size: 11px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 2px;
  }

  .total .score {
    font-family: ui-monospace, 'SF Mono', Menlo, monospace;
    font-size: 28px;
    font-weight: 700;
    line-height: 1;
  }

  .remaining {
    margin-top: 2px;
    font-size: 10px;
    color: var(--text-muted);
  }

  .remaining.amber {
    color: var(--warning);
  }

  .remaining.red {
    color: var(--accent);
    font-weight: 700;
  }

  .remaining.won {
    color: var(--success);
    font-weight: 700;
  }

  .editor {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: var(--radius-lg);
  }

  .metadata {
    padding-top: 4px;
    border-top: 1px dashed rgba(255, 255, 255, 0.08);
  }

  .meta-label {
    font-size: 10px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin: 4px 0 6px;
    font-style: italic;
  }

  .meta-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .preview {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
    padding: 8px;
    background: rgba(0, 0, 0, 0.18);
    border-radius: var(--radius-sm);
  }

  .preview .player {
    text-align: center;
  }

  .preview .name {
    display: block;
    font-size: 10px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 2px;
  }

  .preview .delta {
    font-family: ui-monospace, 'SF Mono', Menlo, monospace;
    font-size: 18px;
    font-weight: 700;
  }

  .preview .pos {
    color: var(--success);
  }

  .preview .neg {
    color: var(--accent);
  }

  .save {
    padding: 14px;
    font-size: 15px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
  }
</style>

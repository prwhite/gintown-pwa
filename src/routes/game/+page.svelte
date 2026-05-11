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
  let ginnerMeldPoints = $state<number>(DEFAULTS.ginnerMeldPoints);
  let defenderMeldPoints = $state<number>(DEFAULTS.defenderMeldPoints);
  let defenderDeadwood = $state<number>(DEFAULTS.defenderDeadwood);
  let defenderLayoffs = $state<number>(DEFAULTS.defenderLayoffs);

  let tick0 = $state(false);
  let tick1 = $state(false);

  onMount(async () => {
    await currentGame.hydrateFromStorage();
    // No active game? Send them back.
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
      ginnerMeldPoints,
      defenderMeldPoints,
      defenderDeadwood,
      defenderLayoffs
    };
    return scoreHand(input);
  });

  function fmt(n: number): string {
    return n > 0 ? `+${n}` : String(n);
  }

  function resetInputs() {
    ginnerIndex = ginnerIndex; // keep the winner from the previous hand by default; tweak as needed
    ginnerMeldPoints = DEFAULTS.ginnerMeldPoints;
    defenderMeldPoints = DEFAULTS.defenderMeldPoints;
    defenderDeadwood = DEFAULTS.defenderDeadwood;
    defenderLayoffs = DEFAULTS.defenderLayoffs;
  }

  async function save() {
    if (!game) return;
    const before = totals;
    const res = await currentGame.addHand({
      ginnerIndex,
      ginnerMeldPoints,
      defenderMeldPoints,
      defenderDeadwood,
      defenderLayoffs
    });
    // Trigger tick animation on whichever totals changed.
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
      // Small delay so the tick animation registers before navigating.
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
</script>

{#if game}
  <header class="header">
    <a class="back" href="{base}/" aria-label="Back to main">‹</a>
    <div class="title">Hand #{game.hands.length + 1}</div>
    <div class="target">to {game.targetScore}</div>
  </header>

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

  <section class="inputs">
    <WinnerPicker players={game.players} value={ginnerIndex} onChange={(i) => (ginnerIndex = i)} />

    <Stepper
      label="{game.players[ginnerIndex]} meld points"
      value={ginnerMeldPoints}
      onChange={(n) => (ginnerMeldPoints = n)}
      min={RANGES.ginnerMeldPoints.min}
      max={RANGES.ginnerMeldPoints.max}
      resetTo={DEFAULTS.ginnerMeldPoints}
    />

    <Stepper
      label="{game.players[ginnerIndex === 0 ? 1 : 0]} meld points"
      value={defenderMeldPoints}
      onChange={(n) => (defenderMeldPoints = n)}
      min={RANGES.defenderMeldPoints.min}
      max={RANGES.defenderMeldPoints.max}
      resetTo={DEFAULTS.defenderMeldPoints}
    />

    <Stepper
      label="{game.players[ginnerIndex === 0 ? 1 : 0]} deadwood"
      value={defenderDeadwood}
      onChange={(n) => (defenderDeadwood = n)}
      min={RANGES.defenderDeadwood.min}
      max={RANGES.defenderDeadwood.max}
      resetTo={DEFAULTS.defenderDeadwood}
    />

    <Stepper
      label="{game.players[ginnerIndex === 0 ? 1 : 0]} layoffs"
      value={defenderLayoffs}
      onChange={(n) => (defenderLayoffs = n)}
      min={RANGES.defenderLayoffs.min}
      max={RANGES.defenderLayoffs.max}
      resetTo={DEFAULTS.defenderLayoffs}
    />
  </section>

  <section class="preview">
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
  </section>

  <button type="button" class="btn-primary save" onclick={save}>Save hand</button>

  {#if game.hands.length > 0}
    <section class="hands">
      <h2>This game ({game.hands.length})</h2>
      <ul>
        {#each [...game.hands].reverse() as hand (hand.index)}
          <li>
            <HandRow {hand} players={game.players} onDelete={() => deleteHand(hand.index)} />
          </li>
        {/each}
      </ul>
    </section>
  {/if}
{/if}

<style>
  .header {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 16px;
    padding: 12px 0 16px;
  }

  .back {
    color: var(--text-muted);
    text-decoration: none;
    font-size: 24px;
    padding: 4px 8px;
  }

  .back:hover {
    color: var(--text);
  }

  .title {
    font-size: 18px;
    font-weight: 700;
    text-align: center;
  }

  .target {
    font-size: 11px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .totals {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-bottom: 24px;
  }

  .total {
    padding: 12px;
    background: rgba(255, 255, 255, 0.04);
    border-radius: var(--radius-md);
    text-align: center;
  }

  .total .name {
    font-size: 12px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 4px;
  }

  .total .score {
    font-family: ui-monospace, 'SF Mono', Menlo, monospace;
    font-size: 36px;
    font-weight: 700;
    line-height: 1;
  }

  .remaining {
    margin-top: 4px;
    font-size: 11px;
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

  .inputs {
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin-bottom: 20px;
  }

  .preview {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    padding: 12px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px dashed rgba(255, 255, 255, 0.12);
    border-radius: var(--radius-md);
    margin-bottom: 16px;
  }

  .preview .player {
    text-align: center;
  }

  .preview .name {
    display: block;
    font-size: 11px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 4px;
  }

  .preview .delta {
    font-family: ui-monospace, 'SF Mono', Menlo, monospace;
    font-size: 22px;
    font-weight: 700;
  }

  .preview .pos {
    color: var(--success);
  }

  .preview .neg {
    color: var(--accent);
  }

  .save {
    width: 100%;
    padding: 18px;
    font-size: 16px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  .hands {
    margin-top: 32px;
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

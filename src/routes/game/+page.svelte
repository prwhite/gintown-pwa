<script lang="ts">
  import { base } from '$app/paths';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import Stepper from '$lib/components/Stepper.svelte';
  import HandRow from '$lib/components/HandRow.svelte';
  import { currentGame } from '$lib/stores/currentGame';
  import { deleteGame } from '$lib/db';
  import { history } from '$lib/stores/history';
  import { DEFAULTS, RANGES, totalFor } from '$lib/scoring';

  let ginnerIndex = $state<0 | 1>(0);
  let ginnerTotal = $state<number>(DEFAULTS.ginnerTotal);
  let defenderTotal = $state<number>(DEFAULTS.defenderTotal);
  let defenderDeadwood = $state<number>(DEFAULTS.defenderDeadwood);
  let defenderLayoffs = $state<number>(DEFAULTS.defenderLayoffs);

  let tick0 = $state(false);
  let tick1 = $state(false);

  let confirmingDelete = $state(false);

  onMount(async () => {
    await currentGame.hydrateFromStorage();
    if (!$currentGame.game) goto(`${base}/`);
  });

  let game = $derived($currentGame.game);
  let totals = $derived<[number, number]>(
    game ? [totalFor(game.hands, 0), totalFor(game.hands, 1)] : [0, 0]
  );
  let remaining = $derived<[number, number]>(
    game
      ? [Math.max(0, game.targetScore - totals[0]), Math.max(0, game.targetScore - totals[1])]
      : [0, 0]
  );

  // Each player's score input is bound by index; ginner=that-player picks the range.
  function isGinner(i: 0 | 1) {
    return i === ginnerIndex;
  }
  function setPlayerTotal(i: 0 | 1, v: number) {
    if (isGinner(i)) ginnerTotal = v;
    else defenderTotal = v;
  }
  function playerTotal(i: 0 | 1): number {
    return isGinner(i) ? ginnerTotal : defenderTotal;
  }
  function playerMin(i: 0 | 1): number {
    return isGinner(i) ? RANGES.ginnerTotal.min : RANGES.defenderTotal.min;
  }
  function playerMax(i: 0 | 1): number {
    return isGinner(i) ? RANGES.ginnerTotal.max : RANGES.defenderTotal.max;
  }
  function playerDefault(i: 0 | 1): number {
    return isGinner(i) ? DEFAULTS.ginnerTotal : DEFAULTS.defenderTotal;
  }

  function pickGinner(i: 0 | 1) {
    // When the user changes ginner, the role flips. Preserve their entered values
    // by swapping ginnerTotal ↔ defenderTotal so the displayed numbers stay put
    // under each player's name.
    if (i === ginnerIndex) return;
    [ginnerTotal, defenderTotal] = [defenderTotal, ginnerTotal];
    // Re-clamp into new ranges.
    ginnerTotal = Math.max(RANGES.ginnerTotal.min, Math.min(RANGES.ginnerTotal.max, ginnerTotal));
    defenderTotal = Math.max(RANGES.defenderTotal.min, Math.min(RANGES.defenderTotal.max, defenderTotal));
    ginnerIndex = i;
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

  async function doDeleteMatch() {
    if (!game) return;
    await deleteGame(game.id);
    await currentGame.clear();
    await history.refresh();
    goto(`${base}/`);
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

  <!-- Hand history (top), chronological. -->
  {#if game.hands.length > 0}
    <section class="hands">
      <h2>This game</h2>
      <ul>
        {#each game.hands as hand (hand.index)}
          <li>
            <HandRow
              {hand}
              players={game.players}
              onDelete={() => deleteHand(hand.index)}
              showIndex={false}
            />
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  <!-- Running totals (centered numbers). Leader shown in green. -->
  <section class="totals">
    {#each [0, 1] as i (i)}
      {@const leading = totals[i] > totals[1 - i] && totals[i] !== totals[1 - i]}
      <div class="total">
        <div class="name">{game.players[i]}</div>
        <div
          class="score"
          class:score-tick={i === 0 ? tick0 : tick1}
          class:leading
        >{totals[i]}</div>
        <div class="remaining {urgency(remaining[i])}">
          {remaining[i] === 0 ? '✓' : `${remaining[i]} to go`}
        </div>
      </div>
    {/each}
  </section>

  <!-- Editing frame -->
  <section class="editor">
    <!-- Row 1: Who ginned? -->
    <div class="label">Who ginned?</div>
    <div class="grid-2">
      {#each [0, 1] as i (i)}
        <button
          type="button"
          class="winner-tile"
          class:active={ginnerIndex === i}
          onclick={() => pickGinner(i as 0 | 1)}
        >
          {game.players[i] || `Player ${i + 1}`}
        </button>
      {/each}
    </div>

    <!-- Row 2: Player score steppers, side by side. -->
    <div class="grid-2 row-spacing">
      {#each [0, 1] as i (i)}
        <Stepper
          value={playerTotal(i as 0 | 1)}
          onChange={(n) => setPlayerTotal(i as 0 | 1, n)}
          min={playerMin(i as 0 | 1)}
          max={playerMax(i as 0 | 1)}
          resetTo={playerDefault(i as 0 | 1)}
          size="narrow"
          tone="positive"
        />
      {/each}
    </div>

    <!-- Row 3: Deadwood, positioned in the winner's column. -->
    <div class="grid-2 metadata-row">
      <div style="grid-column: {ginnerIndex + 1}">
        <Stepper
          label="Deadwood"
          value={defenderDeadwood}
          onChange={(n) => (defenderDeadwood = n)}
          min={RANGES.defenderDeadwood.min}
          max={RANGES.defenderDeadwood.max}
          resetTo={DEFAULTS.defenderDeadwood}
          size="compact"
        />
      </div>
    </div>

    <!-- Row 4: Layoffs, also on the winner's side. -->
    <div class="grid-2">
      <div style="grid-column: {ginnerIndex + 1}">
        <Stepper
          label="Layoffs"
          value={defenderLayoffs}
          onChange={(n) => (defenderLayoffs = n)}
          min={RANGES.defenderLayoffs.min}
          max={RANGES.defenderLayoffs.max}
          resetTo={DEFAULTS.defenderLayoffs}
          size="compact"
        />
      </div>
    </div>

    <button type="button" class="btn-primary save" onclick={save}>Save hand</button>
  </section>

  <!-- Ducked match-level controls -->
  <section class="match-actions">
    {#if confirmingDelete}
      <button type="button" class="btn-danger" onclick={doDeleteMatch}>Confirm delete</button>
      <button type="button" class="btn-ghost" onclick={() => (confirmingDelete = false)}>Cancel</button>
    {:else}
      <button type="button" class="btn-ghost delete" onclick={() => (confirmingDelete = true)}>Delete match</button>
    {/if}
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

  .total .score.leading {
    color: var(--success);
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
    gap: 8px;
    padding: 12px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: var(--radius-lg);
  }

  .label {
    font-size: 11px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .grid-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    min-width: 0;
  }

  .row-spacing {
    margin-top: 2px;
  }

  .metadata-row {
    margin-top: 4px;
  }

  .winner-tile {
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

  .winner-tile:hover:not(.active) {
    background: rgba(255, 255, 255, 0.08);
  }

  .winner-tile.active {
    background: rgba(251, 191, 36, 0.16);
    border-color: var(--warning);
    color: var(--text);
    box-shadow: 0 0 16px rgba(251, 191, 36, 0.32);
  }

  .save {
    padding: 14px;
    font-size: 15px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-top: 6px;
  }

  .match-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }

  .match-actions button {
    padding: 8px 16px;
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

  .delete {
    color: var(--text-muted);
  }

  .delete:hover {
    color: var(--accent);
  }
</style>

<script lang="ts">
  import { base } from '$app/paths';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import Stepper from '$lib/components/Stepper.svelte';
  import HandRow from '$lib/components/HandRow.svelte';
  import BackButton from '$lib/components/BackButton.svelte';
  import { currentGame } from '$lib/stores/currentGame';
  import { deleteGame } from '$lib/db';
  import { history } from '$lib/stores/history';
  import { DEFAULTS, RANGES, currentHandStreak, dealerIndexFor, totalFor } from '$lib/scoring';

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

  // Current hand's dealer (the hand being entered = handsLength + 1).
  let currentDealerIndex = $derived<0 | 1>(
    game ? dealerIndexFor(game.firstDealerIndex, game.hands.length + 1) : 0
  );

  // Trailing hand streak so far this match (≥2), updates as hands are saved.
  let handStreak = $derived(game ? currentHandStreak(game.hands, game.players) : null);

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

  function pickGinner(i: 0 | 1) {
    if (i === ginnerIndex) return;
    [ginnerTotal, defenderTotal] = [defenderTotal, ginnerTotal];
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
    <BackButton href="{base}/" />
    <div class="title">Hand #{game.hands.length + 1}</div>
    <div class="target">to {game.targetScore}</div>
  </header>

  <!-- Hand history (top), chronological. Dealer dot per hand. -->
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
              showNames={false}
              dealerIndex={dealerIndexFor(game.firstDealerIndex, hand.index)}
            />
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  {#if handStreak}
    <p class="streak"><em>{handStreak.name} won the last {handStreak.count} hands</em></p>
  {/if}

  <!-- Whose deal the next (currently-entered) hand is. -->
  <div class="next-deal">{game.players[currentDealerIndex]}'s deal</div>

  <!-- Running totals. -->
  <section class="totals">
    {#each [0, 1] as i (i)}
      {@const leading = totals[i] > totals[1 - i] && totals[i] !== totals[1 - i]}
      <div class="total">
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

    <div class="grid-2 row-spacing">
      {#each [0, 1] as i (i)}
        <Stepper
          value={playerTotal(i as 0 | 1)}
          onChange={(n) => setPlayerTotal(i as 0 | 1, n)}
          min={playerMin(i as 0 | 1)}
          max={playerMax(i as 0 | 1)}
          size="narrow"
          tone="positive"
        />
      {/each}
    </div>

    <div class="grid-2 metadata-row">
      <div style="grid-column: {2 - ginnerIndex}">
        <Stepper
          label="Deadwood"
          value={defenderDeadwood}
          onChange={(n) => (defenderDeadwood = n)}
          min={RANGES.defenderDeadwood.min}
          max={RANGES.defenderDeadwood.max}
          size="compact"
        />
      </div>
    </div>

    <div class="grid-2">
      <div style="grid-column: {2 - ginnerIndex}">
        <Stepper
          label="Layoffs"
          value={defenderLayoffs}
          onChange={(n) => (defenderLayoffs = n)}
          min={RANGES.defenderLayoffs.min}
          max={RANGES.defenderLayoffs.max}
          size="compact"
        />
      </div>
    </div>

    <button type="button" class="btn-primary save" onclick={save}>Save hand</button>
  </section>

  <section class="match-actions">
    <button type="button" class="btn-secondary" onclick={() => (confirmingDelete = true)}>Delete</button>
  </section>

  {#if confirmingDelete}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="modal-overlay"
      onclick={(e) => { if (e.target === e.currentTarget) confirmingDelete = false; }}
    >
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="delete-match-title">
        <h2 id="delete-match-title">Delete this match?</h2>
        <p class="modal-body">This can't be undone.</p>
        <div class="modal-actions">
          <button type="button" class="btn-secondary" onclick={() => (confirmingDelete = false)}>Cancel</button>
          <button type="button" class="btn-danger" onclick={doDeleteMatch}>Delete</button>
        </div>
      </div>
    </div>
  {/if}
{/if}

<style>
  .header {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 12px;
    padding: 8px 0 12px;
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

  .streak {
    text-align: center;
    font-size: 14px;
    font-style: italic;
    color: var(--text-muted);
    margin: 0 0 8px;
  }

  .next-deal {
    text-align: center;
    font-size: 12px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 8px;
  }

  .total .score {
    font-family: ui-monospace, 'SF Mono', Menlo, monospace;
    font-size: 63px;
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
    font-size: 21px;
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

  .modal-body {
    color: var(--text-muted);
    margin-bottom: 24px;
    font-size: 14px;
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  .modal-actions button {
    padding: 10px 18px;
    font-size: 14px;
    font-weight: 600;
  }
</style>

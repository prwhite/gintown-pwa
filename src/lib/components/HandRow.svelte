<script lang="ts">
  import SwipeRow from './SwipeRow.svelte';
  import type { Hand } from '$lib/db';

  interface Props {
    hand: Hand;
    players: [string, string];
    onDelete?: () => void;
    /** Show the leading "#N" hand index. Hidden on the live match view. */
    showIndex?: boolean;
  }

  let { hand, players, onDelete, showIndex = true }: Props = $props();

  function fmt(n: number): string {
    return n > 0 ? `+${n}` : String(n);
  }
</script>

<SwipeRow {onDelete}>
  <div class="row" class:no-index={!showIndex}>
    {#if showIndex}
      <div class="index">#{hand.index}</div>
    {/if}

    {#each [0, 1] as i (i)}
      {@const isGinner = hand.ginnerIndex === i}
      {@const isDefender = !isGinner}
      <div class="player">
        <div class="name" class:winner={isGinner}>{players[i]}</div>
        <div class="score-wrap">
          <span
            class="score"
            class:pos={hand.scores[i] > 0}
            class:neg={hand.scores[i] < 0}
            class:ginner={isGinner}
          >
            {fmt(hand.scores[i])}
          </span>

          {#if isDefender}
            <span class="meta" aria-label="deadwood and layoffs">
              <span class="dw" class:zero={hand.defenderDeadwood === 0}>
                {hand.defenderDeadwood === 0 ? '0' : `-${hand.defenderDeadwood}`}
              </span>
              <span class="lo" class:zero={hand.defenderLayoffs === 0}>
                {hand.defenderLayoffs === 0 ? '0' : `+${hand.defenderLayoffs}`}
              </span>
            </span>
          {/if}
        </div>
      </div>
    {/each}
  </div>
</SwipeRow>

<style>
  .row {
    display: grid;
    grid-template-columns: auto 1fr 1fr;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
  }

  .row.no-index {
    grid-template-columns: 1fr 1fr;
  }

  .index {
    text-align: left;
    font-size: 11px;
    color: var(--text-muted);
    font-family: ui-monospace, 'SF Mono', Menlo, monospace;
  }

  .player {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .name {
    font-size: 10px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .name.winner {
    color: var(--warning);
  }

  /* Score remains centered inside the player column; .meta is absolutely
     positioned to the right and doesn't affect that centering. */
  .score-wrap {
    position: relative;
    display: inline-flex;
    align-items: center;
  }

  .score {
    font-family: ui-monospace, 'SF Mono', Menlo, monospace;
    font-size: 16px;
    font-weight: 700;
    color: var(--text);
  }

  .score.pos {
    color: var(--success);
  }

  .score.neg {
    color: var(--accent);
  }

  .score.ginner {
    color: var(--warning);
    text-decoration: underline;
    text-decoration-color: var(--warning);
    text-decoration-thickness: 2px;
    text-underline-offset: 3px;
  }

  .meta {
    position: absolute;
    left: 100%;
    top: 50%;
    transform: translateY(-50%);
    margin-left: 4px;
    display: flex;
    flex-direction: column;
    font-family: ui-monospace, 'SF Mono', Menlo, monospace;
    font-size: 9px;
    line-height: 1.1;
    font-weight: 600;
    text-align: left;
    pointer-events: none;
  }

  .meta .dw {
    color: #f59797; /* mid red */
  }

  .meta .lo {
    color: #8fdba1; /* mid green */
  }

  .meta .zero {
    color: var(--text-muted);
  }
</style>

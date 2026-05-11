<script lang="ts">
  import SwipeRow from './SwipeRow.svelte';
  import type { Hand } from '$lib/db';

  interface Props {
    hand: Hand;
    players: [string, string];
    onDelete?: () => void;
  }

  let { hand, players, onDelete }: Props = $props();

  function fmt(n: number): string {
    return n > 0 ? `+${n}` : String(n);
  }
</script>

<SwipeRow {onDelete}>
  <div class="row">
    <div class="index">#{hand.index}</div>

    <div class="player">
      <div class="name" class:winner={hand.ginnerIndex === 0}>{players[0]}</div>
      <div
        class="score"
        class:pos={hand.scores[0] > 0}
        class:neg={hand.scores[0] < 0}
        class:ginner={hand.ginnerIndex === 0}
      >
        {fmt(hand.scores[0])}
      </div>
    </div>

    <div class="player">
      <div class="name" class:winner={hand.ginnerIndex === 1}>{players[1]}</div>
      <div
        class="score"
        class:pos={hand.scores[1] > 0}
        class:neg={hand.scores[1] < 0}
        class:ginner={hand.ginnerIndex === 1}
      >
        {fmt(hand.scores[1])}
      </div>
    </div>
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
</style>

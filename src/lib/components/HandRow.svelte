<script lang="ts">
  import type { Hand } from '$lib/db';

  interface Props {
    hand: Hand;
    players: [string, string];
    onDelete?: () => void;
  }

  let { hand, players, onDelete }: Props = $props();

  let confirming = $state(false);

  function fmt(n: number): string {
    return n > 0 ? `+${n}` : String(n);
  }
</script>

<div class="row">
  <div class="index">#{hand.index}</div>
  <div class="player">
    <div class="name" class:winner={hand.scores[0] >= hand.scores[1]}>{players[0]}</div>
    <div class="score" class:pos={hand.scores[0] > 0} class:neg={hand.scores[0] < 0}>
      {fmt(hand.scores[0])}
    </div>
  </div>
  <div class="player">
    <div class="name" class:winner={hand.scores[1] > hand.scores[0]}>{players[1]}</div>
    <div class="score" class:pos={hand.scores[1] > 0} class:neg={hand.scores[1] < 0}>
      {fmt(hand.scores[1])}
    </div>
  </div>
  {#if onDelete}
    {#if confirming}
      <button type="button" class="btn-secondary del confirm" onclick={() => { confirming = false; onDelete?.(); }}>
        Delete?
      </button>
      <button type="button" class="btn-ghost cancel" onclick={() => (confirming = false)}>
        ✕
      </button>
    {:else}
      <button type="button" class="btn-ghost del" aria-label="Delete hand #{hand.index}" onclick={() => (confirming = true)}>
        🗑
      </button>
    {/if}
  {/if}
</div>

<style>
  .row {
    display: grid;
    grid-template-columns: auto 1fr 1fr auto auto;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 10px;
  }

  .index {
    font-size: 11px;
    color: var(--text-muted);
    font-family: ui-monospace, 'SF Mono', Menlo, monospace;
  }

  .player {
    display: flex;
    flex-direction: column;
  }

  .name {
    font-size: 11px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .name.winner {
    color: var(--success);
  }

  .score {
    font-family: ui-monospace, 'SF Mono', Menlo, monospace;
    font-size: 18px;
    font-weight: 700;
  }

  .score.pos {
    color: var(--success);
  }

  .score.neg {
    color: var(--accent);
  }

  .del {
    padding: 6px 10px;
    font-size: 13px;
  }

  .confirm {
    color: var(--accent);
  }

  .cancel {
    padding: 6px 8px;
    font-size: 14px;
  }
</style>

<script lang="ts">
  interface Props {
    players: [string, string];
    value: 0 | 1;
    onChange: (i: 0 | 1) => void;
  }

  let { players, value, onChange }: Props = $props();
</script>

<div class="picker">
  <div class="label">Who ginned?</div>
  <div class="row">
    <button
      type="button"
      class="tile"
      class:active={value === 0}
      onclick={() => onChange(0)}
    >
      {players[0] || 'Player 1'}
    </button>
    <button
      type="button"
      class="tile"
      class:active={value === 1}
      onclick={() => onChange(1)}
    >
      {players[1] || 'Player 2'}
    </button>
  </div>
</div>

<style>
  .picker {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .label {
    font-size: 12px;
    color: var(--text-muted);
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }

  .row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .tile {
    height: 64px;
    border-radius: var(--radius-md);
    background: rgba(255, 255, 255, 0.04);
    border: 2px solid rgba(255, 255, 255, 0.1);
    color: var(--text);
    font-size: 16px;
    font-weight: 600;
    transition: all 0.15s;
    touch-action: manipulation;
  }

  .tile:hover:not(.active) {
    background: rgba(255, 255, 255, 0.08);
  }

  .tile.active {
    background: rgba(233, 69, 96, 0.18);
    border-color: var(--accent);
    color: var(--text);
    box-shadow: 0 0 18px rgba(233, 69, 96, 0.35);
  }
</style>

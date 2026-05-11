<script lang="ts">
  interface Props {
    value: number;
    onChange: (n: number) => void;
    min?: number;
    max?: number;
    step?: number;
    label?: string;
    /** Optional reset target shown as a "↺" button. */
    resetTo?: number;
  }

  let {
    value,
    onChange,
    min = -Infinity,
    max = Infinity,
    step = 5,
    label,
    resetTo
  }: Props = $props();

  let holdTimer: ReturnType<typeof setTimeout> | null = null;
  let repeatTimer: ReturnType<typeof setInterval> | null = null;

  function clamp(n: number) {
    return Math.max(min, Math.min(max, n));
  }

  function bump(direction: -1 | 1) {
    const next = clamp(value + direction * step);
    if (next !== value) onChange(next);
  }

  function startHold(direction: -1 | 1) {
    bump(direction); // immediate tick
    // After 500ms hold, start repeating every 100ms.
    holdTimer = setTimeout(() => {
      repeatTimer = setInterval(() => bump(direction), 100);
    }, 500);
  }

  function endHold() {
    if (holdTimer) clearTimeout(holdTimer);
    if (repeatTimer) clearInterval(repeatTimer);
    holdTimer = null;
    repeatTimer = null;
  }

  function reset() {
    if (resetTo === undefined) return;
    if (resetTo !== value) onChange(clamp(resetTo));
  }

  let atMin = $derived(value <= min);
  let atMax = $derived(value >= max);
</script>

<div class="stepper">
  {#if label}
    <div class="label">{label}</div>
  {/if}
  <div class="row">
    <button
      type="button"
      class="bump"
      disabled={atMin}
      aria-label="Decrease {label ?? ''}"
      onpointerdown={() => startHold(-1)}
      onpointerup={endHold}
      onpointercancel={endHold}
      onpointerleave={endHold}
    >−{step}</button>

    <div class="value" aria-live="polite">{value}</div>

    <button
      type="button"
      class="bump"
      disabled={atMax}
      aria-label="Increase {label ?? ''}"
      onpointerdown={() => startHold(1)}
      onpointerup={endHold}
      onpointercancel={endHold}
      onpointerleave={endHold}
    >+{step}</button>
  </div>
  {#if resetTo !== undefined}
    <button type="button" class="reset" onclick={reset} disabled={value === resetTo}>
      ↺ reset to {resetTo}
    </button>
  {/if}
</div>

<style>
  .stepper {
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
    grid-template-columns: var(--tap-min) 1fr var(--tap-min);
    align-items: stretch;
    gap: 8px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: var(--radius-md);
    padding: 6px;
  }

  .bump {
    height: var(--tap-min);
    border-radius: var(--radius-sm);
    background: rgba(255, 255, 255, 0.08);
    color: var(--text);
    font-size: 16px;
    font-weight: 700;
    user-select: none;
    touch-action: manipulation;
  }

  .bump:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.14);
  }

  .bump:active:not(:disabled) {
    background: var(--accent);
    color: white;
    transform: scale(0.96);
  }

  .value {
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: ui-monospace, 'SF Mono', Menlo, monospace;
    font-size: 32px;
    font-weight: 700;
    color: var(--text);
    tabular-nums: 1;
    font-variant-numeric: tabular-nums;
  }

  .reset {
    align-self: center;
    font-size: 11px;
    color: var(--text-muted);
    padding: 4px 8px;
    border-radius: 6px;
  }

  .reset:hover:not(:disabled) {
    color: var(--text);
  }
</style>

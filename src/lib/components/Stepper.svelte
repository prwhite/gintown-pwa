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
    /** 'normal' (full-width primary), 'narrow' (two-up score), 'compact' (metadata). */
    size?: 'normal' | 'narrow' | 'compact';
  }

  let {
    value,
    onChange,
    min = -Infinity,
    max = Infinity,
    step = 5,
    label,
    resetTo,
    size = 'normal'
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
    bump(direction);
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

<div class="stepper {size}">
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
      ↺ {resetTo}
    </button>
  {/if}
</div>

<style>
  .stepper {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  .label {
    font-size: 11px;
    color: var(--text-muted);
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }

  .row {
    display: grid;
    align-items: stretch;
    gap: 6px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: var(--radius-md);
    padding: 4px;
  }

  .bump {
    border-radius: var(--radius-sm);
    background: rgba(255, 255, 255, 0.08);
    color: var(--text);
    font-weight: 700;
    user-select: none;
    touch-action: manipulation;
    padding: 0;
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
    font-weight: 700;
    color: var(--text);
    font-variant-numeric: tabular-nums;
  }

  /* normal: full-width primary stepper */
  .normal .row {
    grid-template-columns: 88px 1fr 88px;
  }
  .normal .bump {
    height: var(--tap-min);
    font-size: 15px;
  }
  .normal .value {
    font-size: 26px;
  }

  /* narrow: two-up side-by-side score stepper */
  .narrow .row {
    grid-template-columns: 48px 1fr 48px;
    gap: 4px;
    padding: 3px;
  }
  .narrow .bump {
    height: 38px;
    font-size: 13px;
  }
  .narrow .value {
    font-size: 22px;
  }

  /* compact: smallest, for posterity metadata */
  .compact .row {
    grid-template-columns: 48px 1fr 48px;
    gap: 4px;
    padding: 3px;
  }
  .compact .bump {
    height: 32px;
    font-size: 12px;
  }
  .compact .value {
    font-size: 16px;
  }

  .reset {
    align-self: center;
    font-size: 10px;
    color: var(--text-muted);
    padding: 2px 6px;
    border-radius: 6px;
    background: none;
    border: none;
    cursor: pointer;
    font-weight: 600;
  }

  .reset:hover:not(:disabled) {
    color: var(--text);
  }
</style>

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
    /** Color of the value display. 'positive' uses --success (for meld score entry). */
    tone?: 'normal' | 'positive';
  }

  let {
    value,
    onChange,
    min = -Infinity,
    max = Infinity,
    step = 5,
    label,
    resetTo,
    size = 'normal',
    tone = 'normal'
  }: Props = $props();

  let holdTimer: ReturnType<typeof setTimeout> | null = null;
  let repeatTimer: ReturnType<typeof setInterval> | null = null;

  // Long-press → drag. After HOLD_MS the press is "armed": a stationary hold
  // auto-repeats as before, but moving the finger vertically switches to drag
  // mode, where every DRAG_PX of travel is one step (up = increase). Pointer
  // capture keeps the gesture on the button; touch-action:none keeps the page
  // from scrolling under it.
  const HOLD_MS = 500;
  const REPEAT_MS = 100;
  const DRAG_PX = 12;
  const DRAG_SLOP = 8;

  let armed = $state(false);
  let dragging = $state(false);
  let pointerId: number | null = null;
  let startY = 0;
  let dragBase = 0;

  function clamp(n: number) {
    return Math.max(min, Math.min(max, n));
  }

  function bump(direction: -1 | 1) {
    const next = clamp(value + direction * step);
    if (next !== value) onChange(next);
  }

  function onDown(e: PointerEvent, direction: -1 | 1) {
    if (pointerId !== null) return;
    pointerId = e.pointerId;
    startY = e.clientY;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    bump(direction);
    holdTimer = setTimeout(() => {
      armed = true;
      repeatTimer = setInterval(() => bump(direction), REPEAT_MS);
    }, HOLD_MS);
  }

  function onMove(e: PointerEvent) {
    if (e.pointerId !== pointerId || !armed) return;
    const dy = startY - e.clientY; // up = positive
    if (!dragging) {
      if (Math.abs(dy) < DRAG_SLOP) return;
      dragging = true;
      if (repeatTimer) clearInterval(repeatTimer);
      repeatTimer = null;
      startY = e.clientY;
      dragBase = value;
      return;
    }
    const next = clamp(dragBase + Math.round(dy / DRAG_PX) * step);
    if (next !== value) onChange(next);
  }

  function onUp(e: PointerEvent) {
    if (e.pointerId !== pointerId) return;
    if (holdTimer) clearTimeout(holdTimer);
    if (repeatTimer) clearInterval(repeatTimer);
    holdTimer = null;
    repeatTimer = null;
    pointerId = null;
    armed = false;
    dragging = false;
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
      class:armed
      class:dragging
      onpointerdown={(e) => onDown(e, -1)}
      onpointermove={onMove}
      onpointerup={onUp}
      onpointercancel={onUp}
      oncontextmenu={(e) => e.preventDefault()}
    >−{step}</button>

    <div class="value" class:positive={tone === 'positive'} aria-live="polite">{value}</div>

    <button
      type="button"
      class="bump"
      disabled={atMax}
      aria-label="Increase {label ?? ''}"
      class:armed
      class:dragging
      onpointerdown={(e) => onDown(e, 1)}
      onpointermove={onMove}
      onpointerup={onUp}
      onpointercancel={onUp}
      oncontextmenu={(e) => e.preventDefault()}
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
    -webkit-user-select: none;
    -webkit-touch-callout: none;
    touch-action: none;
    padding: 0;
  }

  .bump.armed:not(:disabled) {
    background: var(--accent);
    color: white;
    box-shadow: 0 0 12px rgba(255, 255, 255, 0.25);
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

  .value.positive {
    color: var(--success);
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

  /* narrow + compact: stacked — value on top, wide tall bump buttons below so
     a thumb on a button never covers the readout. */
  .narrow .row,
  .compact .row {
    grid-template-columns: 1fr 1fr;
    grid-template-rows: auto auto;
    gap: 4px;
    padding: 4px;
  }
  .narrow .value,
  .compact .value {
    grid-column: 1 / -1;
    grid-row: 1;
  }
  .narrow .bump,
  .compact .bump {
    grid-row: 2;
  }

  /* narrow: two-up score stepper */
  .narrow .bump {
    height: 52px;
    font-size: 15px;
  }
  .narrow .value {
    font-size: 30px;
    line-height: 1.1;
  }

  /* compact: for posterity metadata */
  .compact .bump {
    height: 46px;
    font-size: 14px;
  }
  .compact .value {
    font-size: 22px;
    line-height: 1.1;
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

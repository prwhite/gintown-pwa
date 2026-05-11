<script lang="ts">
  import type { Hand } from '$lib/db';

  interface Props {
    hand: Hand;
    players: [string, string];
    onDelete?: () => void;
  }

  let { hand, players, onDelete }: Props = $props();

  // Swipe-to-delete state
  let surface: HTMLDivElement | undefined = $state();
  let dragX = $state(0);
  let dragging = $state(false);
  let snapping = $state(false);
  let removing = $state(false);
  let startX = 0;
  let startY = 0;
  let decided: boolean | null = null; // null = undecided, true = horizontal, false = vertical (give up)
  const COMMIT_RATIO = 0.45;

  function rowWidth(): number {
    return surface?.getBoundingClientRect().width ?? 320;
  }

  function onPointerDown(e: PointerEvent) {
    if (!onDelete || removing) return;
    startX = e.clientX;
    startY = e.clientY;
    decided = null;
    dragging = true;
    snapping = false;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: PointerEvent) {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (decided === null) {
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        decided = Math.abs(dx) > Math.abs(dy);
        if (!decided) {
          dragging = false;
          dragX = 0;
          return;
        }
      }
    }
    if (decided) {
      // Only allow left-drag; resist right-drag with rubber band.
      dragX = dx < 0 ? Math.max(dx, -rowWidth()) : Math.min(dx * 0.15, 24);
    }
  }

  function onPointerUp() {
    if (!dragging) return;
    dragging = false;
    const threshold = -rowWidth() * COMMIT_RATIO;
    if (dragX <= threshold) {
      // commit: slide fully off, then delete
      removing = true;
      snapping = true;
      dragX = -rowWidth();
      setTimeout(() => onDelete?.(), 180);
    } else {
      snapping = true;
      dragX = 0;
      setTimeout(() => (snapping = false), 200);
    }
  }

  function fmt(n: number): string {
    return n > 0 ? `+${n}` : String(n);
  }

  // Tray "delete" intensity (0..1) — how close the swipe is to committing.
  let trayProgress = $derived(() => {
    if (dragX >= 0) return 0;
    return Math.min(1, -dragX / (rowWidth() * COMMIT_RATIO));
  });
</script>

<div class="wrap" class:removing>
  <div
    class="tray"
    style="opacity: {Math.max(0.35, trayProgress())};"
  >
    <span class="tray-label">Delete</span>
  </div>

  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="surface"
    bind:this={surface}
    class:dragging
    class:snapping
    style="transform: translateX({dragX}px)"
    onpointerdown={onPointerDown}
    onpointermove={onPointerMove}
    onpointerup={onPointerUp}
    onpointercancel={onPointerUp}
    onpointerleave={() => { if (dragging) onPointerUp(); }}
  >
    <div class="index">#{hand.index}</div>

    <div class="player" class:winner-side={hand.ginnerIndex === 0}>
      <div class="name">{players[0]}</div>
      <div class="score" class:pos={hand.scores[0] > 0} class:neg={hand.scores[0] < 0} class:ginner={hand.ginnerIndex === 0}>
        {fmt(hand.scores[0])}
      </div>
    </div>

    <div class="player" class:winner-side={hand.ginnerIndex === 1}>
      <div class="name">{players[1]}</div>
      <div class="score" class:pos={hand.scores[1] > 0} class:neg={hand.scores[1] < 0} class:ginner={hand.ginnerIndex === 1}>
        {fmt(hand.scores[1])}
      </div>
    </div>

    <!-- Subtle gold sliver hints at swipeability. -->
    <div class="swipe-hint" aria-hidden="true"></div>
  </div>
</div>

<style>
  .wrap {
    position: relative;
    overflow: hidden;
    border-radius: 10px;
    transition: height 0.18s ease, margin 0.18s ease, opacity 0.18s ease;
  }

  .wrap.removing {
    opacity: 0.2;
  }

  .tray {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding-right: 14px;
    background: linear-gradient(90deg, rgba(239, 68, 68, 0) 0%, rgba(239, 68, 68, 0.85) 80%);
    color: white;
    font-size: 13px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    pointer-events: none;
  }

  .tray-label {
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
  }

  .surface {
    position: relative;
    display: grid;
    grid-template-columns: auto 1fr 1fr;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    background: rgba(20, 24, 40, 0.95);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 10px;
    user-select: none;
    touch-action: pan-y;
    will-change: transform;
  }

  .surface.snapping {
    transition: transform 0.18s ease;
  }

  .surface.dragging {
    cursor: grabbing;
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
    font-size: 10px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .winner-side .name {
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

  /* Gold highlight for the ginner — overrides pos/neg color, adds underline. */
  .score.ginner {
    color: var(--warning);
    text-decoration: underline;
    text-decoration-color: var(--warning);
    text-decoration-thickness: 2px;
    text-underline-offset: 3px;
  }

  /* Tiny right-edge sliver to hint that the row can be swiped. */
  .swipe-hint {
    position: absolute;
    top: 30%;
    right: 4px;
    height: 40%;
    width: 2px;
    background: rgba(251, 191, 36, 0.25);
    border-radius: 1px;
    pointer-events: none;
  }
</style>

<script lang="ts">
  /**
   * Wraps arbitrary row content in a swipe-left-to-delete gesture. The "delete
   * tray" underneath is a flat red gradient (no label, per design). A subtle
   * gold sliver hint sits on the right edge when onDelete is provided.
   */
  import type { Snippet } from 'svelte';

  interface Props {
    onDelete?: () => void;
    children: Snippet;
  }

  let { onDelete, children }: Props = $props();

  let surface: HTMLDivElement | undefined = $state();
  let dragX = $state(0);
  let dragging = $state(false);
  let snapping = $state(false);
  let removing = $state(false);
  let startX = 0;
  let startY = 0;
  let decided: boolean | null = null;
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
    // Critical: do NOT setPointerCapture here. Capturing on pointerdown
    // suppresses the synthetic click that fires on a tap (no movement),
    // which kills tap-to-navigate on anchors inside the swipe surface.
    // We capture later, in onPointerMove, only after the gesture is
    // confirmed as a horizontal swipe.
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
        // Now that we know it's a horizontal swipe, capture so the gesture
        // continues even if the pointer leaves the surface mid-drag.
        try {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        } catch {
          /* ignore — older Safari may throw if pointer already released */
        }
      }
    }
    if (decided) {
      dragX = dx < 0 ? Math.max(dx, -rowWidth()) : Math.min(dx * 0.15, 24);
    }
  }

  function onPointerUp() {
    if (!dragging) return;
    dragging = false;
    const threshold = -rowWidth() * COMMIT_RATIO;
    if (dragX <= threshold) {
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
</script>

<div class="wrap" class:removing>
  {#if onDelete}
    <div class="tray" aria-hidden="true"></div>
  {/if}
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
    {@render children()}
    {#if onDelete}
      <div class="swipe-hint" aria-hidden="true"></div>
    {/if}
  </div>
</div>

<style>
  .wrap {
    position: relative;
    overflow: hidden;
    border-radius: 10px;
    transition: opacity 0.18s ease;
  }
  .wrap.removing {
    opacity: 0.2;
  }
  .tray {
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, rgba(239, 68, 68, 0) 0%, rgba(239, 68, 68, 0.85) 80%);
    pointer-events: none;
  }
  .surface {
    position: relative;
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

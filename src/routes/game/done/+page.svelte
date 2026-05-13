<script lang="ts">
  import { base } from '$app/paths';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import BackButton from '$lib/components/BackButton.svelte';
  import MatchView from '$lib/components/MatchView.svelte';
  import { currentGame } from '$lib/stores/currentGame';
  import { deleteGame, getGame, type Game } from '$lib/db';
  import { history } from '$lib/stores/history';

  // ---- Loaded triple ---------------------------------------------------
  // The carousel renders three fixed slots — prev | center | next — each
  // pinned by absolute left at -100vw / 0 / +100vw of the track. Swiping
  // translates the track; on commit we rebind which game lives in which
  // slot so the previously-adjacent panel is now in the center, then
  // snap track translate back to 0 with no transition. The effect is
  // continuous: nothing fades, nothing re-mounts.
  let id = $derived($page.url.searchParams.get('id'));
  let isCurrent = $derived(!id);

  let center = $state<Game | null>(null);
  let prevPanel = $state<Game | null>(null);
  let nextPanel = $state<Game | null>(null);
  let loading = $state(true);
  // Tracks the id we've already loaded a triple for, so that internal
  // swipe-driven URL updates don't trigger a redundant IDB re-fetch.
  let loadedForId: string | null | undefined = undefined;

  // History is newest-first; carousel order is oldest → newest (drag-left
  // = newer = panel-right). Maintained as a derived list so panels stay
  // in sync if history.refresh() runs.
  let chronological = $derived([...$history].sort((a, b) => a.createdAt - b.createdAt));

  function neighbors(centerId: string | null): { prevId: string | null; nextId: string | null } {
    if (!centerId) return { prevId: null, nextId: null };
    const idx = chronological.findIndex((g) => g.id === centerId);
    if (idx < 0) return { prevId: null, nextId: null };
    return {
      prevId: idx > 0 ? chronological[idx - 1].id : null,
      nextId: idx < chronological.length - 1 ? chronological[idx + 1].id : null
    };
  }

  async function loadCenter(queryId: string | null) {
    loading = true;
    if (queryId) {
      center = (await getGame(queryId)) ?? null;
    } else {
      await currentGame.hydrateFromStorage();
      center = $currentGame.game;
    }
    loading = false;
  }

  // Externally-driven nav (direct URL, back/forward, deletion fallback).
  // Internal swipe nav sets loadedForId before goto so this is a no-op.
  $effect(() => {
    const queryId = id;
    if (queryId === loadedForId) return;
    loadedForId = queryId;
    void loadCenter(queryId ?? null);
  });

  // Neighbor effect — keeps prev/nextPanel in sync with center + the
  // chronological list. Runs again when history.refresh() lands or when
  // a swipe commit reassigns center. Skips fetches for slots whose id
  // already matches the loaded panel.
  $effect(() => {
    if (!center) {
      prevPanel = null;
      nextPanel = null;
      return;
    }
    // Track reactive deps explicitly.
    const _list = chronological;
    const centerId = center.id;
    const { prevId, nextId } = neighbors(centerId);
    if (prevPanel?.id !== prevId) {
      if (prevId) {
        void getGame(prevId).then((g) => {
          if (center?.id === centerId) prevPanel = g ?? null;
        });
      } else {
        prevPanel = null;
      }
    }
    if (nextPanel?.id !== nextId) {
      if (nextId) {
        void getGame(nextId).then((g) => {
          if (center?.id === centerId) nextPanel = g ?? null;
        });
      } else {
        nextPanel = null;
      }
    }
  });

  onMount(() => {
    history.refresh();
  });

  function goPrev() {
    if (prevPanel) goto(`${base}/game/done?id=${prevPanel.id}`);
  }
  function goNext() {
    if (nextPanel) goto(`${base}/game/done?id=${nextPanel.id}`);
  }

  async function rematch() {
    if (!center) return;
    const players: [string, string] = [center.players[0], center.players[1]];
    const targetScore = center.targetScore;
    const nextFirstDealer: 0 | 1 = (1 - center.firstDealerIndex) as 0 | 1;
    await currentGame.clear();
    await currentGame.start(players, targetScore, nextFirstDealer);
    goto(`${base}/game`);
  }

  let confirmingDelete = $state(false);

  async function doDelete() {
    if (!center) return;
    const fallback = nextPanel ?? prevPanel;
    await deleteGame(center.id);
    if (isCurrent) await currentGame.clear();
    await history.refresh();
    if (fallback) {
      goto(`${base}/game/done?id=${fallback.id}`);
    } else {
      goto(`${base}/`);
    }
  }

  // ---- Swipe gesture ---------------------------------------------------
  let dragX = $state(0);
  let dragging = $state(false);
  let snapping = $state(false);
  let startX = 0;
  let startY = 0;
  let decided: boolean | null = null;
  let committed = false;
  const EDGE_DEAD_ZONE = 24;
  const DIRECTION_THRESHOLD = 10;
  const COMMIT_RATIO = 0.3;
  const COMMIT_MS = 220;

  // Width of one carousel slot — used for commit thresholds + the final
  // commit translate distance. Measured from the track itself so panels
  // line up exactly even when .shell adds horizontal padding.
  let trackEl: HTMLElement | undefined = $state();
  let slotWidth = $state(390);
  onMount(() => {
    const update = () => {
      if (trackEl) slotWidth = trackEl.clientWidth;
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  });

  function onPointerDown(e: PointerEvent) {
    if (committed) return;
    if (e.clientX < EDGE_DEAD_ZONE) return;
    startX = e.clientX;
    startY = e.clientY;
    decided = null;
    dragging = true;
    snapping = false;
  }

  function onPointerMove(e: PointerEvent) {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (decided === null) {
      if (Math.abs(dx) > DIRECTION_THRESHOLD || Math.abs(dy) > DIRECTION_THRESHOLD) {
        decided = Math.abs(dx) > Math.abs(dy);
        if (!decided) {
          dragging = false;
          dragX = 0;
          return;
        }
        try {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
      }
    }
    if (decided) {
      if (dx < 0 && !nextPanel) dragX = dx * 0.25;
      else if (dx > 0 && !prevPanel) dragX = dx * 0.25;
      else dragX = dx;
    }
  }

  function onPointerUp() {
    if (!dragging) return;
    dragging = false;
    const threshold = slotWidth * COMMIT_RATIO;
    if (dragX <= -threshold && nextPanel) commitSwipe('next');
    else if (dragX >= threshold && prevPanel) commitSwipe('prev');
    else {
      snapping = true;
      dragX = 0;
      setTimeout(() => (snapping = false), 220);
    }
  }

  function commitSwipe(direction: 'prev' | 'next') {
    committed = true;
    snapping = true;
    dragX = direction === 'next' ? -slotWidth : slotWidth;
    setTimeout(() => {
      // Atomic swap: rebind which game lives in which slot, then reset
      // the track translate without a transition. The newly-shown panel
      // is the one that animated to centre, so visually nothing jumps.
      const oldCenter = center;
      let newCenter: Game | null = null;
      if (direction === 'next') {
        newCenter = nextPanel;
        if (!newCenter) return;
        prevPanel = oldCenter;
        center = newCenter;
        nextPanel = null;
      } else {
        newCenter = prevPanel;
        if (!newCenter) return;
        nextPanel = oldCenter;
        center = newCenter;
        prevPanel = null;
      }
      snapping = false;
      dragX = 0;
      committed = false;
      // Sync URL without provoking a re-fetch of the center game. The
      // neighbor effect will load the new far-side neighbor reactively.
      loadedForId = newCenter.id;
      void goto(`${base}/game/done?id=${newCenter.id}`, {
        replaceState: true,
        noScroll: true,
        keepFocus: true
      });
    }, COMMIT_MS);
  }
</script>

<div class="top-bar">
  <BackButton href="{base}/" />
  <div class="nav-group">
    <button
      type="button"
      class="nav-btn"
      aria-label="Previous match"
      disabled={!prevPanel}
      onclick={goPrev}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="11" fill="rgba(255, 255, 255, 0.5)" />
        <path
          d="M 13.6 7 L 8.6 12 L 13.6 17"
          stroke="var(--bg-dark)"
          stroke-width="2.4"
          fill="none"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </button>
    <button
      type="button"
      class="nav-btn"
      aria-label="Next match"
      disabled={!nextPanel}
      onclick={goNext}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="11" fill="rgba(255, 255, 255, 0.5)" />
        <path
          d="M 10.4 7 L 15.4 12 L 10.4 17"
          stroke="var(--bg-dark)"
          stroke-width="2.4"
          fill="none"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </button>
  </div>
</div>

<div class="carousel-viewport">
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="track"
    class:snapping
    bind:this={trackEl}
    style="transform: translateX({dragX}px)"
    onpointerdown={onPointerDown}
    onpointermove={onPointerMove}
    onpointerup={onPointerUp}
    onpointercancel={onPointerUp}
  >
    {#if prevPanel}
      <div class="panel side prev" aria-hidden="true">
        <MatchView game={prevPanel} />
      </div>
    {/if}

    <div class="panel center">
      {#if loading && !center}
        <p class="loading">Loading…</p>
      {:else if center}
        <MatchView
          game={center}
          interactive
          onRematch={rematch}
          onDelete={() => (confirmingDelete = true)}
        />
      {:else}
        <p class="loading">Match not found.</p>
      {/if}
    </div>

    {#if nextPanel}
      <div class="panel side next" aria-hidden="true">
        <MatchView game={nextPanel} />
      </div>
    {/if}
  </div>
</div>

{#if confirmingDelete}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="modal-overlay"
    onclick={(e) => {
      if (e.target === e.currentTarget) confirmingDelete = false;
    }}
  >
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="delete-title">
      <h2 id="delete-title">Delete this match?</h2>
      <p class="modal-body">This can't be undone.</p>
      <div class="modal-actions">
        <button type="button" class="btn-secondary" onclick={() => (confirmingDelete = false)}>Cancel</button>
        <button type="button" class="btn-danger" onclick={doDelete}>Delete</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .top-bar {
    position: sticky;
    top: calc(env(safe-area-inset-top) + 8px);
    z-index: 100;
    padding-top: 8px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .nav-group {
    display: flex;
    gap: 8px;
  }
  .nav-btn {
    width: 32px;
    height: 32px;
    padding: 0;
    border: none;
    background: none;
    cursor: pointer;
    touch-action: manipulation;
    transition: transform 0.15s, opacity 0.15s;
  }
  .nav-btn:hover:not(:disabled) {
    filter: brightness(1.1);
  }
  .nav-btn:active:not(:disabled) {
    transform: scale(0.94);
  }
  .nav-btn:disabled {
    opacity: 0.3;
    cursor: default;
  }
  .nav-btn svg {
    width: 100%;
    height: 100%;
    display: block;
  }

  /* Viewport clips horizontally; prev/next panels live at ±100vw so they
     never spill into view until the track translates. */
  .carousel-viewport {
    position: relative;
    overflow-x: hidden;
  }

  .track {
    position: relative;
    will-change: transform;
    touch-action: pan-y;
  }
  .track.snapping {
    transition: transform 0.22s cubic-bezier(0.32, 0.72, 0.24, 1);
  }

  /* The centre panel is in normal flow so it sets the track's height.
     The side panels are absolute, match the track width via 100%, and
     pin one full slot off-screen on either side via left/right: 100%. */
  .panel.center {
    position: relative;
  }
  .panel.side {
    position: absolute;
    top: 0;
    width: 100%;
  }
  .panel.side.prev {
    right: 100%;
  }
  .panel.side.next {
    left: 100%;
  }

  .loading {
    text-align: center;
    color: var(--text-muted);
    margin-top: 48px;
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

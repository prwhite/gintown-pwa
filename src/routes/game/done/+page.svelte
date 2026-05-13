<script lang="ts">
  import { base } from '$app/paths';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import HandRow from '$lib/components/HandRow.svelte';
  import BackButton from '$lib/components/BackButton.svelte';
  import { currentGame } from '$lib/stores/currentGame';
  import { deleteGame, getGame, type Game } from '$lib/db';
  import { history } from '$lib/stores/history';
  import { dealerIndexFor, totalFor } from '$lib/scoring';

  // ---- URL-driven game loading -----------------------------------------
  let id = $derived($page.url.searchParams.get('id'));
  let isCurrent = $derived(!id);

  let game = $state<Game | null>(null);
  let loading = $state(true);

  // Re-runs when `id` changes (e.g. via prev/next nav or swipe). The
  // component itself stays mounted; we just refetch by id.
  $effect(() => {
    const queryId = id;
    loading = true;
    (async () => {
      if (queryId) {
        game = (await getGame(queryId)) ?? null;
      } else {
        await currentGame.hydrateFromStorage();
        game = $currentGame.game;
      }
      loading = false;
    })();
  });

  onMount(() => {
    history.refresh();
  });

  // ---- Adjacency in chronological order --------------------------------
  // History is newest-first; we sort oldest → newest for the carousel
  // mental model (drag-left = newer = right, drag-right = older = left).
  let chronological = $derived(
    [...$history].sort((a, b) => a.createdAt - b.createdAt)
  );
  let currentIdx = $derived(id ? chronological.findIndex((g) => g.id === id) : -1);
  let prevGame = $derived(currentIdx > 0 ? chronological[currentIdx - 1] : null);
  let nextGame = $derived(
    currentIdx >= 0 && currentIdx < chronological.length - 1
      ? chronological[currentIdx + 1]
      : null
  );

  function goPrev() {
    if (prevGame) goto(`${base}/game/done?id=${prevGame.id}`);
  }
  function goNext() {
    if (nextGame) goto(`${base}/game/done?id=${nextGame.id}`);
  }

  let totals = $derived<[number, number]>(
    game ? [totalFor(game.hands, 0), totalFor(game.hands, 1)] : [0, 0]
  );

  async function rematch() {
    if (!game) return;
    const players: [string, string] = [game.players[0], game.players[1]];
    const targetScore = game.targetScore;
    const nextFirstDealer: 0 | 1 = (1 - game.firstDealerIndex) as 0 | 1;
    await currentGame.clear();
    await currentGame.start(players, targetScore, nextFirstDealer);
    goto(`${base}/game`);
  }

  let confirmingDelete = $state(false);

  async function doDelete() {
    if (!game) return;
    // Pick an adjacent match to surface after deletion so the user stays in
    // the match-browsing flow rather than getting kicked back to main.
    const fallback = nextGame ?? prevGame;
    await deleteGame(game.id);
    if (isCurrent) await currentGame.clear();
    await history.refresh();
    if (fallback) {
      goto(`${base}/game/done?id=${fallback.id}`);
    } else {
      goto(`${base}/`);
    }
  }

  // ---- Swipe gesture ---------------------------------------------------
  // Page-level horizontal swipe navigates to the prev/next match.
  // Mirrors SwipeRow's direction-arbitration but at the page scope.
  let dragX = $state(0);
  let dragging = $state(false);
  let snapping = $state(false);
  let startX = 0;
  let startY = 0;
  let decided: boolean | null = null;
  let committed = false; // true while playing the commit animation
  // Left-edge band reserved for Safari's "swipe-back" gesture.
  const EDGE_DEAD_ZONE = 24;
  const DIRECTION_THRESHOLD = 10; // px before we lock into horizontal/vertical
  const COMMIT_RATIO = 0.3; // of viewport width
  const COMMIT_MS = 200;

  let viewportWidth = $state(390);
  onMount(() => {
    viewportWidth = window.innerWidth;
    const onResize = () => (viewportWidth = window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  });

  function onPointerDown(e: PointerEvent) {
    if (committed) return;
    if (e.clientX < EDGE_DEAD_ZONE) return; // let iOS Safari own the back gesture
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
          // Vertical wins — release so the page scrolls normally.
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
      // Rubber-band at the ends so the user feels the boundary.
      if (dx < 0 && !nextGame) dragX = dx * 0.25;
      else if (dx > 0 && !prevGame) dragX = dx * 0.25;
      else dragX = dx;
    }
  }

  function onPointerUp() {
    if (!dragging) return;
    dragging = false;
    const threshold = viewportWidth * COMMIT_RATIO;
    if (dragX <= -threshold && nextGame) commitSwipe('next');
    else if (dragX >= threshold && prevGame) commitSwipe('prev');
    else {
      snapping = true;
      dragX = 0;
      setTimeout(() => (snapping = false), 180);
    }
  }

  function commitSwipe(direction: 'prev' | 'next') {
    committed = true;
    snapping = true;
    dragX = direction === 'next' ? -viewportWidth : viewportWidth;
    setTimeout(() => {
      if (direction === 'next') goNext();
      else goPrev();
      // After URL nav, snap transform back to 0 (no transition) so the new
      // game's content renders at the natural position.
      requestAnimationFrame(() => {
        snapping = false;
        dragX = 0;
        committed = false;
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
      disabled={!prevGame}
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
      disabled={!nextGame}
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

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="swipe-surface"
  class:snapping
  style="transform: translateX({dragX}px)"
  onpointerdown={onPointerDown}
  onpointermove={onPointerMove}
  onpointerup={onPointerUp}
  onpointercancel={onPointerUp}
>
  {#if loading}
    <p class="loading">Loading…</p>
  {:else if game}
    <header class="hero" class:in-progress={game.winner === null}>
      <img src="{base}/splash/ace-spades.png" alt="" class="splash" />
      {#if game.winner !== null}
        <h1>{game.players[game.winner]} wins!</h1>
        <p class="subtitle">First to {game.targetScore} · {game.hands.length} hands</p>
      {:else}
        <h1 class="in-progress-title">In progress</h1>
        <p class="subtitle">to {game.targetScore} · {game.hands.length} hand{game.hands.length === 1 ? '' : 's'}</p>
      {/if}
    </header>

    {#if game.hands.length > 0}
      <section class="hands">
        <h2>Hand history</h2>
        <ul>
          {#each game.hands as hand (hand.index)}
            <li>
              <HandRow
                {hand}
                players={game.players}
                dealerIndex={dealerIndexFor(game.firstDealerIndex, hand.index)}
              />
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    <section class="totals">
      {#each [0, 1] as i (i)}
        <div class="total" class:winner={game.winner === i}>
          <div class="name">{game.players[i]}</div>
          <div class="score">{totals[i]}</div>
        </div>
      {/each}
    </section>

    <section class="actions">
      {#if game.winner !== null}
        <button type="button" class="btn-secondary" onclick={rematch}>Rematch</button>
      {/if}
      <button type="button" class="btn-secondary" onclick={() => (confirmingDelete = true)}>Delete</button>
    </section>

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
  {:else}
    <p class="loading">Match not found.</p>
  {/if}
</div>

<style>
  /* Top bar is sticky, holds BackButton + prev/next nav buttons. */
  .top-bar {
    position: sticky;
    top: calc(env(safe-area-inset-top) + 8px);
    z-index: 100;
    padding-top: 8px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    pointer-events: none;
  }
  .top-bar > * {
    pointer-events: auto;
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

  /* Swipe surface — translates horizontally with the gesture; transitions
     only when `snapping` is on (snap-back or commit-animation). */
  .swipe-surface {
    will-change: transform;
    touch-action: pan-y; /* allow vertical scroll, let us own horizontal */
  }
  .swipe-surface.snapping {
    transition: transform 0.22s cubic-bezier(0.32, 0.72, 0.24, 1);
  }

  .loading {
    text-align: center;
    color: var(--text-muted);
    margin-top: 48px;
  }

  .hero {
    text-align: center;
    padding: 24px 0 16px;
    animation: hero-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  @keyframes hero-in {
    0% {
      opacity: 0;
      transform: scale(1.15) rotate(-1.5deg);
    }
    100% {
      opacity: 1;
      transform: scale(1) rotate(0deg);
    }
  }

  .splash {
    width: 80px;
    height: auto;
    filter: drop-shadow(0 8px 18px rgba(251, 191, 36, 0.32));
    margin-bottom: 10px;
  }

  .hero.in-progress .splash {
    filter: drop-shadow(0 4px 10px rgba(0, 0, 0, 0.5));
  }

  h1 {
    font-size: 26px;
    color: var(--warning);
    margin-bottom: 6px;
    text-shadow: 0 0 24px rgba(251, 191, 36, 0.3);
  }

  .in-progress-title {
    font-size: 22px;
    color: var(--text-muted);
    text-shadow: none;
  }

  .subtitle {
    color: var(--text-muted);
    font-size: 13px;
  }

  .hands {
    margin: 20px 0 16px;
  }

  .hands h2 {
    font-size: 11px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 6px;
  }

  .hands ul {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .totals {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin: 12px 0 16px;
  }

  .total {
    padding: 16px;
    background: rgba(255, 255, 255, 0.04);
    border-radius: var(--radius-md);
    text-align: center;
    border: 2px solid transparent;
  }

  .total.winner {
    border-color: var(--warning);
    background: rgba(251, 191, 36, 0.08);
  }

  .total .name {
    font-size: 12px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 6px;
  }

  .total.winner .name {
    color: var(--warning);
  }

  .total .score {
    font-family: ui-monospace, 'SF Mono', Menlo, monospace;
    font-size: 36px;
    font-weight: 700;
    line-height: 1;
  }

  .total.winner .score {
    color: var(--warning);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;
    margin-top: 8px;
    padding-top: 12px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }

  .actions button {
    padding: 8px 18px;
    font-size: 13px;
    font-weight: 600;
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

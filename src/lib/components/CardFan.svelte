<script lang="ts">
  /**
   * Decorative fanned hand of cards that reshuffles on an interval.
   *
   * Animation strategy: we drive every frame ourselves via rAF rather than
   * letting CSS transitions interpolate. That lets us reassign z-index per
   * frame based on each card's *current* x-position — so during a swap the
   * stack stays left-on-bottom / right-on-top at every moment, never having
   * a card "snap" to its final z-order before its transform catches up.
   *
   * The DOM order of the rendered cards is fixed (keyed by card name). We
   * only mutate per-actor x/rot/z; nothing reorders in the DOM.
   *
   * Honors prefers-reduced-motion (initial deal renders, no resort timer).
   */
  import { base } from '$app/paths';
  import { onDestroy, onMount } from 'svelte';

  interface Props {
    handSize?: number;
    intervalMs?: number;
    cardWidth?: number;
    durationMs?: number;
  }

  let {
    handSize = 10,
    intervalMs = 5000,
    cardWidth = 44,
    durationMs = 900
  }: Props = $props();

  const SUITS = ['C', 'D', 'H', 'S'] as const;
  const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const;
  const STRIDE_PX = 11;
  const ROT_DEG = 4.5;

  interface Actor {
    card: string;
    x: number;
    rot: number;
    z: number;
    fromX: number;
    fromRot: number;
    toX: number;
    toRot: number;
  }

  function fullDeck(): string[] {
    const out: string[] = [];
    for (const r of RANKS) for (const s of SUITS) out.push(`${r}${s}`);
    return out;
  }

  function shuffleInPlace<T>(a: T[]): T[] {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function pickHand(n: number): string[] {
    return shuffleInPlace(fullDeck()).slice(0, n);
  }

  function xForSlot(slot: number, size: number): number {
    return (slot - (size - 1) / 2) * STRIDE_PX;
  }
  function rotForSlot(slot: number, size: number): number {
    return (slot - (size - 1) / 2) * ROT_DEG;
  }

  function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }
  function easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  // svelte-ignore state_referenced_locally
  let actors = $state<Actor[]>(
    pickHand(handSize).map((card, i) => {
      const x = xForSlot(i, handSize);
      const rot = rotForSlot(i, handSize);
      return { card, x, rot, z: i, fromX: x, fromRot: rot, toX: x, toRot: rot };
    })
  );

  let raf: number | null = null;
  let animStart = 0;
  let timer: ReturnType<typeof setInterval> | undefined;
  let reduceMotion = $state(false);

  function reassignZByX() {
    const sorted = [...actors].sort((a, b) => a.x - b.x);
    sorted.forEach((a, i) => {
      a.z = i;
    });
  }

  function startShuffle() {
    const n = actors.length;
    // Build a new permutation of slot indices and assign each actor a target.
    // Reroll until at least half the actors actually move (avoids no-op shuffles).
    let perm = shuffleInPlace([...Array(n).keys()]);
    let attempts = 0;
    while (attempts < 5) {
      const moved = perm.filter((slot, i) => xForSlot(slot, n) !== actors[i].toX).length;
      if (moved >= Math.ceil(n / 2)) break;
      perm = shuffleInPlace([...Array(n).keys()]);
      attempts++;
    }

    actors.forEach((a, i) => {
      a.fromX = a.x;
      a.fromRot = a.rot;
      a.toX = xForSlot(perm[i], n);
      a.toRot = rotForSlot(perm[i], n);
    });
    animStart = performance.now();
    if (raf !== null) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(tick);
  }

  function tick(now: number) {
    const t = Math.min(1, (now - animStart) / durationMs);
    const e = easeInOutCubic(t);
    for (const a of actors) {
      a.x = lerp(a.fromX, a.toX, e);
      a.rot = lerp(a.fromRot, a.toRot, e);
    }
    reassignZByX();
    if (t < 1) {
      raf = requestAnimationFrame(tick);
    } else {
      raf = null;
    }
  }

  onMount(() => {
    if (typeof window !== 'undefined') {
      reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    if (reduceMotion) return;
    timer = setInterval(startShuffle, intervalMs);
  });

  onDestroy(() => {
    if (timer) clearInterval(timer);
    if (raf !== null) cancelAnimationFrame(raf);
  });
</script>

<div class="fan" style="--card-w: {cardWidth}px;">
  {#each actors as actor (actor.card)}
    <img
      class="card"
      src="{base}/cards/{actor.card}.png"
      alt=""
      aria-hidden="true"
      draggable="false"
      style="
        transform: translateX(calc(-50% + {actor.x}px)) rotate({actor.rot}deg);
        z-index: {actor.z};
      "
    />
  {/each}
</div>

<style>
  .fan {
    position: relative;
    height: calc(var(--card-w) * 1.42 + 18px);
    margin: 0 auto 8px;
    pointer-events: none;
    user-select: none;
  }

  .card {
    position: absolute;
    left: 50%;
    bottom: 0;
    width: var(--card-w);
    height: auto;
    transform-origin: 50% 95%;
    filter: drop-shadow(0 4px 10px rgba(0, 0, 0, 0.45));
    will-change: transform;
  }
</style>

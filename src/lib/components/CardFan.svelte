<script lang="ts">
  /**
   * Decorative fanned hand of ten cards at the top of the main page that
   * re-sorts on a fixed interval. Honors `prefers-reduced-motion`.
   */
  import { base } from '$app/paths';
  import { onDestroy, onMount } from 'svelte';

  interface Props {
    handSize?: number;
    intervalMs?: number;
    cardWidth?: number;
  }

  let { handSize = 10, intervalMs = 5000, cardWidth = 44 }: Props = $props();

  const SUITS = ['C', 'D', 'H', 'S'] as const;
  const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const;

  function fullDeck(): string[] {
    const out: string[] = [];
    for (const r of RANKS) for (const s of SUITS) out.push(`${r}${s}`);
    return out;
  }

  function shuffleInPlace<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function pickHand(size: number): string[] {
    return shuffleInPlace(fullDeck()).slice(0, size);
  }

  // svelte-ignore state_referenced_locally — handSize is set once at mount,
  // not expected to change reactively.
  let cards = $state<string[]>(pickHand(handSize));
  let timer: ReturnType<typeof setInterval> | undefined;
  let reduceMotion = $state(false);

  // Layout math: cards rotate around their bottom-center so they fan upward
  // and outward like a held hand. Stride/rotation derive from handSize.
  const center = $derived((handSize - 1) / 2);
  const rotPerCard = 4.5; // degrees per index step
  const stridePx = 11;    // horizontal stride per index step

  onMount(() => {
    if (typeof window !== 'undefined') {
      reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    if (reduceMotion) return; // don't auto-resort if the OS asks us not to animate
    const size = handSize;
    timer = setInterval(() => {
      // Mostly resort the same hand; occasionally swap in a fresh draw for variety.
      cards = Math.random() < 0.15 ? pickHand(size) : shuffleInPlace([...cards]);
    }, intervalMs);
  });

  onDestroy(() => {
    if (timer) clearInterval(timer);
  });
</script>

<div class="fan" style="--card-w: {cardWidth}px;">
  {#each cards as card, i (card)}
    {@const offset = i - center}
    <img
      class="card"
      src="{base}/cards/{card}.png"
      alt=""
      aria-hidden="true"
      draggable="false"
      style="
        transform: translateX(calc(-50% + {offset * stridePx}px)) rotate({offset * rotPerCard}deg);
        z-index: {handSize - Math.round(Math.abs(offset))};
      "
    />
  {/each}
</div>

<style>
  .fan {
    position: relative;
    height: calc(var(--card-w) * 1.42 + 18px); /* card aspect 0.71:1 + lift */
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
    transition: transform 0.7s cubic-bezier(0.4, 0, 0.2, 1);
    filter: drop-shadow(0 4px 10px rgba(0, 0, 0, 0.45));
    will-change: transform;
  }
</style>

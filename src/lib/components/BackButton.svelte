<script lang="ts">
  /**
   * Consistent "home" affordance used in the top-left of all sub-pages.
   * Approximates SF Symbol `house.circle.fill` — a 50% alpha white circle
   * with a dark house glyph cut through it. Visually distinct from the
   * prev/next chevron buttons used for match-history navigation.
   */
  interface Props {
    href: string;
    label?: string;
    size?: number;
    onclick?: (e: MouseEvent) => void;
  }
  let { href, label = 'Back', size = 32, onclick }: Props = $props();
</script>

<a {href} aria-label={label} class="back-btn" style="--size: {size}px;" data-sveltekit-preload-data="off" {onclick}>
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="11" fill="rgba(255, 255, 255, 0.5)" />
    <!-- Simple house: pitched roof + rectangular body. -->
    <path
      d="M 6.5 11.5 L 12 7 L 17.5 11.5 L 17.5 17 L 6.5 17 Z"
      stroke="var(--bg-dark)"
      stroke-width="1.8"
      fill="none"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
</a>

<style>
  .back-btn {
    display: inline-flex;
    width: var(--size);
    height: var(--size);
    text-decoration: none;
    transition: transform 0.15s, filter 0.15s;
    touch-action: manipulation;
  }
  .back-btn:hover {
    filter: brightness(1.1);
  }
  .back-btn:active {
    transform: scale(0.94);
  }
  svg {
    width: 100%;
    height: 100%;
    display: block;
  }
</style>

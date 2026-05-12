<script lang="ts">
  /**
   * Small circular button approximating the SF Symbol
   * `chart.line.uptrend.xyaxis.circle.fill`. Used as the per-card stats trigger.
   */
  interface Props {
    onclick?: (e: MouseEvent) => void;
    label?: string;
    size?: number;
  }
  let { onclick, label = 'View stats', size = 32 }: Props = $props();
</script>

<button
  type="button"
  class="stats-btn"
  style="width: {size}px; height: {size}px;"
  aria-label={label}
  {onclick}
>
  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <circle cx="12" cy="12" r="11" fill="currentColor" />
    <g stroke="rgba(255, 255, 255, 0.92)" fill="none" stroke-linecap="round" stroke-linejoin="round">
      <path d="M 7 7 L 7 17 L 17 17" stroke-width="1.2" />
      <path d="M 8.5 14.5 L 11 12 L 13 13.5 L 16.5 8" stroke-width="1.7" />
    </g>
  </svg>
</button>

<style>
  .stats-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    border: none;
    background: none;
    /* Full blue for the circle; opacity dimming applied to the whole button
       so the white chart lines fade with it (otherwise they read too hot). */
    color: rgb(80, 140, 220);
    opacity: 0.5;
    cursor: pointer;
    touch-action: manipulation;
    transition: opacity 0.15s, transform 0.15s;
  }
  .stats-btn:hover {
    opacity: 0.85;
  }
  .stats-btn:active {
    transform: scale(0.94);
  }
  svg {
    width: 100%;
    height: 100%;
    display: block;
  }
</style>

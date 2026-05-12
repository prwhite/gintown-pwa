<script lang="ts">
  /**
   * Small circular folder-in-circle icon (SF Symbol `folder.circle.fill`-alike).
   * Triggers the import/export modal. Sits in normal page flow at the top of
   * the main page, right-aligned. Same dim treatment as StatsButton but in a
   * muted gold so the two buttons are distinguishable at a glance.
   */
  interface Props {
    onclick?: (e: MouseEvent) => void;
    label?: string;
    size?: number;
  }
  let { onclick, label = 'Backup and import', size = 32 }: Props = $props();
</script>

<button
  type="button"
  class="history-btn"
  style="width: {size}px; height: {size}px;"
  aria-label={label}
  {onclick}
>
  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <circle cx="12" cy="12" r="11" fill="currentColor" />
    <g fill="rgba(255, 255, 255, 0.92)" stroke="rgba(255, 255, 255, 0.92)" stroke-linejoin="round">
      <path
        d="M 7 9.5 L 7 16.5 Q 7 17 7.5 17 L 16.5 17 Q 17 17 17 16.5 L 17 10 Q 17 9.5 16.5 9.5 L 12.2 9.5 L 11 8 L 7.5 8 Q 7 8 7 8.5 Z"
        stroke-width="0.6"
      />
    </g>
  </svg>
</button>

<style>
  .history-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    border: none;
    background: none;
    color: var(--warning); /* muted gold via opacity below */
    opacity: 0.5;
    cursor: pointer;
    touch-action: manipulation;
    transition: opacity 0.15s, transform 0.15s;
  }
  .history-btn:hover {
    opacity: 0.85;
  }
  .history-btn:active {
    transform: scale(0.94);
  }
  svg {
    width: 100%;
    height: 100%;
    display: block;
  }
</style>

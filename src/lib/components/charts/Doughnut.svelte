<script lang="ts">
  /**
   * Simple multi-segment doughnut. Uses SVG strokes with dasharray/offset so
   * each segment is a rotational slice of the full ring.
   */
  interface Segment {
    label: string;
    value: number;
    color: string;
  }
  interface Props {
    segments: Segment[];
    size?: number;
    thickness?: number;
    centerLabel?: string;
    centerSubLabel?: string;
  }

  let {
    segments,
    size = 160,
    thickness = 22,
    centerLabel,
    centerSubLabel
  }: Props = $props();

  let total = $derived(segments.reduce((s, x) => s + x.value, 0));
  const cx = $derived(size / 2);
  const r = $derived(size / 2 - thickness / 2);
  const circ = $derived(2 * Math.PI * r);

  let arcs = $derived(() => {
    if (total === 0) return [];
    let off = 0;
    const out: { color: string; dasharray: string; dashoffset: number }[] = [];
    for (const seg of segments) {
      const len = (seg.value / total) * circ;
      out.push({
        color: seg.color,
        dasharray: `${len} ${circ - len}`,
        dashoffset: -off
      });
      off += len;
    }
    return out;
  });

  function pct(value: number): string {
    return total ? `${Math.round((100 * value) / total)}%` : '0%';
  }
</script>

<div class="doughnut">
  <svg viewBox="0 0 {size} {size}" width={size} height={size} role="img" aria-label="doughnut chart">
    <circle
      cx={cx}
      cy={cx}
      r={r}
      fill="none"
      stroke="rgba(255, 255, 255, 0.06)"
      stroke-width={thickness}
    />
    {#each arcs() as arc, i (i)}
      <circle
        cx={cx}
        cy={cx}
        r={r}
        fill="none"
        stroke={arc.color}
        stroke-width={thickness}
        stroke-dasharray={arc.dasharray}
        stroke-dashoffset={arc.dashoffset}
        transform="rotate(-90 {cx} {cx})"
        stroke-linecap="butt"
      />
    {/each}
    {#if centerLabel}
      <text class="center-label" x={cx} y={cx - 2} text-anchor="middle" dominant-baseline="middle">
        {centerLabel}
      </text>
    {/if}
    {#if centerSubLabel}
      <text class="center-sublabel" x={cx} y={cx + 14} text-anchor="middle" dominant-baseline="middle">
        {centerSubLabel}
      </text>
    {/if}
  </svg>
  <ul class="legend">
    {#each segments as seg, i (i)}
      <li>
        <span class="swatch" style="background: {seg.color}"></span>
        <span class="seg-label">{seg.label}</span>
        <span class="seg-value">{seg.value} <span class="muted">({pct(seg.value)})</span></span>
      </li>
    {/each}
  </ul>
</div>

<style>
  .doughnut {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
  }
  svg {
    display: block;
  }
  .center-label {
    font-family: ui-monospace, 'SF Mono', Menlo, monospace;
    font-size: 22px;
    font-weight: 700;
    fill: var(--text);
  }
  .center-sublabel {
    font-size: 10px;
    fill: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .legend {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 12px;
    width: 100%;
    max-width: 260px;
  }
  .legend li {
    display: grid;
    grid-template-columns: 12px 1fr auto;
    gap: 8px;
    align-items: center;
  }
  .swatch {
    width: 10px;
    height: 10px;
    border-radius: 2px;
  }
  .seg-label {
    color: var(--text);
  }
  .seg-value {
    font-family: ui-monospace, 'SF Mono', Menlo, monospace;
    font-weight: 600;
    color: var(--text);
  }
  .muted {
    color: var(--text-muted);
    font-weight: 400;
  }
</style>

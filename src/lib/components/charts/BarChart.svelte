<script lang="ts">
  /**
   * Generic bar chart — handles vertical/horizontal × grouped/stacked × signed.
   *
   *   labels      categorical labels, one per "group"
   *   datasets    [{ label, color, data: number[] }] (data.length === labels.length)
   *   orientation 'vertical' (default) | 'horizontal'
   *   stacked     false (default — grouped side-by-side) | true
   *   showLegend  true (default) — shows below the chart when multiple datasets
   *   yLabel      optional axis title
   */

  interface Dataset {
    label: string;
    /** Single color, OR a function that picks a color per-bar (e.g. sign-based). */
    color: string | ((value: number, labelIndex: number) => string);
    data: number[];
  }
  interface Props {
    labels: string[];
    datasets: Dataset[];
    orientation?: 'vertical' | 'horizontal';
    stacked?: boolean;
    showLegend?: boolean;
    height?: number;
    yLabel?: string;
    xLabel?: string;
  }

  let {
    labels,
    datasets,
    orientation = 'vertical',
    stacked = false,
    showLegend = true,
    height = 220,
    yLabel,
    xLabel
  }: Props = $props();

  function barColor(ds: Dataset, value: number, idx: number): string {
    return typeof ds.color === 'function' ? ds.color(value, idx) : ds.color;
  }

  // Compute domain min/max across all values (supports signed bars).
  let domain = $derived(() => {
    const allVals: number[] = [];
    if (stacked) {
      // Sum per label across positive and negative independently.
      for (let i = 0; i < labels.length; i++) {
        let pos = 0;
        let neg = 0;
        for (const d of datasets) {
          const v = d.data[i] ?? 0;
          if (v >= 0) pos += v;
          else neg += v;
        }
        allVals.push(pos, neg);
      }
    } else {
      for (const d of datasets) for (const v of d.data) allVals.push(v);
    }
    let min = Math.min(0, ...allVals);
    let max = Math.max(0, ...allVals);
    if (min === max) max = max + 1;
    return { min, max };
  });

  // Numeric axis ticks (~4 evenly-spaced rounded values across the domain).
  let ticks = $derived(() => {
    const { min, max } = domain();
    const span = max - min;
    const step = niceStep(span / 4);
    const start = Math.ceil(min / step) * step;
    const out: number[] = [];
    for (let v = start; v <= max + 0.0001; v += step) out.push(Number(v.toFixed(2)));
    if (min < 0 && !out.includes(0)) out.push(0);
    return out.sort((a, b) => a - b);
  });

  function niceStep(raw: number): number {
    if (raw <= 0) return 1;
    const pow = Math.pow(10, Math.floor(Math.log10(raw)));
    const m = raw / pow;
    let n: number;
    if (m < 1.5) n = 1;
    else if (m < 3) n = 2;
    else if (m < 7) n = 5;
    else n = 10;
    return n * pow;
  }

  // ---- Vertical layout ----
  const padding = { top: 8, right: 12, bottom: 28, left: 36 };
  let vWidth = $derived(Math.max(240, labels.length * 38 + padding.left + padding.right));
  let chartH = $derived(height - padding.top - padding.bottom);
  let chartW = $derived(vWidth - padding.left - padding.right);

  function vYofValue(value: number): number {
    const { min, max } = domain();
    return padding.top + chartH - ((value - min) / (max - min)) * chartH;
  }

  let vGroupWidth = $derived(labels.length ? chartW / labels.length : 0);

  // ---- Horizontal layout ----
  const hPadding = { top: 4, right: 12, bottom: 24, left: 110 };
  let hHeight = $derived(Math.max(80, labels.length * 38 + hPadding.top + hPadding.bottom));
  let hChartH = $derived(hHeight - hPadding.top - hPadding.bottom);
  let hRowHeight = $derived(labels.length ? hChartH / labels.length : 0);
  let hWidth = $derived(360);
  let hChartW = $derived(hWidth - hPadding.left - hPadding.right);

  function hXofValue(value: number): number {
    const { min, max } = domain();
    return hPadding.left + ((value - min) / (max - min)) * hChartW;
  }
</script>

{#if orientation === 'vertical'}
  <div class="bar-wrap">
    <svg viewBox="0 0 {vWidth} {height}" width="100%" preserveAspectRatio="xMidYMid meet">
      <!-- y-axis gridlines + ticks -->
      {#each ticks() as t (t)}
        <line
          x1={padding.left}
          x2={vWidth - padding.right}
          y1={vYofValue(t)}
          y2={vYofValue(t)}
          stroke="rgba(255, 255, 255, 0.06)"
          stroke-width="1"
        />
        <text
          class="axis-text"
          x={padding.left - 6}
          y={vYofValue(t) + 3}
          text-anchor="end"
        >{t}</text>
      {/each}

      <!-- zero line accent if domain spans zero -->
      {#if domain().min < 0}
        <line
          x1={padding.left}
          x2={vWidth - padding.right}
          y1={vYofValue(0)}
          y2={vYofValue(0)}
          stroke="rgba(255, 255, 255, 0.18)"
          stroke-width="1"
        />
      {/if}

      <!-- bars -->
      {#each labels as label, gi (label + '_' + gi)}
        {@const groupX = padding.left + gi * vGroupWidth}
        {#if stacked}
          {@const _ = null}
          <!-- stacked: pile bars vertically by sign -->
          {#each datasets as ds, di (ds.label + '_' + di)}
            {@const v = ds.data[gi] ?? 0}
            {@const stackBelow = datasets
              .slice(0, di)
              .reduce((s, d) => s + ((d.data[gi] ?? 0) >= 0 === v >= 0 ? (d.data[gi] ?? 0) : 0), 0)}
            {@const yTop = vYofValue(stackBelow + Math.max(v, 0))}
            {@const yBot = vYofValue(stackBelow + Math.min(v, 0))}
            <rect
              x={groupX + vGroupWidth * 0.15}
              y={Math.min(yTop, yBot)}
              width={vGroupWidth * 0.7}
              height={Math.abs(yBot - yTop)}
              fill={barColor(ds, v, gi)}
              rx="2"
            />
          {/each}
        {:else}
          {@const slotW = (vGroupWidth * 0.78) / Math.max(1, datasets.length)}
          {#each datasets as ds, di (ds.label + '_' + di)}
            {@const v = ds.data[gi] ?? 0}
            {@const x0 = groupX + vGroupWidth * 0.11 + di * slotW}
            {@const yTop = vYofValue(Math.max(v, 0))}
            {@const yBot = vYofValue(Math.min(v, 0))}
            <rect
              x={x0}
              y={Math.min(yTop, yBot)}
              width={slotW * 0.86}
              height={Math.max(1, Math.abs(yBot - yTop))}
              fill={barColor(ds, v, gi)}
              rx="2"
            />
          {/each}
        {/if}

        <!-- category label -->
        <text
          class="axis-text"
          x={groupX + vGroupWidth / 2}
          y={height - 8}
          text-anchor="middle"
        >{label}</text>
      {/each}

      {#if yLabel}
        <text class="axis-title" x={12} y={padding.top + 4} text-anchor="start">{yLabel}</text>
      {/if}
      {#if xLabel}
        <text class="axis-title" x={vWidth - 6} y={height - 22} text-anchor="end">{xLabel}</text>
      {/if}
    </svg>
  </div>
{:else}
  <div class="bar-wrap">
    <svg viewBox="0 0 {hWidth} {hHeight}" width="100%" preserveAspectRatio="xMidYMid meet">
      {#each ticks() as t (t)}
        <line
          x1={hXofValue(t)}
          x2={hXofValue(t)}
          y1={hPadding.top}
          y2={hHeight - hPadding.bottom}
          stroke="rgba(255, 255, 255, 0.06)"
          stroke-width="1"
        />
        <text
          class="axis-text"
          x={hXofValue(t)}
          y={hHeight - hPadding.bottom + 14}
          text-anchor="middle"
        >{t}</text>
      {/each}

      {#each labels as label, gi (label + '_' + gi)}
        {@const groupY = hPadding.top + gi * hRowHeight}
        {#if stacked}
          {@const _ = null}
          {#each datasets as ds, di (ds.label + '_' + di)}
            {@const v = ds.data[gi] ?? 0}
            {@const stackBelow = datasets
              .slice(0, di)
              .reduce((s, d) => s + ((d.data[gi] ?? 0) >= 0 === v >= 0 ? (d.data[gi] ?? 0) : 0), 0)}
            {@const x0 = hXofValue(Math.min(stackBelow + Math.min(v, 0), stackBelow))}
            {@const x1 = hXofValue(Math.max(stackBelow + Math.max(v, 0), stackBelow))}
            <rect
              x={Math.min(x0, x1)}
              y={groupY + hRowHeight * 0.2}
              width={Math.max(1, Math.abs(x1 - x0))}
              height={hRowHeight * 0.6}
              fill={barColor(ds, v, gi)}
              rx="2"
            />
          {/each}
        {:else}
          {@const slotH = (hRowHeight * 0.78) / Math.max(1, datasets.length)}
          {#each datasets as ds, di (ds.label + '_' + di)}
            {@const v = ds.data[gi] ?? 0}
            {@const y0 = groupY + hRowHeight * 0.11 + di * slotH}
            {@const x0 = hXofValue(Math.min(v, 0))}
            {@const x1 = hXofValue(Math.max(v, 0))}
            <rect
              x={Math.min(x0, x1)}
              y={y0}
              width={Math.max(1, Math.abs(x1 - x0))}
              height={slotH * 0.86}
              fill={barColor(ds, v, gi)}
              rx="2"
            />
          {/each}
        {/if}

        <text
          class="axis-text right-aligned"
          x={hPadding.left - 8}
          y={groupY + hRowHeight / 2 + 3}
          text-anchor="end"
        >{label}</text>
      {/each}
    </svg>
  </div>
{/if}

{#if showLegend && datasets.length > 1}
  <ul class="legend">
    {#each datasets as ds, i (i)}
      <li>
        <span class="swatch" style="background: {typeof ds.color === 'string' ? ds.color : 'rgba(255,255,255,0.3)'}"></span>
        <span>{ds.label}</span>
      </li>
    {/each}
  </ul>
{/if}

<style>
  .bar-wrap {
    width: 100%;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }
  svg {
    display: block;
  }
  :global(text.axis-text) {
    fill: var(--text-muted);
    font-size: 10px;
    font-family: ui-monospace, 'SF Mono', Menlo, monospace;
  }
  :global(text.axis-title) {
    fill: var(--text-muted);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .legend {
    list-style: none;
    padding: 0;
    margin: 8px 0 0;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 14px;
    font-size: 12px;
    color: var(--text);
  }
  .legend li {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .swatch {
    width: 10px;
    height: 10px;
    border-radius: 2px;
  }
</style>

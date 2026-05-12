<script lang="ts">
  import { base } from '$app/paths';
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { listGames } from '$lib/db';
  import {
    analyzeGames,
    canonicalizePair,
    filterGamesByPair,
    histogram,
    mean,
    median,
    stdev,
    type Stats
  } from '$lib/stats';
  import Doughnut from '$lib/components/charts/Doughnut.svelte';
  import BarChart from '$lib/components/charts/BarChart.svelte';
  import BackButton from '$lib/components/BackButton.svelte';

  // ---- colors ----
  const C_P1 = 'var(--success)';      // green
  const C_P2 = 'var(--accent)';       // red
  const C_NEUTRAL = '#8e8e93';        // for ties / non-dealer
  const C_GOLD = 'var(--warning)';    // gold accent

  let stats = $state<Stats | null>(null);
  let loading = $state(true);

  onMount(async () => {
    const p1Raw = $page.url.searchParams.get('p1') ?? '';
    const p2Raw = $page.url.searchParams.get('p2') ?? '';
    const all = await listGames();
    const games = filterGamesByPair(all, [p1Raw, p2Raw]);
    const canonical = canonicalizePair(p1Raw, p2Raw);
    stats = analyzeGames(games, canonical);
    loading = false;
  });

  function pct(n: number, t: number): string {
    return t ? `${Math.round((100 * n) / t)}%` : '0%';
  }
  function fmt(n: number): string {
    return n > 0 ? `+${n}` : String(n);
  }
  function fmtDate(ms: number): string {
    return new Date(ms).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }
  function dateRangeLabel(s: Stats): string {
    if (s.firstGameAt === null || s.lastGameAt === null) return '';
    const a = fmtDate(s.firstGameAt);
    const b = fmtDate(s.lastGameAt);
    return a === b ? a : `${a} – ${b}`;
  }

  // ---- chart input builders ----
  function marginBins(s: Stats) {
    const buckets: Array<[number, number]> = [
      [0, 50], [50, 100], [100, 150], [150, 200], [200, 250], [250, 300], [300, 9999]
    ];
    const labels = buckets.map(([lo, hi]) => (hi === 9999 ? `${lo}+` : `${lo}–${hi}`));
    const p1 = buckets.map(([lo, hi]) => s.p1Margins.filter((m) => m >= lo && m < hi).length);
    const p2 = buckets.map(([lo, hi]) => s.p2Margins.filter((m) => m >= lo && m < hi).length);
    return { labels, p1, p2 };
  }

  function marginsOverTime(s: Stats) {
    const labels = s.finishedGames.map((_, i) => `#${i + 1}`);
    const data = s.finishedGames.map((r) => (r.winner_index === 0 ? r.margin : -r.margin));
    return { labels, data };
  }

  function handScoreBins(s: Stats) {
    const all = [...s.p1HandScores, ...s.p2HandScores];
    if (all.length === 0) return { labels: [], p1: [], p2: [] };
    const lo = Math.floor(Math.min(...all) / 5) * 5;
    const hi = Math.floor(Math.max(...all) / 5) * 5 + 5;
    const p1bins = histogram(s.p1HandScores, lo, hi, 5);
    const p2bins = histogram(s.p2HandScores, lo, hi, 5);
    return {
      labels: p1bins.map((b) => b.label),
      p1: p1bins.map((b) => b.count),
      p2: p2bins.map((b) => b.count)
    };
  }

  function gameLengthBins(s: Stats) {
    if (s.gameLengths.length === 0) return { labels: [], counts: [], p1: [], p2: [] };
    const lo = Math.min(...s.gameLengths);
    const hi = Math.max(...s.gameLengths);
    const labels: string[] = [];
    const counts: number[] = [];
    const p1: number[] = [];
    const p2: number[] = [];
    for (let i = lo; i <= hi; i++) {
      labels.push(String(i));
      counts.push(s.gameLengths.filter((l) => l === i).length);
      p1.push(s.p1WinLengths.filter((l) => l === i).length);
      p2.push(s.p2WinLengths.filter((l) => l === i).length);
    }
    return { labels, counts, p1, p2 };
  }

  function finalHandBins(s: Stats) {
    if (s.finalHandSizes.length === 0) return { labels: [], counts: [] };
    const lo = Math.floor(Math.min(...s.finalHandSizes) / 5) * 5;
    const hi = Math.floor(Math.max(...s.finalHandSizes) / 5) * 5 + 5;
    const bins = histogram(s.finalHandSizes, lo, hi, 5);
    return { labels: bins.map((b) => b.label), counts: bins.map((b) => b.count) };
  }

  function maxSwing(s: Stats): number {
    return Math.max(1, ...s.comebacks.map((c) => c.swing));
  }
</script>

<div class="top-bar">
  <BackButton href="{base}/" />
</div>

<header class="header">
  {#if stats}
    <h1>{stats.pair[0]} <span class="vs">vs</span> {stats.pair[1]}</h1>
    {#if stats.firstGameAt !== null}
      <p class="range">{dateRangeLabel(stats)} · {stats.totalGames} game{stats.totalGames === 1 ? '' : 's'}</p>
    {/if}
  {:else}
    <h1>Stats</h1>
  {/if}
</header>

{#if loading}
  <p class="empty">Loading…</p>
{:else if !stats || stats.totalGames === 0}
  <p class="empty">No games played between these two yet.</p>
{:else}
  <!-- ============= KPI strip ============= -->
  <section class="kpis">
    <div class="kpi"><div class="kl">Games</div><div class="kv">{stats.totalGames}</div></div>
    <div class="kpi"><div class="kl">Hands</div><div class="kv">{stats.totalHands}</div></div>
    <div class="kpi p1"><div class="kl">{stats.pair[0]} games</div><div class="kv">{stats.p1GameWins}</div><div class="ks">{pct(stats.p1GameWins, stats.finishedGames.length)}</div></div>
    <div class="kpi p2"><div class="kl">{stats.pair[1]} games</div><div class="kv">{stats.p2GameWins}</div><div class="ks">{pct(stats.p2GameWins, stats.finishedGames.length)}</div></div>
    <div class="kpi p1"><div class="kl">{stats.pair[0]} hands</div><div class="kv">{stats.p1HandWins}</div><div class="ks">{pct(stats.p1HandWins, stats.totalHands)}</div></div>
    <div class="kpi p2"><div class="kl">{stats.pair[1]} hands</div><div class="kv">{stats.p2HandWins}</div><div class="ks">{pct(stats.p2HandWins, stats.totalHands)}</div></div>
    <div class="kpi"><div class="kl">Avg margin</div><div class="kv">{Math.round(stats.marginMean)}</div></div>
    <div class="kpi"><div class="kl">Median margin</div><div class="kv">{stats.marginMedian}</div></div>
  </section>

  <!-- ============= Win/Loss record ============= -->
  <section class="section">
    <h2>Win / loss record</h2>
    <div class="card-grid two">
      <div class="card">
        <h3>Game wins</h3>
        <Doughnut
          segments={[
            { label: stats.pair[0], value: stats.p1GameWins, color: C_P1 },
            { label: stats.pair[1], value: stats.p2GameWins, color: C_P2 }
          ]}
          centerLabel={String(stats.finishedGames.length)}
          centerSubLabel="games"
        />
      </div>
      <div class="card">
        <h3>Hand wins</h3>
        <Doughnut
          segments={[
            { label: stats.pair[0], value: stats.p1HandWins, color: C_P1 },
            { label: stats.pair[1], value: stats.p2HandWins, color: C_P2 }
          ]}
          centerLabel={String(stats.totalHands)}
          centerSubLabel="hands"
        />
      </div>
    </div>
  </section>

  <!-- ============= Margin of victory ============= -->
  {@const mbins = marginBins(stats)}
  {@const mLine = marginsOverTime(stats)}
  <section class="section">
    <h2>Margin of victory</h2>
    <div class="card">
      <h3>Distribution</h3>
      <BarChart
        labels={mbins.labels}
        datasets={[
          { label: stats.pair[0] + ' wins', color: C_P1, data: mbins.p1 },
          { label: stats.pair[1] + ' wins', color: C_P2, data: mbins.p2 }
        ]}
        labelEvery={2}
      />
    </div>
    <div class="card">
      <h3>By game (signed: + = {stats.pair[0]}, − = {stats.pair[1]})</h3>
      <BarChart
        labels={mLine.labels}
        datasets={[
          { label: 'Margin', color: (v) => (v >= 0 ? C_P1 : C_P2), data: mLine.data }
        ]}
        showLegend={false}
      />
    </div>
  </section>

  <!-- ============= Hand score distribution ============= -->
  {@const hsbins = handScoreBins(stats)}
  <section class="section">
    <h2>Hand score distribution</h2>
    <div class="card">
      <BarChart
        labels={hsbins.labels}
        datasets={[
          { label: stats.pair[0], color: C_P1, data: hsbins.p1 },
          { label: stats.pair[1], color: C_P2, data: hsbins.p2 }
        ]}
        height={240}
        labelEvery={2}
      />
    </div>
    <div class="card">
      <h3>Per-player summary</h3>
      <table class="stats-table">
        <thead><tr><th>Player</th><th>n</th><th>Mean</th><th>Median</th><th>Stdev</th><th>Min</th><th>Max</th></tr></thead>
        <tbody>
          <tr>
            <td class="player-cell" style="color: var(--success);">{stats.pair[0]}</td>
            <td>{stats.p1HandScores.length}</td>
            <td>{mean(stats.p1HandScores).toFixed(1)}</td>
            <td>{median(stats.p1HandScores)}</td>
            <td>{stdev(stats.p1HandScores).toFixed(1)}</td>
            <td>{stats.p1HandScores.length ? Math.min(...stats.p1HandScores) : '—'}</td>
            <td>{stats.p1HandScores.length ? Math.max(...stats.p1HandScores) : '—'}</td>
          </tr>
          <tr>
            <td class="player-cell" style="color: var(--accent);">{stats.pair[1]}</td>
            <td>{stats.p2HandScores.length}</td>
            <td>{mean(stats.p2HandScores).toFixed(1)}</td>
            <td>{median(stats.p2HandScores)}</td>
            <td>{stdev(stats.p2HandScores).toFixed(1)}</td>
            <td>{stats.p2HandScores.length ? Math.min(...stats.p2HandScores) : '—'}</td>
            <td>{stats.p2HandScores.length ? Math.max(...stats.p2HandScores) : '—'}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>

  <!-- ============= Game length ============= -->
  {@const glb = gameLengthBins(stats)}
  <section class="section">
    <h2>Game length</h2>
    <div class="card-grid two">
      <div class="card">
        <h3>Hands per game</h3>
        <BarChart
          labels={glb.labels}
          datasets={[{ label: 'games', color: 'rgba(255,255,255,0.5)', data: glb.counts }]}
          showLegend={false}
        />
      </div>
      <div class="card">
        <h3>Length by winner</h3>
        <BarChart
          labels={glb.labels}
          datasets={[
            { label: stats.pair[0] + ' won', color: C_P1, data: glb.p1 },
            { label: stats.pair[1] + ' won', color: C_P2, data: glb.p2 }
          ]}
          stacked
        />
      </div>
    </div>
  </section>

  <!-- ============= Undercuts ============= -->
  <section class="section">
    <h2>Undercuts</h2>
    <p class="note">A hand where the *defender* (non-ginner) ended with more points than the ginner.</p>
    <div class="card">
      <BarChart
        labels={[stats.pair[0] + ' undercut', stats.pair[1] + ' undercut']}
        datasets={[{ label: 'hands', color: C_GOLD, data: [stats.p1Undercuts, stats.p2Undercuts] }]}
        orientation="horizontal"
        showLegend={false}
      />
    </div>
  </section>

  <!-- ============= Dealer advantage ============= -->
  <section class="section">
    <h2>Dealer advantage</h2>
    <div class="card-grid two">
      <div class="card">
        <h3>All hands</h3>
        <Doughnut
          segments={[
            { label: 'Dealer won', value: stats.dealerWonHands, color: C_GOLD },
            { label: 'Non-dealer won', value: stats.nonDealerWonHands, color: C_NEUTRAL }
          ]}
          centerLabel={pct(stats.dealerWonHands, stats.totalHands)}
          centerSubLabel="dealer win rate"
        />
      </div>
      <div class="card">
        <h3>Win rate when dealing</h3>
        <BarChart
          labels={[
            stats.pair[0] + ' (' + stats.p1DealtCount + ')',
            stats.pair[1] + ' (' + stats.p2DealtCount + ')'
          ]}
          datasets={[
            { label: 'Dealt → won', color: C_GOLD, data: [stats.p1DealtWon, stats.p2DealtWon] },
            { label: 'Dealt → lost', color: C_NEUTRAL, data: [stats.p1DealtCount - stats.p1DealtWon, stats.p2DealtCount - stats.p2DealtWon] }
          ]}
          stacked
          orientation="horizontal"
        />
      </div>
    </div>
  </section>

  <!-- ============= Final-hand size ============= -->
  {@const fhb = finalHandBins(stats)}
  <section class="section">
    <h2>Final hand size</h2>
    <p class="note">The winning hand's score — were games closed with a small push or a big swing?</p>
    <div class="card">
      <BarChart
        labels={fhb.labels}
        datasets={[{ label: 'games', color: C_GOLD, data: fhb.counts }]}
        showLegend={false}
      />
    </div>
  </section>

  <!-- ============= Comebacks ============= -->
  <section class="section">
    <h2>Comebacks</h2>
    <p class="note">Games where the eventual winner was behind at or past the halfway hand. Swing = deepest deficit + final margin.</p>
    <div class="card comebacks">
      {#if stats.comebacks.length === 0}
        <p class="dim">No comebacks — every winner led from the halfway mark onward.</p>
      {:else}
        {@const sMax = maxSwing(stats)}
        <table class="cb-table">
          <thead>
            <tr><th>Winner</th><th>Score</th><th>Trailing at</th><th>Max deficit</th><th>Swing</th></tr>
          </thead>
          <tbody>
            {#each stats.comebacks as c (c.game.game_id)}
              {@const winnerName = c.game.winner_index === 0 ? stats.pair[0] : stats.pair[1]}
              {@const winnerColor = c.game.winner_index === 0 ? C_P1 : C_P2}
              <tr>
                <td class="player-cell" style="color: {winnerColor};">{winnerName}</td>
                <td class="mono">{c.game.p1_total}–{c.game.p2_total}</td>
                <td>{c.trailingAt.join(', ')}</td>
                <td class="mono">{c.maxDeficit}</td>
                <td>
                  <div class="swing-bar-wrap">
                    <div class="swing-bar" style="width: {(c.swing / sMax) * 100}%; background: {winnerColor}">
                      <span class="swing-num">{c.swing} <span class="dim">(−{c.maxDeficit} + {c.margin})</span></span>
                    </div>
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
    </div>
  </section>
{/if}

<style>
  /* Sticks to the top of the viewport while the long stats page scrolls.
     Top offset includes the iOS status-bar safe-area so it doesn't slip
     behind the notch on PWA installs. */
  .top-bar {
    position: sticky;
    top: calc(env(safe-area-inset-top) + 8px);
    z-index: 100;
    padding-top: 8px;
    pointer-events: none;
    width: max-content;
  }
  .top-bar :global(a) {
    pointer-events: auto;
  }

  .header {
    padding: 4px 0 14px;
    text-align: center;
  }

  h1 {
    font-size: 24px;
    font-weight: 700;
    color: var(--text);
  }
  .vs {
    color: var(--text-muted);
    font-weight: 400;
    font-size: 18px;
    margin: 0 4px;
  }
  .range {
    font-size: 11px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-top: 4px;
  }

  .empty {
    text-align: center;
    color: var(--text-muted);
    margin-top: 48px;
  }

  /* ---- KPI strip ---- */
  .kpis {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 6px;
    margin-bottom: 24px;
  }
  .kpi {
    padding: 10px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: var(--radius-sm);
  }
  .kpi.p1 { border-left: 3px solid var(--success); }
  .kpi.p2 { border-left: 3px solid var(--accent); }
  .kl {
    font-size: 10px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .kv {
    font-family: ui-monospace, 'SF Mono', Menlo, monospace;
    font-size: 22px;
    font-weight: 700;
    color: var(--text);
    line-height: 1.1;
  }
  .ks {
    font-size: 11px;
    color: var(--text-muted);
  }

  /* ---- Sections ---- */
  .section {
    margin-bottom: 28px;
  }
  .section h2 {
    font-size: 12px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 1.2px;
    margin-bottom: 10px;
  }
  .section h3 {
    font-size: 13px;
    font-weight: 600;
    color: var(--text);
    margin-bottom: 10px;
  }
  .section .note {
    font-size: 11px;
    color: var(--text-muted);
    margin-bottom: 10px;
    font-style: italic;
  }

  .card {
    padding: 14px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: var(--radius-md);
    margin-bottom: 10px;
  }

  .card-grid {
    display: grid;
    gap: 10px;
  }
  .card-grid.two {
    grid-template-columns: 1fr;
  }
  @media (min-width: 560px) {
    .card-grid.two { grid-template-columns: 1fr 1fr; }
    .kpis { grid-template-columns: repeat(4, 1fr); }
  }

  /* ---- Stats table ---- */
  .stats-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
  }
  .stats-table th {
    text-align: left;
    color: var(--text-muted);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    font-size: 10px;
    padding: 4px 6px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }
  .stats-table td {
    padding: 6px 6px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    color: var(--text);
    font-family: ui-monospace, 'SF Mono', Menlo, monospace;
  }
  .stats-table td:first-child {
    font-family: inherit;
  }
  .player-cell {
    font-weight: 600;
  }

  /* ---- Comebacks ---- */
  .cb-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
  }
  .cb-table th {
    text-align: left;
    color: var(--text-muted);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    font-size: 10px;
    padding: 4px 6px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }
  .cb-table td {
    padding: 8px 6px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    color: var(--text);
  }
  .cb-table .mono {
    font-family: ui-monospace, 'SF Mono', Menlo, monospace;
  }
  .swing-bar-wrap {
    background: rgba(255, 255, 255, 0.04);
    border-radius: 4px;
    height: 22px;
    min-width: 140px;
    overflow: hidden;
  }
  .swing-bar {
    height: 100%;
    display: flex;
    align-items: center;
    padding: 0 8px;
    color: white;
    font-size: 11px;
    font-weight: 600;
    font-family: ui-monospace, 'SF Mono', Menlo, monospace;
    white-space: nowrap;
  }
  .swing-num .dim {
    opacity: 0.7;
    font-weight: 400;
  }
  .dim {
    color: var(--text-muted);
  }
</style>

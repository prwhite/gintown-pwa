/**
 * Pure analysis functions for the player-pair stats view.
 *
 * Inputs come from IDB (`Game[]`). Output is a single `Stats` blob — every
 * chart / KPI on the stats page is a function of one or two of its fields.
 *
 * Player ordering: callers should pass `pair` in canonical (alphabetical,
 * case-insensitive) order; `analyzeGames` re-maps each game's per-player
 * arrays to that canonical [p1, p2] order so all downstream numbers line up
 * regardless of which game order brought you here.
 */

import type { Game } from './db';

export interface PerHandRow {
  game_id: string;
  hand_index: number;
  p1_score: number;
  p2_score: number;
  ginner_index: 0 | 1; // 0 = p1 ginned; 1 = p2 ginned
  dealer_index: 0 | 1;
  defender_deadwood: number;
  defender_layoffs: number;
  game_created_at: number;
}

export interface PerGameRow {
  game_id: string;
  created_at: number;
  num_hands: number;
  p1_total: number;
  p2_total: number;
  winner_index: 0 | 1 | null;
  margin: number;
  hands: PerHandRow[];
}

export interface Comeback {
  game: PerGameRow;
  maxDeficit: number;
  margin: number;
  swing: number;
  trailingAt: number[];
}

export interface Stats {
  pair: [string, string];

  games: PerGameRow[];
  finishedGames: PerGameRow[];
  totalGames: number;
  totalHands: number;

  // game-level (finished only)
  p1GameWins: number;
  p2GameWins: number;

  // hand-level (all hands)
  p1HandWins: number;
  p2HandWins: number;

  margins: number[];
  p1Margins: number[];
  p2Margins: number[];
  marginMean: number;
  marginMedian: number;

  p1HandScores: number[];
  p2HandScores: number[];

  gameLengths: number[];
  p1WinLengths: number[];
  p2WinLengths: number[];

  // undercut = defender's score > ginner's score, attributed to the defender
  p1Undercuts: number;
  p2Undercuts: number;

  dealerWonHands: number;
  nonDealerWonHands: number;
  p1DealtCount: number;
  p1DealtWon: number;
  p2DealtCount: number;
  p2DealtWon: number;

  finalHandSizes: number[]; // winning final hand value for each finished game

  comebacks: Comeback[];

  firstGameAt: number | null;
  lastGameAt: number | null;
}

/** Sort the pair alphabetically (case-insensitive). */
export function canonicalizePair(a: string, b: string): [string, string] {
  return a.localeCompare(b, undefined, { sensitivity: 'base' }) <= 0 ? [a, b] : [b, a];
}

/** Case-insensitive trimmed name match — same pair regardless of order. */
export function filterGamesByPair(games: Game[], pair: [string, string]): Game[] {
  const norm = (s: string) => s.trim().toLowerCase();
  const a = norm(pair[0]);
  const b = norm(pair[1]);
  return games.filter((g) => {
    const ga = norm(g.players[0]);
    const gb = norm(g.players[1]);
    return (ga === a && gb === b) || (ga === b && gb === a);
  });
}

export function mean(arr: readonly number[]): number {
  return arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : 0;
}

export function median(arr: readonly number[]): number {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function stdev(arr: readonly number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, x) => s + (x - m) * (x - m), 0) / (arr.length - 1));
}

export interface HistogramBin {
  label: string;
  lo: number;
  hi: number; // exclusive
  count: number;
}

/** Fixed-step histogram bins; both bounds inclusive on lo, exclusive on hi. */
export function histogram(values: readonly number[], lo: number, hi: number, step: number): HistogramBin[] {
  const bins: HistogramBin[] = [];
  for (let b = lo; b < hi; b += step) {
    bins.push({
      label: String(b),
      lo: b,
      hi: b + step,
      count: values.filter((v) => v >= b && v < b + step).length
    });
  }
  return bins;
}

export function analyzeGames(games: Game[], pair: [string, string]): Stats {
  const norm = (s: string) => s.trim().toLowerCase();
  const p1Norm = norm(pair[0]);

  // Map each Game into canonical [p1, p2] order.
  const rows: PerGameRow[] = games.map((g) => {
    const swap = norm(g.players[0]) !== p1Norm; // game has p2 at index 0 → swap

    const handRows: PerHandRow[] = g.hands.map((h) => {
      const ginnerSwapped = (swap ? (1 - h.ginnerIndex) : h.ginnerIndex) as 0 | 1;
      const dealerOrig = (g.firstDealerIndex + h.index - 1) % 2;
      const dealerSwapped = (swap ? (1 - dealerOrig) : dealerOrig) as 0 | 1;
      return {
        game_id: g.id,
        hand_index: h.index,
        p1_score: swap ? h.scores[1] : h.scores[0],
        p2_score: swap ? h.scores[0] : h.scores[1],
        ginner_index: ginnerSwapped,
        dealer_index: dealerSwapped,
        defender_deadwood: h.defenderDeadwood,
        defender_layoffs: h.defenderLayoffs,
        game_created_at: g.createdAt
      };
    });

    const p1_total = handRows.reduce((s, h) => s + h.p1_score, 0);
    const p2_total = handRows.reduce((s, h) => s + h.p2_score, 0);
    const winnerOrig = g.winner;
    const winner_index: 0 | 1 | null =
      winnerOrig === null ? null : ((swap ? (1 - winnerOrig) : winnerOrig) as 0 | 1);

    return {
      game_id: g.id,
      created_at: g.createdAt,
      num_hands: g.hands.length,
      p1_total,
      p2_total,
      winner_index,
      margin: Math.abs(p1_total - p2_total),
      hands: handRows
    };
  });

  rows.sort((a, b) => a.created_at - b.created_at);
  const allHands = rows.flatMap((r) => r.hands);
  const finished = rows.filter((r) => r.winner_index !== null);

  const p1GameWins = finished.filter((r) => r.winner_index === 0).length;
  const p2GameWins = finished.filter((r) => r.winner_index === 1).length;

  const p1HandWins = allHands.filter((h) => h.ginner_index === 0).length;
  const p2HandWins = allHands.filter((h) => h.ginner_index === 1).length;

  const margins = finished.map((r) => r.margin);
  const p1Margins = finished.filter((r) => r.winner_index === 0).map((r) => r.margin);
  const p2Margins = finished.filter((r) => r.winner_index === 1).map((r) => r.margin);

  const p1HandScores = allHands.map((h) => h.p1_score);
  const p2HandScores = allHands.map((h) => h.p2_score);

  const gameLengths = finished.map((r) => r.num_hands);
  const p1WinLengths = finished.filter((r) => r.winner_index === 0).map((r) => r.num_hands);
  const p2WinLengths = finished.filter((r) => r.winner_index === 1).map((r) => r.num_hands);

  // Undercut: the *defender* (non-ginner) had a higher hand score than the ginner.
  let p1Undercuts = 0;
  let p2Undercuts = 0;
  for (const h of allHands) {
    if (h.ginner_index === 0 && h.p2_score > h.p1_score) p2Undercuts++; // p2 was defender, scored more
    if (h.ginner_index === 1 && h.p1_score > h.p2_score) p1Undercuts++; // p1 was defender, scored more
  }

  // Dealer advantage: did the dealer take the hand?
  let dealerWonHands = 0;
  let nonDealerWonHands = 0;
  let p1DealtCount = 0;
  let p1DealtWon = 0;
  let p2DealtCount = 0;
  let p2DealtWon = 0;
  for (const h of allHands) {
    if (h.dealer_index === h.ginner_index) dealerWonHands++;
    else nonDealerWonHands++;
    if (h.dealer_index === 0) {
      p1DealtCount++;
      if (h.ginner_index === 0) p1DealtWon++;
    } else {
      p2DealtCount++;
      if (h.ginner_index === 1) p2DealtWon++;
    }
  }

  const finalHandSizes = finished.map((r) => {
    const last = r.hands[r.hands.length - 1];
    if (!last) return 0;
    return r.winner_index === 0 ? last.p1_score : last.p2_score;
  });

  // Comebacks: eventual winner was behind at or past the halfway hand.
  const comebacks: Comeback[] = [];
  for (const r of finished) {
    if (r.winner_index === null) continue;
    const half = Math.ceil(r.num_hands / 2);
    let p1Run = 0;
    let p2Run = 0;
    let maxDeficit = 0;
    const trailingAt: number[] = [];
    for (let i = 0; i < r.hands.length; i++) {
      const h = r.hands[i];
      p1Run += h.p1_score;
      p2Run += h.p2_score;
      const winnerRun = r.winner_index === 0 ? p1Run : p2Run;
      const loserRun = r.winner_index === 0 ? p2Run : p1Run;
      const deficit = loserRun - winnerRun;
      if (deficit > maxDeficit) maxDeficit = deficit;
      if (h.hand_index >= half && i < r.hands.length - 1 && deficit > 0) {
        trailingAt.push(h.hand_index);
      }
    }
    if (trailingAt.length > 0) {
      comebacks.push({ game: r, maxDeficit, margin: r.margin, swing: maxDeficit + r.margin, trailingAt });
    }
  }
  comebacks.sort((a, b) => b.swing - a.swing);

  return {
    pair,
    games: rows,
    finishedGames: finished,
    totalGames: rows.length,
    totalHands: allHands.length,
    p1GameWins,
    p2GameWins,
    p1HandWins,
    p2HandWins,
    margins,
    p1Margins,
    p2Margins,
    marginMean: mean(margins),
    marginMedian: median(margins),
    p1HandScores,
    p2HandScores,
    gameLengths,
    p1WinLengths,
    p2WinLengths,
    p1Undercuts,
    p2Undercuts,
    dealerWonHands,
    nonDealerWonHands,
    p1DealtCount,
    p1DealtWon,
    p2DealtCount,
    p2DealtWon,
    finalHandSizes,
    comebacks,
    firstGameAt: rows.length ? rows[0].created_at : null,
    lastGameAt: rows.length ? rows[rows.length - 1].created_at : null
  };
}

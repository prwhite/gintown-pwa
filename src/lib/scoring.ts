/**
 * Krusty Gin scoring inputs for in-person play.
 *
 * Players announce their *total* hand score; the PWA records those totals
 * directly. Deadwood/layoffs are metadata for posterity (not summed).
 */

export const STEP = 5;

export const DEFAULTS = {
  ginnerTotal: 50,
  defenderTotal: 50,
  defenderDeadwood: 0,
  defenderLayoffs: 0
} as const;

export const RANGES = {
  ginnerTotal: { min: 50, max: 120 },
  defenderTotal: { min: -120, max: 120 },
  defenderDeadwood: { min: 0, max: 120 },
  defenderLayoffs: { min: 0, max: 50 },
  targetScore: { min: 100, max: 500 }
} as const;

export const DEFAULT_TARGET_SCORE = 300;

export interface HandInput {
  ginnerIndex: 0 | 1;
  ginnerTotal: number;
  defenderTotal: number;
  defenderDeadwood: number;
  defenderLayoffs: number;
}

export function scoreHand(h: HandInput): [number, number] {
  return h.ginnerIndex === 0 ? [h.ginnerTotal, h.defenderTotal] : [h.defenderTotal, h.ginnerTotal];
}

export function snap(n: number, step = STEP): number {
  return Math.round(n / step) * step;
}

export function totalFor(hands: { scores: [number, number] }[], playerIndex: 0 | 1): number {
  return hands.reduce((sum, h) => sum + h.scores[playerIndex], 0);
}

export function winnerIfAny(
  totals: [number, number],
  targetScore: number
): 0 | 1 | null {
  const reached = totals.some((t) => t >= targetScore);
  if (!reached) return null;
  return totals[0] >= totals[1] ? 0 : 1;
}

/**
 * Trailing run of consecutive most-recent hands ginned by the same player.
 * Returns that player's name + the run length, or null unless it's ≥ 2.
 * Structural args so it works for live and finished games alike.
 */
export function currentHandStreak(
  hands: readonly { ginnerIndex: 0 | 1 }[],
  players: readonly [string, string]
): { name: string; count: number } | null {
  if (hands.length === 0) return null;
  const ginner = hands[hands.length - 1].ginnerIndex;
  let count = 0;
  for (let i = hands.length - 1; i >= 0; i--) {
    if (hands[i].ginnerIndex === ginner) count++;
    else break;
  }
  return count >= 2 ? { name: players[ginner], count } : null;
}

/**
 * Dealer alternates strictly each hand starting from the firstDealerIndex.
 * `handIndex` is 1-based (matches Hand.index).
 */
export function dealerIndexFor(firstDealerIndex: 0 | 1, handIndex: number): 0 | 1 {
  return ((firstDealerIndex + handIndex - 1) % 2) as 0 | 1;
}

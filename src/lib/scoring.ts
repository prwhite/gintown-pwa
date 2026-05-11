/**
 * Krusty Gin scoring inputs for in-person play.
 *
 * Model (per user, after first iteration): players announce their *total* hand
 * score at the table. The PWA records those totals directly — no melds/deadwood
 * arithmetic. Deadwood and layoffs are tracked as metadata for posterity but
 * are NOT summed into the score.
 *
 *   ginnerTotal       — the ginner's announced hand score
 *   defenderTotal     — the defender's announced hand score (can be negative)
 *   defenderDeadwood  — metadata only
 *   defenderLayoffs   — metadata only
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
  // Defender can go net-negative (high deadwood, no melds), so allow downward range.
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

/**
 * Per-player hand deltas — now a direct copy of the entered totals into the
 * right slots; no math.
 */
export function scoreHand(h: HandInput): [number, number] {
  return h.ginnerIndex === 0 ? [h.ginnerTotal, h.defenderTotal] : [h.defenderTotal, h.ginnerTotal];
}

export function snap(n: number, step = STEP): number {
  return Math.round(n / step) * step;
}

export function totalFor(hands: { scores: [number, number] }[], playerIndex: 0 | 1): number {
  return hands.reduce((sum, h) => sum + h.scores[playerIndex], 0);
}

/**
 * Winner once any player reaches target. Highest score wins (matches gintown).
 */
export function winnerIfAny(
  totals: [number, number],
  targetScore: number
): 0 | 1 | null {
  const reached = totals.some((t) => t >= targetScore);
  if (!reached) return null;
  return totals[0] >= totals[1] ? 0 : 1;
}

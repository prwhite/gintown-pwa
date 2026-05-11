/**
 * Krusty Gin scoring math.
 *
 * Rules reference: gintown/RULES.md §"Krusty Gin".
 * Canonical impl: gintown/backend/app/rules/krusty_gin.py
 *                 gintown/frontend/src/lib/utils/krusty_gin.ts
 *
 * In this PWA we don't model cards or melds; we accept user-entered totals
 * (all multiples of 5) and compute hand deltas + game progress.
 */

export const STEP = 5;
export const DEFAULTS = {
  ginnerMeldPoints: 50,
  defenderMeldPoints: 0,
  defenderDeadwood: 0,
  defenderLayoffs: 0
} as const;

export const RANGES = {
  ginnerMeldPoints: { min: 50, max: 120 },
  defenderMeldPoints: { min: 0, max: 120 },
  defenderDeadwood: { min: 0, max: 120 },
  defenderLayoffs: { min: 0, max: 50 },
  targetScore: { min: 100, max: 500 }
} as const;

export const DEFAULT_TARGET_SCORE = 300;

export interface HandInput {
  ginnerIndex: 0 | 1;
  ginnerMeldPoints: number;
  defenderMeldPoints: number;
  defenderDeadwood: number;
  defenderLayoffs: number;
}

/**
 * Compute per-player hand deltas.
 * - Ginner scores their meld points.
 * - Defender scores meld points − deadwood + layoffs (can be negative).
 */
export function scoreHand(h: HandInput): [number, number] {
  const ginner = h.ginnerMeldPoints;
  const defender = h.defenderMeldPoints - h.defenderDeadwood + h.defenderLayoffs;
  return h.ginnerIndex === 0 ? [ginner, defender] : [defender, ginner];
}

/** Snap an arbitrary number to the nearest STEP increment. */
export function snap(n: number, step = STEP): number {
  return Math.round(n / step) * step;
}

/** Sum of per-hand deltas for a single player index across hands. */
export function totalFor(hands: { scores: [number, number] }[], playerIndex: 0 | 1): number {
  return hands.reduce((sum, h) => sum + h.scores[playerIndex], 0);
}

/**
 * Determine winner once any player reaches target.
 * Returns the index of the player with the highest score, or null if neither
 * has reached target yet. If both have reached target in the same hand, the
 * higher score wins (matches gintown's krusty_gin.is_game_over).
 */
export function winnerIfAny(
  totals: [number, number],
  targetScore: number
): 0 | 1 | null {
  const reached = totals.some((t) => t >= targetScore);
  if (!reached) return null;
  return totals[0] >= totals[1] ? 0 : 1;
}

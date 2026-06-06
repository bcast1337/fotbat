import type { Team, OutcomeProbabilities } from './types.js';
import { strengthSplit } from './elo.js';

/**
 * Poisson scoreline model.
 *
 * Estimates expected goals (xG) for each side by blending attacking and
 * defensive averages with the ELO strength split, then builds a probability
 * grid over scorelines to derive 1X2 outcome probabilities.
 */

/** Maximum goals per side considered in the scoreline grid. */
export const MAX_GOALS = 8;

/** League-average goals per team per match, used as a baseline. */
export const LEAGUE_AVG_GOALS = 1.35;

/**
 * Poisson probability mass function.
 *
 * @param k - number of events (goals).
 * @param lambda - expected rate (xG).
 * @returns probability of exactly k goals.
 */
export function poissonPmf(k: number, lambda: number): number {
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
}

/** Factorial helper for small non-negative integers. */
function factorial(n: number): number {
  let result = 1;
  for (let i = 2; i <= n; i++) result *= i;
  return result;
}

/**
 * Estimate expected goals for both teams.
 *
 * Base xG blends the attacking team's scoring rate with the opponent's
 * conceding rate, then is tilted by the ELO strength split so stronger teams
 * are rewarded beyond raw averages.
 *
 * @param home - home team.
 * @param away - away team.
 * @returns expected goals for home and away.
 */
export function estimateXg(home: Team, away: Team): { home: number; away: number } {
  const baseHome = (home.avgScored + away.avgConceded) / 2;
  const baseAway = (away.avgScored + home.avgConceded) / 2;
  const split = strengthSplit(home, away);
  // Tilt around 0.5 strength so an even matchup leaves xG unchanged.
  const homeXg = baseHome * (0.7 + split.home * 0.6);
  const awayXg = baseAway * (0.7 + split.away * 0.6);
  return {
    home: clamp(homeXg, 0.2, 5),
    away: clamp(awayXg, 0.2, 5),
  };
}

/** Clamp a value into the inclusive [min, max] range. */
function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/** Result of a full Poisson computation. */
export type PoissonResult = {
  probabilities: OutcomeProbabilities;
  xg: { home: number; away: number };
  likelyScore: string;
};

/**
 * Build the scoreline grid and derive 1X2 probabilities.
 *
 * @param home - home team.
 * @param away - away team.
 * @returns outcome probabilities, xG, and the most likely scoreline.
 */
export function poissonOutcome(home: Team, away: Team): PoissonResult {
  const xg = estimateXg(home, away);
  let pHome = 0;
  let pDraw = 0;
  let pAway = 0;
  let bestProb = 0;
  let bestScore = '0-0';

  for (let h = 0; h <= MAX_GOALS; h++) {
    const probH = poissonPmf(h, xg.home);
    for (let a = 0; a <= MAX_GOALS; a++) {
      const probA = poissonPmf(a, xg.away);
      const p = probH * probA;
      if (p > bestProb) {
        bestProb = p;
        bestScore = `${h}-${a}`;
      }
      if (h > a) pHome += p;
      else if (h === a) pDraw += p;
      else pAway += p;
    }
  }
  // Normalize to correct for the truncated grid tail.
  const total = pHome + pDraw + pAway;
  return {
    probabilities: { home: pHome / total, draw: pDraw / total, away: pAway / total },
    xg,
    likelyScore: bestScore,
  };
}

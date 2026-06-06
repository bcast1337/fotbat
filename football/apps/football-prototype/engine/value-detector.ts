import type { MarketOdds, OutcomeProbabilities } from './types.js';

/**
 * Odds intelligence and value-bet detection.
 *
 * Converts bookmaker decimal odds into implied probabilities (removing the
 * bookmaker margin / overround) and compares them against model probabilities
 * to surface positive-edge "value" bets.
 */

/** Minimum edge (in percentage points) required to flag a value bet. */
export const VALUE_THRESHOLD = 3;

/** A single outcome's edge breakdown. */
export type OutcomeEdge = {
  outcome: 'home' | 'draw' | 'away';
  modelProbability: number;
  impliedProbability: number;
  edgePercentage: number;
};

/**
 * Convert decimal odds to a raw implied probability.
 *
 * @param odds - decimal odds (e.g. 2.5).
 * @returns implied probability (0-1).
 */
export function impliedProbability(odds: number): number {
  return 1 / odds;
}

/**
 * Convert a full set of market odds into margin-free implied probabilities.
 * Normalizes by the overround so the three outcomes sum to 1.
 *
 * @param odds - market odds for home/draw/away.
 * @returns normalized implied probabilities.
 */
export function impliedProbabilities(odds: MarketOdds): OutcomeProbabilities {
  const rawHome = impliedProbability(odds.home);
  const rawDraw = impliedProbability(odds.draw);
  const rawAway = impliedProbability(odds.away);
  const overround = rawHome + rawDraw + rawAway;
  return {
    home: rawHome / overround,
    draw: rawDraw / overround,
    away: rawAway / overround,
  };
}

/**
 * Compute per-outcome edges between model and market.
 *
 * @param model - model outcome probabilities (0-1).
 * @param odds - market odds.
 * @returns edge breakdown per outcome, sorted by descending edge.
 */
export function computeEdges(model: OutcomeProbabilities, odds: MarketOdds): OutcomeEdge[] {
  const implied = impliedProbabilities(odds);
  const edges: OutcomeEdge[] = [
    {
      outcome: 'home',
      modelProbability: model.home,
      impliedProbability: implied.home,
      edgePercentage: (model.home - implied.home) * 100,
    },
    {
      outcome: 'draw',
      modelProbability: model.draw,
      impliedProbability: implied.draw,
      edgePercentage: (model.draw - implied.draw) * 100,
    },
    {
      outcome: 'away',
      modelProbability: model.away,
      impliedProbability: implied.away,
      edgePercentage: (model.away - implied.away) * 100,
    },
  ];
  return edges.sort((a, b) => b.edgePercentage - a.edgePercentage);
}

/**
 * Detect the best value bet from a set of edges.
 *
 * @param edges - per-outcome edges.
 * @param odds - market odds (to attach to the best value outcome).
 * @returns the best value outcome if it clears the threshold, else null.
 */
export function detectValue(
  edges: OutcomeEdge[],
  odds: MarketOdds
): {
  outcome: 'home' | 'draw' | 'away';
  edgePercentage: number;
  modelProbability: number;
  impliedProbability: number;
  odds: number;
} | null {
  const best = edges[0];
  if (!best || best.edgePercentage < VALUE_THRESHOLD) return null;
  return {
    outcome: best.outcome,
    edgePercentage: best.edgePercentage,
    modelProbability: best.modelProbability,
    impliedProbability: best.impliedProbability,
    odds: odds[best.outcome],
  };
}

import type { Fixture, Prediction, OutcomeProbabilities } from './types.js';
import { poissonOutcome } from './poisson.js';
import { strengthSplit } from './elo.js';
import { computeEdges, detectValue, impliedProbabilities } from './value-detector.js';

/**
 * Hybrid prediction engine.
 *
 * Combines two independent models — an ELO strength split and a Poisson
 * scoreline model — into a blended probability estimate, then runs value
 * detection against the market and generates a confidence score plus a
 * human-readable explanation for full transparency (no black box).
 */

/** Weight given to the Poisson model when blending with ELO. */
export const POISSON_WEIGHT = 0.6;

/**
 * Blend ELO and Poisson outcome probabilities.
 * ELO does not natively produce a draw probability, so the Poisson draw is
 * used and the ELO win expectancies are scaled into the remaining mass.
 */
function blendProbabilities(
  elo: { home: number; away: number },
  poisson: OutcomeProbabilities
): OutcomeProbabilities {
  const drawMass = poisson.draw;
  const remaining = 1 - drawMass;
  const eloHome = elo.home * remaining;
  const eloAway = elo.away * remaining;
  const home = POISSON_WEIGHT * poisson.home + (1 - POISSON_WEIGHT) * eloHome;
  const draw = drawMass;
  const away = POISSON_WEIGHT * poisson.away + (1 - POISSON_WEIGHT) * eloAway;
  const total = home + draw + away;
  return { home: home / total, draw: draw / total, away: away / total };
}

/**
 * Compute a 1-10 confidence score based on:
 * - probability gap (how decisive the favorite is)
 * - model agreement (ELO vs Poisson alignment)
 * - data consistency (recent form sample size)
 */
function confidence(
  blended: OutcomeProbabilities,
  elo: { home: number; away: number },
  poisson: OutcomeProbabilities,
  formSamples: number
): number {
  const sorted = [blended.home, blended.draw, blended.away].sort((a, b) => b - a);
  const gap = sorted[0] - sorted[1]; // 0-1, larger = clearer favorite
  // Model agreement: how close ELO home expectancy is to blended home prob.
  const agreement = 1 - Math.min(1, Math.abs(elo.home - poisson.home));
  const dataConsistency = Math.min(1, formSamples / 5);
  const raw = gap * 0.5 + agreement * 0.3 + dataConsistency * 0.2;
  return Math.max(1, Math.min(10, Math.round(1 + raw * 9)));
}

/** Build human-readable explanation bullets for a fixture. */
function explain(fixture: Fixture, blended: OutcomeProbabilities, xg: { home: number; away: number }): string[] {
  const reasons: string[] = [];
  const { home, away } = fixture;
  const implied = impliedProbabilities(fixture.odds);

  // Form analysis.
  const homeWins = home.form.filter((r) => r === 'W').length;
  const awayWins = away.form.filter((r) => r === 'W').length;
  if (homeWins >= 3) reasons.push(`${home.name} in strong form (${homeWins} wins in last ${home.form.length})`);
  if (awayWins >= 3) reasons.push(`${away.name} in strong form (${awayWins} wins in last ${away.form.length})`);
  if (homeWins <= 1 && home.form.length >= 3) reasons.push(`${home.name} struggling for results recently`);
  if (awayWins <= 1 && away.form.length >= 3) reasons.push(`${away.name} struggling for results recently`);

  // ELO strength.
  const eloDiff = Math.round(home.elo - away.elo);
  if (Math.abs(eloDiff) > 60) {
    const stronger = eloDiff > 0 ? home.name : away.name;
    reasons.push(`${stronger} significantly stronger by rating (${Math.abs(eloDiff)} ELO)`);
  }

  // Defensive / attacking edges.
  if (away.avgConceded > 1.6) reasons.push(`${away.name} leaks goals away (${away.avgConceded.toFixed(2)} conceded/game)`);
  if (home.avgScored > 1.8) reasons.push(`${home.name} potent at home (${home.avgScored.toFixed(2)} scored/game)`);

  // xG summary.
  reasons.push(`Model xG ${xg.home.toFixed(2)} - ${xg.away.toFixed(2)}`);

  // Value vs market.
  const favorite = blended.home >= blended.away ? 'home' : 'away';
  const favName = favorite === 'home' ? home.name : away.name;
  if (blended[favorite] - implied[favorite] > 0.03) {
    reasons.push(`Market appears to undervalue ${favName}`);
  }

  return reasons;
}

/**
 * Run the full hybrid prediction pipeline for a single fixture.
 *
 * @param fixture - the fixture to analyze.
 * @returns a complete, explainable prediction.
 */
export function predictFixture(fixture: Fixture): Prediction {
  const { home, away } = fixture;
  const poisson = poissonOutcome(home, away);
  const elo = strengthSplit(home, away);
  const blended = blendProbabilities(elo, poisson.probabilities);
  const edges = computeEdges(blended, fixture.odds);
  const formSamples = Math.min(home.form.length, away.form.length);
  const conf = confidence(blended, elo, poisson.probabilities, formSamples);
  const bestValue = detectValue(edges, fixture.odds);

  return {
    fixtureId: fixture.id,
    match: `${home.name} vs ${away.name}`,
    league: fixture.league,
    kickoff: fixture.kickoff,
    probabilities: {
      home: Math.round(blended.home * 100),
      draw: Math.round(blended.draw * 100),
      away: Math.round(blended.away * 100),
    },
    expectedGoals: { home: poisson.xg.home, away: poisson.xg.away },
    likelyScore: poisson.likelyScore,
    confidenceScore: conf,
    valueBet: bestValue !== null,
    bestValue,
    edges: edges.map((e) => ({
      outcome: e.outcome,
      modelProbability: e.modelProbability,
      impliedProbability: e.impliedProbability,
      edgePercentage: e.edgePercentage,
    })),
    explanation: explain(fixture, blended, poisson.xg),
  };
}

/** Run predictions for a batch of fixtures. */
export function predictAll(fixtures: Fixture[]): Prediction[] {
  return fixtures.map(predictFixture);
}

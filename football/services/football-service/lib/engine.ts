import type {
  Team,
  Fixture,
  Prediction,
  OutcomeProbabilities,
  MarketOdds,
  DataQuality,
  GoalMarkets,
  AsianHandicap,
  CorrectScoreGrid,
  KellyStake,
} from './types.js';

/**
 * Hybrid statistical prediction engine — v2.
 *
 * Improvements over v1:
 *  - Home/Away split averages: uses avgScoredHome/avgScoredAway for xG
 *  - Head-to-head adjustment: blends H2H historical tendency into probs
 *  - League-specific home advantage factor
 *  - Extended Poisson grid: Over/Under 1.5, 2.5, 3.5 + BTTS + correct scores + Asian handicap
 *  - Kelly Criterion stake recommendations (half-Kelly & quarter-Kelly)
 *  - Improved confidence: data quality + model agreement + H2H depth
 */

/** League-specific home advantage (ELO points). Higher = more benefit at home. */
const LEAGUE_HOME_ADVANTAGE: Record<string, number> = {
  PL:  60,   // Premier League
  PD:  55,   // La Liga
  SA:  68,   // Serie A
  BL1: 52,   // Bundesliga
  FL1: 58,   // Ligue 1
  DED: 62,   // Eredivisie
  PPL: 65,   // Primeira Liga
  CL:  48,   // Champions League (neutral tends lower)
  WC:  40,   // World Cup (mostly neutral venues)
};

const DEFAULT_HOME_ADVANTAGE = 60;
const MAX_GOALS = 9;
const POISSON_WEIGHT = 0.6;
const ELO_WEIGHT = 1 - POISSON_WEIGHT;
const VALUE_THRESHOLD = 3;
/** Maximum weight given to H2H adjustment (dampens outliers). */
const H2H_MAX_WEIGHT = 0.12;
/** Minimum H2H matches before we apply an adjustment. */
const H2H_MIN_MATCHES = 3;
/** Full Kelly is aggressive — we cap at 20% for the raw fraction. */
const KELLY_MAX_FRACTION = 0.20;

/** ELO win expectancy of A vs B. */
function expectedScore(eloA: number, eloB: number): number {
  return 1 / (1 + Math.pow(10, (eloB - eloA) / 400));
}

/** Home/away strength split with league-specific home advantage. */
function strengthSplit(
  home: Team,
  away: Team,
  homeAdv: number
): { home: number; away: number } {
  const h = expectedScore(home.elo + homeAdv, away.elo);
  return { home: h, away: 1 - h };
}

/** Poisson PMF. */
function poissonPmf(k: number, lambda: number): number {
  let fact = 1;
  for (let i = 2; i <= k; i++) fact *= i;
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / fact;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/**
 * Estimate expected goals using home/away split averages.
 * The home team uses its avgScoredHome; the away team uses avgScoredAway.
 * ELO strength tilts the base xG.
 */
function estimateXg(
  home: Team,
  away: Team,
  homeAdv: number
): { home: number; away: number } {
  const split = strengthSplit(home, away, homeAdv);
  // Use venue-split averages when available, fall back to overall.
  const homeScore = home.avgScoredHome > 0 ? home.avgScoredHome : home.avgScored;
  const awayConcede = away.avgConcededAway > 0 ? away.avgConcededAway : away.avgConceded;
  const awayScore = away.avgScoredAway > 0 ? away.avgScoredAway : away.avgScored;
  const homeConcede = home.avgConcededHome > 0 ? home.avgConcededHome : home.avgConceded;
  const baseHome = (homeScore + awayConcede) / 2;
  const baseAway = (awayScore + homeConcede) / 2;
  return {
    home: clamp(baseHome * (0.7 + split.home * 0.6), 0.2, 5.5),
    away: clamp(baseAway * (0.7 + split.away * 0.6), 0.2, 5.5),
  };
}

/**
 * Build the full Poisson scoreline grid (up to MAX_GOALSxMAX_GOALS).
 * Returns 1X2 probs, most likely score, and the raw grid for extended markets.
 */
function buildPoissonGrid(xgHome: number, xgAway: number) {
  const grid: number[][] = [];
  let pHome = 0, pDraw = 0, pAway = 0;
  let bestProb = 0, bestScore = '0-0';

  for (let h = 0; h <= MAX_GOALS; h++) {
    grid[h] = [];
    const ph = poissonPmf(h, xgHome);
    for (let a = 0; a <= MAX_GOALS; a++) {
      const p = ph * poissonPmf(a, xgAway);
      grid[h][a] = p;
      if (p > bestProb) { bestProb = p; bestScore = `${h}-${a}`; }
      if (h > a) pHome += p;
      else if (h === a) pDraw += p;
      else pAway += p;
    }
  }
  const total = pHome + pDraw + pAway;
  return {
    probabilities: { home: pHome / total, draw: pDraw / total, away: pAway / total },
    likelyScore: bestScore,
    grid,
  };
}

/**
 * Derive extended goal markets from the Poisson grid.
 */
function deriveGoalMarkets(grid: number[][]): GoalMarkets {
  let over15 = 0, over25 = 0, over35 = 0, btts = 0;
  for (let h = 0; h <= MAX_GOALS; h++) {
    for (let a = 0; a <= MAX_GOALS; a++) {
      const p = grid[h][a];
      if (h + a > 1.5) over15 += p;
      if (h + a > 2.5) over25 += p;
      if (h + a > 3.5) over35 += p;
      if (h > 0 && a > 0) btts += p;
    }
  }
  return {
    over15: clamp(over15, 0, 1),
    under15: clamp(1 - over15, 0, 1),
    over25: clamp(over25, 0, 1),
    under25: clamp(1 - over25, 0, 1),
    over35: clamp(over35, 0, 1),
    under35: clamp(1 - over35, 0, 1),
    btts: clamp(btts, 0, 1),
    bttsFail: clamp(1 - btts, 0, 1),
  };
}

/**
 * Top correct score probabilities (top 8 by probability).
 */
function deriveCorrectScores(grid: number[][]): CorrectScoreGrid {
  const scores: Array<{ score: string; probability: number }> = [];
  for (let h = 0; h <= 5; h++) {
    for (let a = 0; a <= 5; a++) {
      scores.push({ score: `${h}-${a}`, probability: grid[h]?.[a] ?? 0 });
    }
  }
  return scores
    .sort((a, b) => b.probability - a.probability)
    .slice(0, 8);
}

/**
 * Asian handicap probabilities from the Poisson grid.
 */
function deriveAsianHandicap(grid: number[][]): AsianHandicap {
  let homeWins = 0, awayWins = 0, draws = 0;
  let homeWinBy2Plus = 0, homeWinsOrDraws = 0;
  let awayWinsOrDraws = 0;
  for (let h = 0; h <= MAX_GOALS; h++) {
    for (let a = 0; a <= MAX_GOALS; a++) {
      const p = grid[h]?.[a] ?? 0;
      if (h > a) homeWins += p;
      else if (h === a) draws += p;
      else awayWins += p;
      if (h - a >= 2) homeWinBy2Plus += p;
      if (h >= a) homeWinsOrDraws += p;
      if (a >= h) awayWinsOrDraws += p;
    }
  }
  return {
    homeMinusHalf: clamp(homeWins, 0, 1),
    homePlusHalf: clamp(homeWins + draws, 0, 1),
    awayMinusHalf: clamp(awayWins, 0, 1),
    awayPlusHalf: clamp(awayWins + draws, 0, 1),
    homeMinus1: clamp(homeWinBy2Plus, 0, 1),
    homePlus1: clamp(homeWinsOrDraws, 0, 1),
  };
}

/** Decimal odds → margin-free implied probabilities. */
function impliedProbabilities(odds: MarketOdds): OutcomeProbabilities {
  const rawH = 1 / odds.home;
  const rawD = 1 / odds.draw;
  const rawA = 1 / odds.away;
  const over = rawH + rawD + rawA;
  return { home: rawH / over, draw: rawD / over, away: rawA / over };
}

/** Blend ELO and Poisson into a single probability estimate. */
function blend(
  elo: { home: number; away: number },
  poisson: OutcomeProbabilities
): OutcomeProbabilities {
  const drawMass = poisson.draw;
  const remaining = 1 - drawMass;
  const eloHome = elo.home * remaining;
  const eloAway = elo.away * remaining;
  const home = POISSON_WEIGHT * poisson.home + ELO_WEIGHT * eloHome;
  const away = POISSON_WEIGHT * poisson.away + ELO_WEIGHT * eloAway;
  const total = home + drawMass + away;
  return { home: home / total, draw: drawMass / total, away: away / total };
}

/**
 * Apply a head-to-head adjustment to blended probabilities.
 * If the last N h2h results strongly favour one side, we nudge the probs.
 * Max adjustment is H2H_MAX_WEIGHT to avoid overweighting small samples.
 */
function applyH2HAdjustment(
  probs: OutcomeProbabilities,
  h2h: Fixture['h2h']
): OutcomeProbabilities {
  if (h2h.length < H2H_MIN_MATCHES) return probs;
  const last = h2h.slice(-5);
  const homeW = last.filter((r) => r.outcome === 'home').length / last.length;
  const awayW = last.filter((r) => r.outcome === 'away').length / last.length;
  const drawW = last.filter((r) => r.outcome === 'draw').length / last.length;
  const weight = Math.min(H2H_MAX_WEIGHT, H2H_MAX_WEIGHT * (last.length / 5));
  const adj = {
    home: probs.home + weight * (homeW - probs.home),
    draw: probs.draw + weight * (drawW - probs.draw),
    away: probs.away + weight * (awayW - probs.away),
  };
  const total = adj.home + adj.draw + adj.away;
  return { home: adj.home / total, draw: adj.draw / total, away: adj.away / total };
}

/**
 * Kelly Criterion stake calculation.
 * f = (p*b - q) / b  where b = decimal_odds - 1, p = model prob, q = 1 - p.
 */
function kellyFraction(modelProb: number, decimalOdds: number): number {
  const b = decimalOdds - 1;
  const q = 1 - modelProb;
  const f = (modelProb * b - q) / b;
  return clamp(f, 0, KELLY_MAX_FRACTION);
}

/** Build Kelly stakes for outcomes/markets with positive edge. */
function buildKellyStakes(
  probs: OutcomeProbabilities,
  goalMarkets: GoalMarkets,
  odds: MarketOdds | null,
  edges: Prediction['edges']
): KellyStake[] {
  const stakes: KellyStake[] = [];
  // 1X2 from real odds.
  for (const edge of edges) {
    if (edge.edgePercentage <= 0 || !odds) continue;
    const decOdds = odds[edge.outcome];
    const kf = kellyFraction(edge.modelProbability, decOdds);
    if (kf <= 0) continue;
    stakes.push({
      outcome: edge.outcome,
      modelProbability: edge.modelProbability,
      odds: decOdds,
      edgePercentage: edge.edgePercentage,
      kellyFraction: kf,
      halfKelly: kf / 2,
      quarterKelly: kf / 4,
    });
  }
  // Over 2.5 — approximate market odds from implied prob if no real odds.
  const o25Prob = goalMarkets.over25;
  const u25Prob = goalMarkets.under25;
  // We don't have goal market odds from the odds API currently — so skip if no real odds.
  // But we surface the probabilities for informational use.
  void o25Prob; void u25Prob;
  return stakes.sort((a, b) => b.edgePercentage - a.edgePercentage);
}

/** Confidence 1-10. */
function confidence(
  blended: OutcomeProbabilities,
  elo: { home: number; away: number },
  poisson: OutcomeProbabilities,
  formSamples: number,
  h2hCount: number
): number {
  const sorted = [blended.home, blended.draw, blended.away].sort((a, b) => b - a);
  const gap = sorted[0] - sorted[1];
  const agreement = 1 - Math.min(1, Math.abs(elo.home - poisson.home));
  const dataConsistency = Math.min(1, formSamples / 5);
  const h2hBonus = Math.min(0.1, h2hCount * 0.015);
  const raw = gap * 0.45 + agreement * 0.3 + dataConsistency * 0.15 + h2hBonus;
  return Math.max(1, Math.min(10, Math.round(1 + raw * 9)));
}

/** Build explanation bullets. */
function explain(
  fixture: Fixture,
  blended: OutcomeProbabilities,
  xg: { home: number; away: number },
  goalMarkets: GoalMarkets,
  homeAdv: number
): string[] {
  const reasons: string[] = [];
  const { home, away } = fixture;

  if (!home.hasData && !away.hasData) {
    reasons.push('⚠ No recent results for either side — market-neutral estimate');
  } else if (!home.hasData) {
    reasons.push(`⚠ Limited data for ${home.name} — treat with caution`);
  } else if (!away.hasData) {
    reasons.push(`⚠ Limited data for ${away.name} — treat with caution`);
  }

  // Home/away venue split.
  if (home.avgScoredHome > home.avgScored * 1.15) {
    reasons.push(`${home.name} score significantly more at home (${home.avgScoredHome.toFixed(2)} vs ${home.avgScored.toFixed(2)}/game overall)`);
  }
  if (away.avgScoredAway < away.avgScored * 0.85) {
    reasons.push(`${away.name} struggle away (${away.avgScoredAway.toFixed(2)} away vs ${away.avgScored.toFixed(2)}/game overall)`);
  }

  const homeWins = home.form.filter((r) => r === 'W').length;
  const awayWins = away.form.filter((r) => r === 'W').length;
  if (homeWins >= 3) reasons.push(`${home.name} in strong form (${homeWins}W in last ${home.form.length})`);
  if (awayWins >= 3) reasons.push(`${away.name} in strong form (${awayWins}W in last ${away.form.length})`);
  if (homeWins <= 1 && home.form.length >= 3) reasons.push(`${home.name} struggling recently`);
  if (awayWins <= 1 && away.form.length >= 3) reasons.push(`${away.name} struggling recently`);

  const eloDiff = Math.round(home.elo - away.elo);
  if (Math.abs(eloDiff) > 60) {
    reasons.push(`${eloDiff > 0 ? home.name : away.name} stronger by rating (${Math.abs(eloDiff)} pts ELO)`);
  }

  if (homeAdv > 70) {
    reasons.push(`High home advantage league (+${homeAdv} ELO pts)`);
  }

  // H2H.
  if (fixture.h2h.length >= H2H_MIN_MATCHES) {
    const last5 = fixture.h2h.slice(-5);
    const hw = last5.filter((r) => r.outcome === 'home').length;
    const aw = last5.filter((r) => r.outcome === 'away').length;
    if (hw >= 3) reasons.push(`H2H: ${home.name} won ${hw} of last ${last5.length} meetings`);
    else if (aw >= 3) reasons.push(`H2H: ${away.name} won ${aw} of last ${last5.length} meetings`);
    else reasons.push(`H2H: closely contested (last ${last5.length} meetings)`);
    const avgG = last5.reduce((s, r) => s + r.homeGoals + r.awayGoals, 0) / last5.length;
    if (avgG > 2.8) reasons.push(`H2H: high-scoring meetings (avg ${avgG.toFixed(1)} goals)`);
    else if (avgG < 1.8) reasons.push(`H2H: tight matches (avg ${avgG.toFixed(1)} goals)`);
  }

  reasons.push(`xG: ${xg.home.toFixed(2)} – ${xg.away.toFixed(2)}`);

  if (goalMarkets.over25 > 0.60) {
    reasons.push(`Goal-rich game expected (O2.5: ${(goalMarkets.over25 * 100).toFixed(0)}%)`);
  }
  if (goalMarkets.btts > 0.58) {
    reasons.push(`Both teams likely to score (BTTS: ${(goalMarkets.btts * 100).toFixed(0)}%)`);
  }
  if (goalMarkets.under25 > 0.60) {
    reasons.push(`Low-scoring game expected (U2.5: ${(goalMarkets.under25 * 100).toFixed(0)}%)`);
  }

  if (fixture.odds) {
    const implied = impliedProbabilities(fixture.odds);
    const fav = blended.home >= blended.away ? 'home' : 'away';
    const favName = fav === 'home' ? home.name : away.name;
    if (blended[fav] - implied[fav] > 0.04) reasons.push(`Market undervalues ${favName}`);
  }
  return reasons;
}

/**
 * Run the full hybrid prediction pipeline for one fixture.
 * @param fixture - normalized fixture with team stats, h2h, and odds.
 * @returns fully explainable prediction with extended markets and Kelly stakes.
 */
export function predictFixture(fixture: Fixture): Prediction {
  const { home, away, h2h } = fixture;
  const homeAdv = LEAGUE_HOME_ADVANTAGE[fixture.leagueCode] ?? DEFAULT_HOME_ADVANTAGE;
  const xg = estimateXg(home, away, homeAdv);
  const poissonResult = buildPoissonGrid(xg.home, xg.away);
  const elo = strengthSplit(home, away, homeAdv);
  let blended = blend(elo, poissonResult.probabilities);
  blended = applyH2HAdjustment(blended, h2h);

  const formSamples = Math.min(home.form.length, away.form.length);
  let conf = confidence(blended, elo, poissonResult.probabilities, formSamples, h2h.length);

  const dataQuality: DataQuality =
    home.hasData && away.hasData ? 'full'
    : home.hasData || away.hasData ? 'partial'
    : 'insufficient';

  if (dataQuality === 'insufficient') conf = Math.min(conf, 2);
  else if (dataQuality === 'partial') conf = Math.min(conf, 5);

  // Derive extended markets.
  const goalMarkets = deriveGoalMarkets(poissonResult.grid);
  const correctScores = deriveCorrectScores(poissonResult.grid);
  const asianHandicap = deriveAsianHandicap(poissonResult.grid);

  // H2H summary.
  const last5h2h = h2h.slice(-5);
  const h2hSummary = {
    played: last5h2h.length,
    homeWins: last5h2h.filter((r) => r.outcome === 'home').length,
    draws: last5h2h.filter((r) => r.outcome === 'draw').length,
    awayWins: last5h2h.filter((r) => r.outcome === 'away').length,
    avgGoals: last5h2h.length
      ? last5h2h.reduce((s, r) => s + r.homeGoals + r.awayGoals, 0) / last5h2h.length
      : 0,
    bttsRate: last5h2h.length
      ? last5h2h.filter((r) => r.homeGoals > 0 && r.awayGoals > 0).length / last5h2h.length
      : 0,
  };

  let edges: Prediction['edges'] = [];
  let bestValue: Prediction['bestValue'] = null;
  if (fixture.odds && dataQuality !== 'insufficient') {
    const implied = impliedProbabilities(fixture.odds);
    edges = (['home', 'draw', 'away'] as const)
      .map((o) => ({
        outcome: o,
        modelProbability: blended[o],
        impliedProbability: implied[o],
        edgePercentage: (blended[o] - implied[o]) * 100,
      }))
      .sort((a, b) => b.edgePercentage - a.edgePercentage);
    const best = edges[0];
    if (best && best.edgePercentage >= VALUE_THRESHOLD) {
      bestValue = {
        outcome: best.outcome,
        edgePercentage: best.edgePercentage,
        modelProbability: best.modelProbability,
        impliedProbability: best.impliedProbability,
        odds: fixture.odds[best.outcome],
      };
    }
  }

  const kellyStakes = buildKellyStakes(blended, goalMarkets, fixture.odds, edges);

  return {
    fixtureId: fixture.id,
    match: `${home.name} vs ${away.name}`,
    league: fixture.league,
    leagueCode: fixture.leagueCode,
    leagueLogo: fixture.leagueLogo,
    kickoff: fixture.kickoff,
    homeName: home.name,
    awayName: away.name,
    homeLogo: home.logo,
    awayLogo: away.logo,
    homeForm: home.form,
    awayForm: away.form,
    odds: fixture.odds,
    dataQuality,
    probabilities: {
      home: Math.round(blended.home * 100),
      draw: Math.round(blended.draw * 100),
      away: Math.round(blended.away * 100),
    },
    expectedGoals: xg,
    likelyScore: poissonResult.likelyScore,
    confidenceScore: conf,
    valueBet: bestValue !== null,
    bestValue,
    edges,
    goalMarkets,
    correctScores,
    asianHandicap,
    kellyStakes,
    h2hSummary,
    homeAdvantageFactor: homeAdv,
    explanation: explain(fixture, blended, xg, goalMarkets, homeAdv),
  };
}

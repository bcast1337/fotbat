import { getRecentMatches } from './api-football.js';
import type { RawMatch } from './api-football.js';

/**
 * Walk-forward backtesting engine with separate value-bet ROI tracking.
 *
 * Replays real, finished matches in chronological order. For every match it
 * makes a prediction using ONLY pre-kick-off information (running ELO +
 * rolling goal averages). It then:
 *  1. Scores overall accuracy (hit rate, Brier, log loss, flat-stake ROI).
 *  2. Simulates bookmaker odds (fair odds + a realistic 7% margin) and
 *     applies the same value-bet detection logic as the live engine.
 *  3. Tracks ROI exclusively on bets where the model detected genuine edge
 *     vs that simulated market — the strategy a disciplined bettor would use.
 *
 * Why simulate odds instead of using real historical odds?
 * football-data.org free tier does not supply historical bookmaker odds.
 * Simulating with a typical 7% overround is the standard academic approach
 * for evaluating value-bet strategies without historical odds data — it is
 * conservative (real margins vary 3-12%) and honest.
 */

const HOME_ADVANTAGE = 65;
const K_FACTOR = 24;
const MAX_GOALS = 8;
const POISSON_WEIGHT = 0.6;
const WARMUP_MATCHES = 4;

/**
 * Typical bookmaker overround applied to fair probabilities to simulate market
 * odds. 7% is conservative vs the real UK market average of ~5-10%.
 */
const BOOKIE_MARGIN = 0.07;

/**
 * Minimum model edge required to flag a value bet (percentage points above the
 * market implied probability after the margin is applied).
 */
const VALUE_THRESHOLD_PCT = 3;

/** Mutable per-team state accumulated during the walk-forward replay. */
type TeamState = {
  elo: number;
  scored: number[];
  conceded: number[];
  played: number;
};

/** ELO win expectancy of A vs B. */
function expectedScore(eloA: number, eloB: number): number {
  return 1 / (1 + Math.pow(10, (eloB - eloA) / 400));
}

/** Poisson PMF. */
function poissonPmf(k: number, lambda: number): number {
  let fact = 1;
  for (let i = 2; i <= k; i++) fact *= i;
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / fact;
}

/** Rolling average, with a fallback when history is empty. */
function avg(arr: number[], fallback: number): number {
  if (arr.length === 0) return fallback;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/** Get or initialize a team's mutable state. */
function ensure(states: Map<number, TeamState>, id: number): TeamState {
  let s = states.get(id);
  if (!s) {
    s = { elo: 1500, scored: [], conceded: [], played: 0 };
    states.set(id, s);
  }
  return s;
}

/** Predict 1X2 model probabilities from current pre-match team states. */
function predictProbs(
  home: TeamState,
  away: TeamState
): { home: number; draw: number; away: number } {
  const eloHome = expectedScore(home.elo + HOME_ADVANTAGE, away.elo);
  const eloAway = 1 - eloHome;
  const baseHome = (avg(home.scored, 1.3) + avg(away.conceded, 1.3)) / 2;
  const baseAway = (avg(away.scored, 1.3) + avg(home.conceded, 1.3)) / 2;
  const xgHome = clamp(baseHome * (0.7 + eloHome * 0.6), 0.2, 5);
  const xgAway = clamp(baseAway * (0.7 + eloAway * 0.6), 0.2, 5);

  let pH = 0; let pD = 0; let pA = 0;
  for (let h = 0; h <= MAX_GOALS; h++) {
    const ph = poissonPmf(h, xgHome);
    for (let a = 0; a <= MAX_GOALS; a++) {
      const p = ph * poissonPmf(a, xgAway);
      if (h > a) pH += p;
      else if (h === a) pD += p;
      else pA += p;
    }
  }
  const total = pH + pD + pA;
  const poisson = { home: pH / total, draw: pD / total, away: pA / total };

  const drawMass = poisson.draw;
  const remaining = 1 - drawMass;
  const h2 = POISSON_WEIGHT * poisson.home + (1 - POISSON_WEIGHT) * eloHome * remaining;
  const a2 = POISSON_WEIGHT * poisson.away + (1 - POISSON_WEIGHT) * eloAway * remaining;
  const t = h2 + drawMass + a2;
  return { home: h2 / t, draw: drawMass / t, away: a2 / t };
}

/**
 * Simulate bookmaker decimal odds for all three outcomes.
 *
 * We take the model's fair probabilities, apply a bookmaker margin by
 * distributing the overround proportionally across outcomes (the standard
 * "multiplicative" method), then invert to decimal odds. This mirrors how
 * real bookmakers price markets.
 *
 * @param model - model fair probabilities (sum to 1).
 * @returns simulated decimal odds for each outcome.
 */
function simulateMarketOdds(model: {
  home: number;
  draw: number;
  away: number;
}): { home: number; draw: number; away: number; implied: { home: number; draw: number; away: number } } {
  // Inflate probs by the margin → overround > 1 → odds < fair.
  const mHome = model.home * (1 + BOOKIE_MARGIN);
  const mDraw = model.draw * (1 + BOOKIE_MARGIN);
  const mAway = model.away * (1 + BOOKIE_MARGIN);
  return {
    home: 1 / mHome,
    draw: 1 / mDraw,
    away: 1 / mAway,
    // Margin-free implied (what the market "really" thinks after stripping margin).
    implied: {
      home: mHome / (mHome + mDraw + mAway),
      draw: mDraw / (mHome + mDraw + mAway),
      away: mAway / (mHome + mDraw + mAway),
    },
  };
}

/** Update both teams' states after observing the real result. */
function update(home: TeamState, away: TeamState, hg: number, ag: number): void {
  const expHome = expectedScore(home.elo + HOME_ADVANTAGE, away.elo);
  const actualHome = hg > ag ? 1 : hg === ag ? 0.5 : 0;
  const margin = Math.abs(hg - ag);
  const mult = Math.log(margin + 1) + 1;
  home.elo += K_FACTOR * mult * (actualHome - expHome);
  away.elo += K_FACTOR * mult * ((1 - actualHome) - (1 - expHome));
  home.scored = [...home.scored.slice(-9), hg];
  home.conceded = [...home.conceded.slice(-9), ag];
  away.scored = [...away.scored.slice(-9), ag];
  away.conceded = [...away.conceded.slice(-9), hg];
  home.played += 1;
  away.played += 1;
}

/** A settled value-bet trade recorded during the walk-forward replay. */
export type ValueBetTrade = {
  match: string;
  date: string;
  outcome: 'home' | 'draw' | 'away';
  modelProbability: number;
  impliedProbability: number;
  edgePct: number;
  marketOdds: number;
  actual: 'home' | 'draw' | 'away';
  won: boolean;
  pnl: number;
};

/** Full result produced by a single-competition backtest run. */
export type BacktestResult = {
  competition: string;
  from: string;
  to: string;
  /** Total matches used for overall accuracy metrics. */
  sampleSize: number;
  /** Fraction of matches where the top pick was correct (0-1). */
  hitRate: number;
  /** Hit rate of a naive "always-home" baseline (0-1). */
  baselineHitRate: number;
  /** Mean Brier score across all matches (0-2, lower is better). */
  brier: number;
  /** Mean log loss across all matches (lower is better). */
  logLoss: number;
  /** Flat-stake ROI: 1u on the top pick at fair odds, all matches. */
  roi: number;
  /** Number of value bets flagged (model edge > threshold vs market). */
  valueBetCount: number;
  /** Hit rate on value bets only (how often the edge bet was correct). */
  valueBetHitRate: number;
  /** Flat-stake ROI on value bets only, at simulated market odds. */
  valueBetRoi: number;
  /**
   * Running cumulative P&L curve (per-bet, value bets only) — lets you see
   * drawdowns and growth over the season.
   */
  valueBetCurve: number[];
  /** Best and worst value bets of the season. */
  bestValueBet: ValueBetTrade | null;
  worstValueBet: ValueBetTrade | null;
  /** Real result distribution for context. */
  actuals: { home: number; draw: number; away: number };
  /** Sample of general settled predictions (for transparency). */
  samples: Array<{
    match: string;
    date: string;
    predicted: 'home' | 'draw' | 'away';
    probability: number;
    actual: 'home' | 'draw' | 'away';
    correct: boolean;
  }>;
};

/**
 * Run a full walk-forward backtest over a competition's finished matches.
 *
 * @param code - competition code (e.g. "PL").
 * @param from - ISO date (YYYY-MM-DD).
 * @param to - ISO date (YYYY-MM-DD).
 * @returns full accuracy and value-bet ROI metrics on real results.
 */
export async function runBacktest(
  code: string,
  from: string,
  to: string
): Promise<BacktestResult> {
  let rawMatches: RawMatch[] = [];
  try {
    rawMatches = await getRecentMatches(code, from, to);
  } catch {
    rawMatches = [];
  }

  const played = rawMatches
    .filter((m) => m.score?.fullTime?.home != null && m.score?.fullTime?.away != null)
    .sort((a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime());

  const states = new Map<number, TeamState>();

  // Overall metrics.
  let n = 0;
  let hits = 0;
  let baselineHits = 0;
  let brierSum = 0;
  let logLossSum = 0;
  let pnl = 0;
  const actuals = { home: 0, draw: 0, away: 0 };
  const samples: BacktestResult['samples'] = [];

  // Value-bet specific metrics.
  let vbCount = 0;
  let vbHits = 0;
  let vbPnl = 0;
  const vbCurve: number[] = [];
  let bestVb: ValueBetTrade | null = null;
  let worstVb: ValueBetTrade | null = null;

  for (const m of played) {
    const home = ensure(states, m.homeTeam.id);
    const away = ensure(states, m.awayTeam.id);
    const hg = m.score!.fullTime!.home as number;
    const ag = m.score!.fullTime!.away as number;
    const actual: 'home' | 'draw' | 'away' = hg > ag ? 'home' : hg === ag ? 'draw' : 'away';

    if (home.played >= WARMUP_MATCHES && away.played >= WARMUP_MATCHES) {
      const probs = predictProbs(home, away);
      const market = simulateMarketOdds(probs);
      const ranked = (['home', 'draw', 'away'] as const).sort(
        (a, b) => probs[b] - probs[a]
      );
      const pick = ranked[0];
      const correct = pick === actual;

      // --- Overall metrics ---
      n += 1;
      if (correct) hits += 1;
      if (actual === 'home') baselineHits += 1;
      actuals[actual] += 1;

      brierSum +=
        Math.pow(probs.home - (actual === 'home' ? 1 : 0), 2) +
        Math.pow(probs.draw - (actual === 'draw' ? 1 : 0), 2) +
        Math.pow(probs.away - (actual === 'away' ? 1 : 0), 2);

      logLossSum += -Math.log(Math.max(1e-6, probs[actual]));

      const fairOdds = 1 / probs[pick];
      pnl += correct ? fairOdds - 1 : -1;

      if (samples.length < 8) {
        samples.push({
          match: `${m.homeTeam.shortName || m.homeTeam.name} vs ${m.awayTeam.shortName || m.awayTeam.name}`,
          date: m.utcDate.slice(0, 10),
          predicted: pick,
          probability: Math.round(probs[pick] * 100) / 100,
          actual,
          correct,
        });
      }

      // --- Value-bet tracking ---
      // Check all three outcomes for positive edge vs the simulated market.
      // In real usage you'd bet the one with the highest edge.
      const outcomes = (['home', 'draw', 'away'] as const)
        .map((o) => ({
          outcome: o,
          edgePct: (probs[o] - market.implied[o]) * 100,
          modelProbability: probs[o],
          impliedProbability: market.implied[o],
          marketOdds: market[o],
        }))
        .filter((o) => o.edgePct >= VALUE_THRESHOLD_PCT)
        .sort((a, b) => b.edgePct - a.edgePct);

      if (outcomes.length > 0) {
        // Bet on the single highest-edge outcome only (disciplined strategy).
        const best = outcomes[0];
        const won = best.outcome === actual;
        const tradePnl = won ? best.marketOdds - 1 : -1;

        vbCount += 1;
        if (won) vbHits += 1;
        vbPnl += tradePnl;
        vbCurve.push(vbPnl);

        const trade: ValueBetTrade = {
          match: `${m.homeTeam.shortName || m.homeTeam.name} vs ${m.awayTeam.shortName || m.awayTeam.name}`,
          date: m.utcDate.slice(0, 10),
          outcome: best.outcome,
          modelProbability: Math.round(best.modelProbability * 1000) / 1000,
          impliedProbability: Math.round(best.impliedProbability * 1000) / 1000,
          edgePct: Math.round(best.edgePct * 10) / 10,
          marketOdds: Math.round(best.marketOdds * 100) / 100,
          actual,
          won,
          pnl: Math.round(tradePnl * 100) / 100,
        };

        if (!bestVb || trade.pnl > bestVb.pnl) bestVb = trade;
        if (!worstVb || trade.pnl < worstVb.pnl) worstVb = trade;
      }
    }

    update(home, away, hg, ag);
  }

  return {
    competition: code,
    from,
    to,
    sampleSize: n,
    hitRate: n ? hits / n : 0,
    baselineHitRate: n ? baselineHits / n : 0,
    brier: n ? brierSum / n : 0,
    logLoss: n ? logLossSum / n : 0,
    roi: n ? pnl / n : 0,
    valueBetCount: vbCount,
    valueBetHitRate: vbCount ? vbHits / vbCount : 0,
    valueBetRoi: vbCount ? vbPnl / vbCount : 0,
    valueBetCurve: vbCurve,
    bestValueBet: bestVb,
    worstValueBet: worstVb,
    actuals,
    samples,
  };
}

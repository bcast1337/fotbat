import { getRecentMatches } from './api-football.js';
import type { RawMatch } from './api-football.js';

const HOME_ADVANTAGE = 65, K_FACTOR = 24, MAX_GOALS = 8, POISSON_WEIGHT = 0.6, WARMUP_MATCHES = 4, BOOKIE_MARGIN = 0.07, VALUE_THRESHOLD_PCT = 3;

type TeamState = { elo: number; scored: number[]; conceded: number[]; played: number };

function expectedScore(eloA: number, eloB: number): number { return 1 / (1 + Math.pow(10, (eloB - eloA) / 400)); }
function poissonPmf(k: number, lambda: number): number { let fact = 1; for (let i = 2; i <= k; i++) fact *= i; return (Math.pow(lambda, k) * Math.exp(-lambda)) / fact; }
function avg(arr: number[], fallback: number): number { return arr.length === 0 ? fallback : arr.reduce((s, v) => s + v, 0) / arr.length; }
function clamp(v: number, min: number, max: number): number { return Math.max(min, Math.min(max, v)); }
function ensure(states: Map<number, TeamState>, id: number): TeamState { let s = states.get(id); if (!s) { s = { elo: 1500, scored: [], conceded: [], played: 0 }; states.set(id, s); } return s; }

function predictProbs(home: TeamState, away: TeamState) {
  const eloHome = expectedScore(home.elo + HOME_ADVANTAGE, away.elo), eloAway = 1 - eloHome;
  const xgHome = clamp(((avg(home.scored, 1.3) + avg(away.conceded, 1.3)) / 2) * (0.7 + eloHome * 0.6), 0.2, 5);
  const xgAway = clamp(((avg(away.scored, 1.3) + avg(home.conceded, 1.3)) / 2) * (0.7 + eloAway * 0.6), 0.2, 5);
  let pH = 0, pD = 0, pA = 0;
  for (let h = 0; h <= MAX_GOALS; h++) { const ph = poissonPmf(h, xgHome); for (let a = 0; a <= MAX_GOALS; a++) { const p = ph * poissonPmf(a, xgAway); if (h > a) pH += p; else if (h === a) pD += p; else pA += p; } }
  const total = pH + pD + pA; const poisson = { home: pH / total, draw: pD / total, away: pA / total };
  const drawMass = poisson.draw, remaining = 1 - drawMass;
  const h2 = POISSON_WEIGHT * poisson.home + (1 - POISSON_WEIGHT) * eloHome * remaining;
  const a2 = POISSON_WEIGHT * poisson.away + (1 - POISSON_WEIGHT) * eloAway * remaining;
  const t = h2 + drawMass + a2;
  return { home: h2 / t, draw: drawMass / t, away: a2 / t };
}

function simulateMarketOdds(model: { home: number; draw: number; away: number }) {
  const mH = model.home * (1 + BOOKIE_MARGIN), mD = model.draw * (1 + BOOKIE_MARGIN), mA = model.away * (1 + BOOKIE_MARGIN), s = mH + mD + mA;
  return { home: 1 / mH, draw: 1 / mD, away: 1 / mA, implied: { home: mH / s, draw: mD / s, away: mA / s } };
}

function update(home: TeamState, away: TeamState, hg: number, ag: number): void {
  const expHome = expectedScore(home.elo + HOME_ADVANTAGE, away.elo), actualHome = hg > ag ? 1 : hg === ag ? 0.5 : 0, mult = Math.log(Math.abs(hg - ag) + 1) + 1;
  home.elo += K_FACTOR * mult * (actualHome - expHome); away.elo += K_FACTOR * mult * ((1 - actualHome) - (1 - expHome));
  home.scored = [...home.scored.slice(-9), hg]; home.conceded = [...home.conceded.slice(-9), ag];
  away.scored = [...away.scored.slice(-9), ag]; away.conceded = [...away.conceded.slice(-9), hg];
  home.played++; away.played++;
}

export type ValueBetTrade = { match: string; date: string; outcome: 'home' | 'draw' | 'away'; modelProbability: number; impliedProbability: number; edgePct: number; marketOdds: number; actual: 'home' | 'draw' | 'away'; won: boolean; pnl: number };

export type BacktestResult = { competition: string; from: string; to: string; sampleSize: number; hitRate: number; baselineHitRate: number; brier: number; logLoss: number; roi: number; valueBetCount: number; valueBetHitRate: number; valueBetRoi: number; valueBetCurve: number[]; bestValueBet: ValueBetTrade | null; worstValueBet: ValueBetTrade | null; actuals: { home: number; draw: number; away: number }; samples: Array<{ match: string; date: string; predicted: 'home' | 'draw' | 'away'; probability: number; actual: 'home' | 'draw' | 'away'; correct: boolean }> };

export async function runBacktest(code: string, from: string, to: string): Promise<BacktestResult> {
  let rawMatches: RawMatch[] = [];
  try { rawMatches = await getRecentMatches(code, from, to); } catch { rawMatches = []; }
  const played = rawMatches.filter((m) => m.score?.fullTime?.home != null && m.score?.fullTime?.away != null).sort((a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime());
  const states = new Map<number, TeamState>();
  let n = 0, hits = 0, baselineHits = 0, brierSum = 0, logLossSum = 0, pnl = 0, vbCount = 0, vbHits = 0, vbPnl = 0;
  const actuals = { home: 0, draw: 0, away: 0 }; const samples: BacktestResult['samples'] = []; const vbCurve: number[] = []; let bestVb: ValueBetTrade | null = null; let worstVb: ValueBetTrade | null = null;
  for (const m of played) {
    const home = ensure(states, m.homeTeam.id); const away = ensure(states, m.awayTeam.id);
    const hg = m.score!.fullTime!.home as number; const ag = m.score!.fullTime!.away as number;
    const actual: 'home' | 'draw' | 'away' = hg > ag ? 'home' : hg === ag ? 'draw' : 'away';
    if (home.played >= WARMUP_MATCHES && away.played >= WARMUP_MATCHES) {
      const probs = predictProbs(home, away); const market = simulateMarketOdds(probs);
      const pickArr: Array<'home' | 'draw' | 'away'> = ['home', 'draw', 'away'];
      const pick = pickArr.slice().sort((a, b) => probs[b] - probs[a])[0] as 'home' | 'draw' | 'away';
      const correct = pick === actual;
      n++; if (correct) hits++; if (actual === 'home') baselineHits++; actuals[actual]++;
      brierSum += Math.pow(probs.home - (actual === 'home' ? 1 : 0), 2) + Math.pow(probs.draw - (actual === 'draw' ? 1 : 0), 2) + Math.pow(probs.away - (actual === 'away' ? 1 : 0), 2);
      logLossSum += -Math.log(Math.max(1e-6, probs[actual])); pnl += correct ? 1 / probs[pick] - 1 : -1;
      if (samples.length < 8) samples.push({ match: `${m.homeTeam.shortName || m.homeTeam.name} vs ${m.awayTeam.shortName || m.awayTeam.name}`, date: m.utcDate.slice(0, 10), predicted: pick, probability: Math.round(probs[pick] * 100) / 100, actual, correct });
      const outcomeKeys: Array<'home' | 'draw' | 'away'> = ['home', 'draw', 'away'];
      const outcomes = outcomeKeys.map((o) => ({ outcome: o, edgePct: (probs[o] - market.implied[o]) * 100, modelProbability: probs[o], impliedProbability: market.implied[o], marketOdds: market[o] })).filter((o) => o.edgePct >= VALUE_THRESHOLD_PCT).sort((a, b) => b.edgePct - a.edgePct);
      if (outcomes.length > 0) {
        const best = outcomes[0]; const won = best.outcome === actual; const tradePnl = won ? best.marketOdds - 1 : -1;
        vbCount++; if (won) vbHits++; vbPnl += tradePnl; vbCurve.push(vbPnl);
        const trade: ValueBetTrade = { match: `${m.homeTeam.shortName || m.homeTeam.name} vs ${m.awayTeam.shortName || m.awayTeam.name}`, date: m.utcDate.slice(0, 10), outcome: best.outcome, modelProbability: Math.round(best.modelProbability * 1000) / 1000, impliedProbability: Math.round(best.impliedProbability * 1000) / 1000, edgePct: Math.round(best.edgePct * 10) / 10, marketOdds: Math.round(best.marketOdds * 100) / 100, actual, won, pnl: Math.round(tradePnl * 100) / 100 };
        if (!bestVb || trade.pnl > bestVb.pnl) bestVb = trade; if (!worstVb || trade.pnl < worstVb.pnl) worstVb = trade;
      }
    }
    update(home, away, hg, ag);
  }
  return { competition: code, from, to, sampleSize: n, hitRate: n ? hits / n : 0, baselineHitRate: n ? baselineHits / n : 0, brier: n ? brierSum / n : 0, logLoss: n ? logLossSum / n : 0, roi: n ? pnl / n : 0, valueBetCount: vbCount, valueBetHitRate: vbCount ? vbHits / vbCount : 0, valueBetRoi: vbCount ? vbPnl / vbCount : 0, valueBetCurve: vbCurve, bestValueBet: bestVb, worstValueBet: worstVb, actuals, samples };
}

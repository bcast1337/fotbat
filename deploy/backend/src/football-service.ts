import type { Prediction } from './lib/types.js';
import { getNormalizedFixtures } from './lib/normalizer.js';
import { predictFixture } from './lib/engine.js';
import { runBacktest, type BacktestResult } from './lib/backtest.js';
import { cache } from './lib/cache.js';

export class FootballService {
  private addDays(date: string, days: number): string {
    const d = new Date(date + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  }

  async getPredictions(from?: string, days = 7): Promise<Prediction[]> {
    const start = from ?? new Date().toISOString().slice(0, 10);
    const span = Math.max(1, Math.min(10, days));
    const end = this.addDays(start, span);
    return cache.wrap(`predictions:${start}:${end}`, 15 * 60 * 1000, async () => {
      const fixtures = await getNormalizedFixtures(start, end);
      const predictions = fixtures.map(predictFixture);
      return predictions.sort((a, b) => {
        const av = a.bestValue?.edgePercentage ?? -Infinity;
        const bv = b.bestValue?.edgePercentage ?? -Infinity;
        if (bv !== av) return bv - av;
        if (b.confidenceScore !== a.confidenceScore) return b.confidenceScore - a.confidenceScore;
        return new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime();
      });
    });
  }

  async getValueBets(from?: string, days = 7): Promise<Prediction[]> {
    return (await this.getPredictions(from, days)).filter((p) => p.valueBet);
  }

  async getStats(from?: string, days = 7) {
    const start = from ?? new Date().toISOString().slice(0, 10);
    const all = await this.getPredictions(start, days);
    const valueBets = all.filter((p) => p.valueBet).length;
    const avgConfidence = all.reduce((s, p) => s + p.confidenceScore, 0) / (all.length || 1);
    return { from: start, matches: all.length, valueBets, avgConfidence: Math.round(avgConfidence * 10) / 10, apiConfigured: Boolean(process.env.API_FOOTBALL_KEY), oddsConfigured: Boolean(process.env.ODDS_API_KEY) };
  }

  private seasonStart(): string {
    const now = new Date();
    const year = now.getUTCMonth() >= 7 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
    return `${year}-08-01`;
  }

  async getBacktest(code = 'PL'): Promise<BacktestResult> {
    const from = this.seasonStart();
    const to = new Date().toISOString().slice(0, 10);
    return cache.wrap(`backtest:${code}:${from}:${to}`, 12 * 60 * 60 * 1000, () => runBacktest(code, from, to));
  }

  async getBacktestSummary() {
    const codes = ['PL', 'PD', 'SA', 'BL1', 'FL1'];
    const results: BacktestResult[] = [];
    for (const c of codes) results.push(await this.getBacktest(c));
    const withData = results.filter((r) => r.sampleSize > 0);
    const total = withData.reduce((s, r) => s + r.sampleSize, 0);
    const totalVb = withData.reduce((s, r) => s + r.valueBetCount, 0);
    const weighted = (sel: (r: BacktestResult) => number): number => total ? withData.reduce((s, r) => s + sel(r) * r.sampleSize, 0) / total : 0;
    const weightedVb = (sel: (r: BacktestResult) => number): number => totalVb ? withData.reduce((s, r) => s + sel(r) * r.valueBetCount, 0) / totalVb : 0;
    return { sampleSize: total, hitRate: weighted((r) => r.hitRate), baselineHitRate: weighted((r) => r.baselineHitRate), brier: weighted((r) => r.brier), logLoss: weighted((r) => r.logLoss), roi: weighted((r) => r.roi), valueBetCount: totalVb, valueBetHitRate: weightedVb((r) => r.valueBetHitRate), valueBetRoi: weightedVb((r) => r.valueBetRoi), competitions: withData };
  }

  static from() { return new FootballService(); }
}

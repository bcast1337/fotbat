import type { Prediction } from './lib/types.js';
import { getNormalizedFixtures } from './lib/normalizer.js';
import { predictFixture } from './lib/engine.js';
import { runBacktest, type BacktestResult } from './lib/backtest.js';
import { cache } from './lib/cache.js';

/**
 * FootballService — the core intelligence service.
 *
 * Orchestrates the live data layer (football-data.org) and the hybrid
 * statistical engine to produce explainable predictions and value bets for
 * real upcoming fixtures.
 */
export class FootballService {
  /** Add days to an ISO date string (YYYY-MM-DD). */
  private addDays(date: string, days: number): string {
    const d = new Date(date + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  }

  /**
   * Get analyzed predictions for upcoming fixtures.
   *
   * Scans a window starting at `from` (default today) spanning `days` days
   * (default 7, capped at 10 by the API). Results are cached for 15 minutes.
   *
   * @param from - ISO date (YYYY-MM-DD). Defaults to today (UTC).
   * @param days - window length in days (1-10). Defaults to 7.
   * @returns predictions sorted by descending value edge, then confidence.
   */
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
        if (b.confidenceScore !== a.confidenceScore) {
          return b.confidenceScore - a.confidenceScore;
        }
        return new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime();
      });
    });
  }

  /**
   * Get only fixtures where the model detected a value bet.
   * @param from - ISO date (YYYY-MM-DD).
   * @param days - window length in days.
   * @returns value-bet predictions.
   */
  async getValueBets(from?: string, days = 7): Promise<Prediction[]> {
    const all = await this.getPredictions(from, days);
    return all.filter((p) => p.valueBet);
  }

  /**
   * Health/status snapshot for the dashboard header.
   * @param from - ISO date (YYYY-MM-DD).
   * @param days - window length in days.
   */
  async getStats(from?: string, days = 7): Promise<{
    from: string;
    matches: number;
    valueBets: number;
    avgConfidence: number;
    apiConfigured: boolean;
    oddsConfigured: boolean;
  }> {
    const start = from ?? new Date().toISOString().slice(0, 10);
    const all = await this.getPredictions(start, days);
    const valueBets = all.filter((p) => p.valueBet).length;
    const avgConfidence =
      all.reduce((s, p) => s + p.confidenceScore, 0) / (all.length || 1);
    return {
      from: start,
      matches: all.length,
      valueBets,
      avgConfidence: Math.round(avgConfidence * 10) / 10,
      apiConfigured: Boolean(process.env.API_FOOTBALL_KEY),
      oddsConfigured: Boolean(process.env.ODDS_API_KEY),
    };
  }

  /** Resolve the start date of the current/most-recent season (Aug 1). */
  private seasonStart(): string {
    const now = new Date();
    const year = now.getUTCMonth() >= 7 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
    return `${year}-08-01`;
  }

  /**
   * Run a walk-forward backtest over a competition's finished matches across a
   * full season to measure real, look-ahead-free accuracy and ROI. Cached 12h.
   *
   * @param code - competition code (e.g. "PL"). Defaults to "PL".
   * @returns accuracy and ROI metrics computed on real results.
   */
  async getBacktest(code = 'PL'): Promise<BacktestResult> {
    const from = this.seasonStart();
    const to = new Date().toISOString().slice(0, 10);
    return cache.wrap(`backtest:${code}:${from}:${to}`, 12 * 60 * 60 * 1000, () =>
      runBacktest(code, from, to)
    );
  }

  /**
   * Run backtests across several competitions and aggregate the results into a
   * single weighted summary plus per-competition breakdown. Cached 6h.
   *
   * @returns aggregate metrics and per-competition results.
   */
  async getBacktestSummary(): Promise<{
    sampleSize: number;
    hitRate: number;
    baselineHitRate: number;
    brier: number;
    logLoss: number;
    roi: number;
    valueBetCount: number;
    valueBetHitRate: number;
    valueBetRoi: number;
    competitions: BacktestResult[];
  }> {
    const codes = ['PL', 'PD', 'SA', 'BL1', 'FL1'];
    // Sequential to stay within the provider's per-minute rate limit.
    const results: BacktestResult[] = [];
    for (const c of codes) {
      results.push(await this.getBacktest(c));
    }
    const withData = results.filter((r) => r.sampleSize > 0);
    const total = withData.reduce((s, r) => s + r.sampleSize, 0);
    const totalVb = withData.reduce((s, r) => s + r.valueBetCount, 0);
    const weighted = (sel: (r: BacktestResult) => number): number =>
      total ? withData.reduce((s, r) => s + sel(r) * r.sampleSize, 0) / total : 0;
    const weightedVb = (sel: (r: BacktestResult) => number): number =>
      totalVb ? withData.reduce((s, r) => s + sel(r) * r.valueBetCount, 0) / totalVb : 0;
    return {
      sampleSize: total,
      hitRate: weighted((r) => r.hitRate),
      baselineHitRate: weighted((r) => r.baselineHitRate),
      brier: weighted((r) => r.brier),
      logLoss: weighted((r) => r.logLoss),
      roi: weighted((r) => r.roi),
      valueBetCount: totalVb,
      valueBetHitRate: weightedVb((r) => r.valueBetHitRate),
      valueBetRoi: weightedVb((r) => r.valueBetRoi),
      competitions: withData,
    };
  }

  /** Create a new instance of the football service. */
  static from() {
    return new FootballService();
  }
}

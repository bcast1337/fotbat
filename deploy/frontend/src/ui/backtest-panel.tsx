import { useEffect, useState } from 'react';
import {
  fetchBacktest,
  type BacktestSummary,
  type CompetitionBacktest,
  type ValueBetTrade,
} from '../data/api.js';
import styles from './backtest-panel.module.css';

/**
 * BacktestPanel — full accuracy and value-bet ROI tracker.
 *
 * Runs the model walk-forward over a full real season (no look-ahead) and
 * shows two views:
 *  1. Overall accuracy: hit rate, Brier, log loss, flat-stake ROI on all picks.
 *  2. Value-bet ROI: only bets where model edge > 3pp vs the simulated market.
 */
export function BacktestPanel() {
  const [data, setData] = useState<BacktestSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeComp, setActiveComp] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchBacktest()
      .then((d) => {
        if (!active) return;
        setData(d);
        if (d.competitions.length > 0) setActiveComp(d.competitions[0].competition);
      })
      .catch((e: Error) => active && setError(e.message))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  if (loading) {
    return (
      <div className={styles.panel}>
        <p className={styles.intro}>
          Replaying a full season of real results match-by-match…
          Building ELO ratings from scratch, then testing value-bet detection
          on every match. No look-ahead bias.
        </p>
      </div>
    );
  }
  if (error) {
    return <div className={styles.panel}><p className={styles.intro}>Error: {error}</p></div>;
  }
  if (!data || data.sampleSize === 0) {
    return (
      <div className={styles.panel}>
        <p className={styles.intro}>No finished matches available to backtest yet.</p>
      </div>
    );
  }

  const edge = (data.hitRate - data.baselineHitRate) * 100;
  const roiPct = data.roi * 100;
  const vbRoiPct = data.valueBetRoi * 100;
  const selectedComp = data.competitions.find((c) => c.competition === activeComp) ?? null;

  return (
    <div className={styles.panel}>
      <p className={styles.intro}>
        Walk-forward backtest across {data.sampleSize.toLocaleString()} real matches this season
        (PL, La Liga, Serie A, Bundesliga, Ligue 1). Predictions use only pre-kick-off data.
        Value bets use simulated market odds with a 7% bookmaker margin.
      </p>

      <h3 className={styles.sectionTitle}>Overall Model Accuracy</h3>
      <div className={styles.kpis}>
        <Kpi value={`${(data.hitRate * 100).toFixed(1)}%`} label="Hit Rate" hint="top pick correct" />
        <Kpi
          value={`${edge >= 0 ? '+' : ''}${edge.toFixed(1)}%`}
          label="Edge vs Baseline"
          hint={`vs always-home (${(data.baselineHitRate * 100).toFixed(1)}%)`}
          positive={edge >= 0}
        />
        <Kpi
          value={`${roiPct >= 0 ? '+' : ''}${roiPct.toFixed(1)}%`}
          label="All-match ROI"
          hint="1u flat stake, fair odds"
          positive={roiPct >= 0}
        />
        <Kpi value={data.brier.toFixed(3)} label="Brier Score" hint="lower = better calibrated" />
      </div>

      <h3 className={styles.sectionTitle}>
        Value Bet Strategy — {data.valueBetCount} bets flagged
      </h3>
      <p className={styles.strategyDesc}>
        Only bets where model edge ≥ 3pp vs simulated market. One bet per match, highest edge only.
        Staked at simulated market odds (+7% margin).
      </p>
      <div className={styles.kpis}>
        <Kpi
          value={`${vbRoiPct >= 0 ? '+' : ''}${vbRoiPct.toFixed(1)}%`}
          label="Value-bet ROI"
          hint="at market odds (7% margin)"
          positive={vbRoiPct >= 0}
          highlight
        />
        <Kpi
          value={`${(data.valueBetHitRate * 100).toFixed(1)}%`}
          label="VB Hit Rate"
          hint="value bets only"
        />
        <Kpi value={String(data.valueBetCount)} label="Total Bets" hint="across 5 leagues" />
        <Kpi
          value={data.sampleSize > 0 ? `${((data.valueBetCount / data.sampleSize) * 100).toFixed(1)}%` : '0%'}
          label="Bet Rate"
          hint="matches with edge"
        />
      </div>

      <h3 className={styles.sectionTitle}>By Competition</h3>
      <div className={styles.compTabs}>
        {data.competitions.map((c) => (
          <button
            key={c.competition}
            className={`${styles.compTab} ${activeComp === c.competition ? styles.compTabActive : ''}`}
            onClick={() => setActiveComp(c.competition)}
          >
            {c.competition}
          </button>
        ))}
      </div>

      {selectedComp && <CompDetail comp={selectedComp} />}
    </div>
  );
}

function Kpi({
  value,
  label,
  hint,
  positive,
  highlight,
}: {
  value: string;
  label: string;
  hint: string;
  positive?: boolean;
  highlight?: boolean;
}) {
  const colorClass =
    positive === true ? styles.pos : positive === false ? styles.neg : styles.neutral;
  return (
    <div className={`${styles.kpi} ${highlight ? (positive !== false ? styles.kpiHighlight : styles.kpiWarn) : ''}`}>
      <div className={`${styles.kpiValue} ${colorClass}`}>{value}</div>
      <div className={styles.kpiLabel}>{label}</div>
      <div className={styles.kpiHint}>{hint}</div>
    </div>
  );
}

function CompDetail({ comp }: { comp: CompetitionBacktest }) {
  const vbRoi = comp.valueBetRoi * 100;
  return (
    <div className={styles.compDetail}>
      <div className={styles.kpis}>
        <Kpi value={String(comp.sampleSize)} label="Matches" hint="finished" />
        <Kpi value={`${(comp.hitRate * 100).toFixed(1)}%`} label="Hit Rate" hint="all matches" />
        <Kpi
          value={`${comp.roi >= 0 ? '+' : ''}${(comp.roi * 100).toFixed(1)}%`}
          label="All-match ROI"
          hint="fair odds"
          positive={comp.roi >= 0}
        />
        <Kpi
          value={`${vbRoi >= 0 ? '+' : ''}${vbRoi.toFixed(1)}%`}
          label="Value-bet ROI"
          hint="market odds"
          positive={comp.valueBetRoi >= 0}
          highlight
        />
        <Kpi value={String(comp.valueBetCount)} label="Value Bets" hint="edge detected" />
        <Kpi
          value={`${(comp.valueBetHitRate * 100).toFixed(1)}%`}
          label="VB Hit Rate"
          hint="value bets correct"
        />
      </div>

      {comp.valueBetCurve.length > 1 && (
        <>
          <h4 className={styles.curveTitle}>Cumulative Value-Bet P&amp;L (units)</h4>
          <MiniCurve curve={comp.valueBetCurve} />
        </>
      )}

      <div className={styles.tradeRow}>
        {comp.bestValueBet && (
          <TradeCard label="Best Value Bet" trade={comp.bestValueBet} positive />
        )}
        {comp.worstValueBet && (
          <TradeCard label="Worst Value Bet" trade={comp.worstValueBet} positive={false} />
        )}
      </div>
    </div>
  );
}

function MiniCurve({ curve }: { curve: number[] }) {
  const W = 600; const H = 110; const PAD = 10;
  const min = Math.min(0, ...curve);
  const max = Math.max(0, ...curve);
  const range = max - min || 1;
  const toY = (v: number) => PAD + ((max - v) / range) * (H - PAD * 2);
  const toX = (i: number) => PAD + (i / Math.max(curve.length - 1, 1)) * (W - PAD * 2);
  const pts = curve.map((v, i) => `${toX(i)},${toY(v)}`).join(' ');
  const zeroY = toY(0);
  const lastVal = curve[curve.length - 1];
  const color = lastVal >= 0 ? '#3ddc97' : '#ff6b6b';
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={styles.curve} preserveAspectRatio="none">
      <line x1={PAD} y1={zeroY} x2={W - PAD} y2={zeroY}
        stroke="#232b40" strokeWidth="1" strokeDasharray="4,4" />
      <polyline fill="none" stroke={color} strokeWidth="2" points={pts} />
      <circle cx={toX(curve.length - 1)} cy={toY(lastVal)} r="3" fill={color} />
    </svg>
  );
}

function TradeCard({ label, trade, positive }: { label: string; trade: ValueBetTrade; positive: boolean }) {
  return (
    <div className={`${styles.tradeCard} ${positive ? styles.tradePos : styles.tradeNeg}`}>
      <div className={styles.tradeLabel}>{label} {positive ? '✅' : '❌'}</div>
      <div className={styles.tradeMatch}>{trade.match}</div>
      <div className={styles.tradeMeta}>{trade.date} · Bet: {trade.outcome}</div>
      <div className={styles.tradeStats}>
        <span>Model: {(trade.modelProbability * 100).toFixed(1)}%</span>
        <span>Market: {(trade.impliedProbability * 100).toFixed(1)}%</span>
        <span>Edge: +{trade.edgePct}pp</span>
        <span>Odds: {trade.marketOdds}</span>
      </div>
      <div className={`${styles.tradePnl} ${positive ? styles.pos : styles.neg}`}>
        {trade.pnl >= 0 ? '+' : ''}{trade.pnl.toFixed(2)}u · {trade.won ? 'WON' : 'LOST'}
      </div>
    </div>
  );
}

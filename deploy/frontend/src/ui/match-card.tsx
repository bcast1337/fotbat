import { useState } from 'react';
import type { Prediction, KellyStake } from '../engine/types.js';
import styles from './match-card.module.css';

/**
 * MatchCard — full prediction card with all markets.
 *
 * Tabs: Overview · Goal Markets · Correct Scores · Asian HCP · Kelly Stakes · H2H
 */
export type MatchCardProps = {
  prediction: Prediction;
};

type Tab = 'overview' | 'goals' | 'scores' | 'asian' | 'kelly' | 'h2h';

function FormDots({ form }: { form: Array<'W' | 'D' | 'L'> }) {
  if (!form || form.length === 0) {
    return <div className={styles.teamForm}><span className={styles.formNone}>—</span></div>;
  }
  return (
    <div className={styles.teamForm}>
      {form.map((r, i) => (
        <span
          key={i}
          className={`${styles.formDot} ${r === 'W' ? styles.formW : r === 'D' ? styles.formD : styles.formL}`}
        >
          {r}
        </span>
      ))}
    </div>
  );
}

function Pct({ v, good }: { v: number; good?: boolean }) {
  const pct = Math.round(v * 100);
  const cls = good === true ? styles.pctGood : good === false ? styles.pctBad : styles.pctNeutral;
  return <span className={`${styles.pct} ${cls}`}>{pct}%</span>;
}

function MarketRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`${styles.marketRow} ${highlight ? styles.marketRowHL : ''}`}>
      <span className={styles.marketLabel}>{label}</span>
      <span className={styles.marketValue}>{value}</span>
    </div>
  );
}

function GoalMarketsTab({ p }: { p: Prediction }) {
  const g = p.goalMarkets;
  return (
    <div className={styles.tabContent}>
      <div className={styles.marketGrid}>
        <MarketRow label="Over 1.5" value={`${Math.round(g.over15 * 100)}%`} highlight={g.over15 > 0.75} />
        <MarketRow label="Under 1.5" value={`${Math.round(g.under15 * 100)}%`} highlight={g.under15 > 0.60} />
        <MarketRow label="Over 2.5" value={`${Math.round(g.over25 * 100)}%`} highlight={g.over25 > 0.60} />
        <MarketRow label="Under 2.5" value={`${Math.round(g.under25 * 100)}%`} highlight={g.under25 > 0.55} />
        <MarketRow label="Over 3.5" value={`${Math.round(g.over35 * 100)}%`} highlight={g.over35 > 0.45} />
        <MarketRow label="Under 3.5" value={`${Math.round(g.under35 * 100)}%`} />
        <MarketRow label="BTTS (Yes)" value={`${Math.round(g.btts * 100)}%`} highlight={g.btts > 0.55} />
        <MarketRow label="BTTS (No)" value={`${Math.round(g.bttsFail * 100)}%`} highlight={g.bttsFail > 0.55} />
      </div>
      <div className={styles.xgRow}>
        <span>xG: <strong>{p.expectedGoals.home.toFixed(2)}</strong> – <strong>{p.expectedGoals.away.toFixed(2)}</strong></span>
        <span>Most likely: <strong>{p.likelyScore}</strong></span>
        <span>Total xG: <strong>{(p.expectedGoals.home + p.expectedGoals.away).toFixed(2)}</strong></span>
      </div>
    </div>
  );
}

function CorrectScoresTab({ p }: { p: Prediction }) {
  return (
    <div className={styles.tabContent}>
      <div className={styles.csGrid}>
        {p.correctScores.map((cs, i) => (
          <div key={i} className={`${styles.csCell} ${i === 0 ? styles.csCellTop : ''}`}>
            <div className={styles.csScore}>{cs.score}</div>
            <div className={styles.csProb}>{(cs.probability * 100).toFixed(1)}%</div>
          </div>
        ))}
      </div>
      <p className={styles.csNote}>Top 8 scorelines by Poisson probability</p>
    </div>
  );
}

function AsianHandicapTab({ p }: { p: Prediction }) {
  const ah = p.asianHandicap;
  const { homeName: h, awayName: a } = p;
  return (
    <div className={styles.tabContent}>
      <div className={styles.ahSection}>
        <div className={styles.ahSide}>
          <h5 className={styles.ahTeam}>{h}</h5>
          <MarketRow label="-0.5 (win)" value={`${Math.round(ah.homeMinusHalf * 100)}%`} highlight={ah.homeMinusHalf > 0.52} />
          <MarketRow label="+0.5 (win/draw)" value={`${Math.round(ah.homePlusHalf * 100)}%`} highlight={ah.homePlusHalf > 0.65} />
          <MarketRow label="-1 (win by 2+)" value={`${Math.round(ah.homeMinus1 * 100)}%`} highlight={ah.homeMinus1 > 0.35} />
          <MarketRow label="+1 (win/draw)" value={`${Math.round(ah.homePlus1 * 100)}%`} />
        </div>
        <div className={styles.ahSide}>
          <h5 className={styles.ahTeam}>{a}</h5>
          <MarketRow label="-0.5 (win)" value={`${Math.round(ah.awayMinusHalf * 100)}%`} highlight={ah.awayMinusHalf > 0.52} />
          <MarketRow label="+0.5 (win/draw)" value={`${Math.round(ah.awayPlusHalf * 100)}%`} highlight={ah.awayPlusHalf > 0.65} />
        </div>
      </div>
      <p className={styles.csNote}>Probabilities from the full Poisson scoreline grid</p>
    </div>
  );
}

function KellyTab({ p }: { p: Prediction }) {
  if (p.kellyStakes.length === 0) {
    return (
      <div className={styles.tabContent}>
        <p className={styles.kellyEmpty}>
          {p.odds
            ? 'No positive edge detected on any 1X2 outcome — no bet recommended.'
            : 'No bookmaker odds available — Kelly calculation requires real odds.'}
        </p>
      </div>
    );
  }
  return (
    <div className={styles.tabContent}>
      <p className={styles.kellyDesc}>
        Kelly Criterion: bet the fraction that maximises long-run bankroll growth.
        Half-Kelly recommended (reduces variance), quarter-Kelly for ultra-conservative.
      </p>
      {p.kellyStakes.map((k: KellyStake, i: number) => (
        <div key={i} className={styles.kellyCard}>
          <div className={styles.kellyHeader}>
            <span className={styles.kellyOutcome}>{outcomeLabel(k.outcome)}</span>
            <span className={styles.kellyOdds}>@ {k.odds.toFixed(2)}</span>
            <span className={styles.kellyEdge}>+{k.edgePercentage.toFixed(1)}% edge</span>
          </div>
          <div className={styles.kellyProbs}>
            <span>Model: {(k.modelProbability * 100).toFixed(1)}%</span>
          </div>
          <div className={styles.kellyFractions}>
            <div className={styles.kellyFrac}>
              <span className={styles.kellyFracLabel}>Full Kelly</span>
              <span className={styles.kellyFracVal}>{(k.kellyFraction * 100).toFixed(1)}%</span>
            </div>
            <div className={`${styles.kellyFrac} ${styles.kellyFracHL}`}>
              <span className={styles.kellyFracLabel}>½ Kelly ✓</span>
              <span className={styles.kellyFracVal}>{(k.halfKelly * 100).toFixed(1)}%</span>
            </div>
            <div className={styles.kellyFrac}>
              <span className={styles.kellyFracLabel}>¼ Kelly</span>
              <span className={styles.kellyFracVal}>{(k.quarterKelly * 100).toFixed(1)}%</span>
            </div>
          </div>
        </div>
      ))}
      <p className={styles.csNote}>Percentages of total bankroll. Never stake more than half-Kelly.</p>
    </div>
  );
}

function H2HTab({ p }: { p: Prediction }) {
  const h = p.h2hSummary;
  if (h.played === 0) {
    return (
      <div className={styles.tabContent}>
        <p className={styles.kellyEmpty}>No head-to-head history available for this fixture.</p>
      </div>
    );
  }
  return (
    <div className={styles.tabContent}>
      <div className={styles.h2hBar}>
        <div className={styles.h2hSeg} style={{ flex: h.homeWins, background: 'var(--prob-home)' }}>
          {h.homeWins > 0 && `${h.homeWins}W`}
        </div>
        <div className={styles.h2hSeg} style={{ flex: h.draws, background: 'var(--prob-draw)' }}>
          {h.draws > 0 && `${h.draws}D`}
        </div>
        <div className={styles.h2hSeg} style={{ flex: h.awayWins, background: 'var(--prob-away)' }}>
          {h.awayWins > 0 && `${h.awayWins}W`}
        </div>
      </div>
      <div className={styles.h2hLabels}>
        <span>{p.homeName}</span>
        <span>{h.played} meetings</span>
        <span>{p.awayName}</span>
      </div>
      <div className={styles.marketGrid} style={{ marginTop: 12 }}>
        <MarketRow label="Avg goals/game" value={h.avgGoals.toFixed(2)} highlight={h.avgGoals > 2.8} />
        <MarketRow label="BTTS rate" value={`${Math.round(h.bttsRate * 100)}%`} highlight={h.bttsRate > 0.55} />
        <MarketRow label={`${p.homeName} wins`} value={`${h.homeWins} (${Math.round(h.homeWins / h.played * 100)}%)`} />
        <MarketRow label="Draws" value={`${h.draws} (${Math.round(h.draws / h.played * 100)}%)`} />
        <MarketRow label={`${p.awayName} wins`} value={`${h.awayWins} (${Math.round(h.awayWins / h.played * 100)}%)`} />
      </div>
    </div>
  );
}

function outcomeLabel(o: string): string {
  if (o === 'home') return '1 Home';
  if (o === 'draw') return 'X Draw';
  if (o === 'away') return '2 Away';
  if (o === 'over25') return 'Over 2.5';
  if (o === 'under25') return 'Under 2.5';
  if (o === 'btts') return 'BTTS Yes';
  return o;
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'goals', label: 'Goals' },
  { id: 'scores', label: 'Scores' },
  { id: 'asian', label: 'Asian' },
  { id: 'kelly', label: 'Kelly' },
  { id: 'h2h', label: 'H2H' },
];

export function MatchCard({ prediction }: MatchCardProps) {
  const [tab, setTab] = useState<Tab>('overview');
  const {
    probabilities,
    expectedGoals,
    confidenceScore,
    valueBet,
    bestValue,
    odds,
    dataQuality,
  } = prediction;
  const lowData = dataQuality !== 'full';
  const kickoff = new Date(prediction.kickoff).toLocaleString([], {
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className={`${styles.card} ${valueBet ? styles.valueCard : ''}`}>
      {/* Header */}
      <div className={styles.top}>
        <span className={styles.league}>
          {prediction.leagueLogo && (
            <img src={prediction.leagueLogo} alt="" className={styles.leagueLogo} />
          )}
          {prediction.league} · {kickoff}
        </span>
        <div className={styles.badges}>
          {valueBet && <span className={styles.valueBadge}>★ Value</span>}
          {prediction.goalMarkets?.btts > 0.60 && <span className={styles.bttsBadge}>BTTS</span>}
          {prediction.goalMarkets?.over25 > 0.65 && <span className={styles.overBadge}>O2.5</span>}
          {lowData && (
            <span className={styles.lowDataBadge}>
              {dataQuality === 'insufficient' ? '⚠ Low data' : '⚠ Partial'}
            </span>
          )}
        </div>
      </div>

      {/* Teams */}
      <div className={styles.teams}>
        <div className={styles.team}>
          {prediction.homeLogo && (
            <img src={prediction.homeLogo} alt="" className={styles.crest} />
          )}
          <div className={styles.teamName}>{prediction.homeName}</div>
          <FormDots form={prediction.homeForm} />
        </div>
        <div className={styles.team}>
          <div className={styles.xg}>
            {expectedGoals.home.toFixed(1)}-{expectedGoals.away.toFixed(1)}
          </div>
          <div className={styles.vs}>xG · {prediction.likelyScore}</div>
        </div>
        <div className={styles.team}>
          {prediction.awayLogo && (
            <img src={prediction.awayLogo} alt="" className={styles.crest} />
          )}
          <div className={styles.teamName}>{prediction.awayName}</div>
          <FormDots form={prediction.awayForm} />
        </div>
      </div>

      {/* 1X2 probability bar */}
      <div className={`${styles.probBar} ${lowData ? styles.probBarDim : ''}`}>
        <div className={`${styles.probSeg} ${styles.segHome}`} style={{ flex: probabilities.home }}>
          {probabilities.home}%
        </div>
        <div className={`${styles.probSeg} ${styles.segDraw}`} style={{ flex: probabilities.draw }}>
          {probabilities.draw}%
        </div>
        <div className={`${styles.probSeg} ${styles.segAway}`} style={{ flex: probabilities.away }}>
          {probabilities.away}%
        </div>
      </div>
      <div className={styles.probLabels}>
        <span>1 Home</span><span>X Draw</span><span>2 Away</span>
      </div>

      {/* Bookmaker odds */}
      {odds && (
        <div className={styles.odds}>
          <span className={`${styles.oddChip} ${bestValue?.outcome === 'home' ? styles.oddChipValue : ''}`}>
            1: {odds.home.toFixed(2)}
          </span>
          <span className={`${styles.oddChip} ${bestValue?.outcome === 'draw' ? styles.oddChipValue : ''}`}>
            X: {odds.draw.toFixed(2)}
          </span>
          <span className={`${styles.oddChip} ${bestValue?.outcome === 'away' ? styles.oddChipValue : ''}`}>
            2: {odds.away.toFixed(2)}
          </span>
        </div>
      )}

      {/* Confidence + edge */}
      <div className={styles.meta}>
        <div className={styles.confidence}>
          <div className={styles.confTrack}>
            {Array.from({ length: 10 }).map((_, i) => (
              <span key={i} className={`${styles.confPip} ${i < confidenceScore ? styles.confPipOn : ''}`} />
            ))}
          </div>
          <span className={styles.confLabel}>Conf {confidenceScore}/10</span>
        </div>
        <div className={styles.edge}>
          <div className={`${styles.edgeValue} ${bestValue && bestValue.edgePercentage > 0 ? styles.edgePos : styles.edgeNeg}`}>
            {bestValue ? `+${bestValue.edgePercentage.toFixed(1)}%` : odds ? '—' : 'no odds'}
          </div>
          <div className={styles.edgeLabel}>Edge</div>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.cardTabs}>
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`${styles.cardTab} ${tab === t.id ? styles.cardTabActive : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className={styles.tabContent}>
          <button className={styles.explainToggle} onClick={() => setTab('overview')}>
            Why this prediction?
          </button>
          <div className={styles.explainPanel}>
            {prediction.explanation.map((reason, i) => (
              <div key={i} className={styles.explainItem}>
                <span className={styles.explainBullet}>›</span>
                <span>{reason}</span>
              </div>
            ))}
          </div>
          {prediction.kellyStakes.length > 0 && (
            <div className={styles.kellyQuick}>
              <span className={styles.kellyQuickLabel}>Kelly ½:</span>
              {prediction.kellyStakes.slice(0, 1).map((k, i) => (
                <span key={i} className={styles.kellyQuickVal}>
                  {outcomeLabel(k.outcome)} @ {k.odds.toFixed(2)} → <strong>{(k.halfKelly * 100).toFixed(1)}%</strong> of bankroll
                </span>
              ))}
            </div>
          )}
        </div>
      )}
      {tab === 'goals' && <GoalMarketsTab p={prediction} />}
      {tab === 'scores' && <CorrectScoresTab p={prediction} />}
      {tab === 'asian' && <AsianHandicapTab p={prediction} />}
      {tab === 'kelly' && <KellyTab p={prediction} />}
      {tab === 'h2h' && <H2HTab p={prediction} />}
    </div>
  );
}

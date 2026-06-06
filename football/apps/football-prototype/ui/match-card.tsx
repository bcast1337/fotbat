import { useState } from 'react';
import type { Prediction } from '../engine/types.js';
import type { Fixture } from '../engine/types.js';
import styles from './match-card.module.css';

/**
 * MatchCard renders a single fixture prediction in a trading-dashboard style:
 * team form, blended probabilities, expected goals, confidence, value edge,
 * and an expandable explanation panel.
 */
export type MatchCardProps = {
  prediction: Prediction;
  fixture: Fixture;
};

/** Render a team's recent form as colored W/D/L pips. */
function FormDots({ form }: { form: Array<'W' | 'D' | 'L'> }) {
  return (
    <div className={styles.teamForm}>
      {form.map((r, i) => (
        <span
          key={i}
          className={`${styles.formDot} ${
            r === 'W' ? styles.formW : r === 'D' ? styles.formD : styles.formL
          }`}
        >
          {r}
        </span>
      ))}
    </div>
  );
}

export function MatchCard({ prediction, fixture }: MatchCardProps) {
  const [open, setOpen] = useState(false);
  const { probabilities, expectedGoals, confidenceScore, valueBet, bestValue } = prediction;
  const kickoff = new Date(prediction.kickoff).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className={`${styles.card} ${valueBet ? styles.valueCard : ''}`}>
      <div className={styles.top}>
        <span className={styles.league}>{prediction.league} · {kickoff}</span>
        {valueBet && <span className={styles.valueBadge}>★ Value Bet</span>}
      </div>

      <div className={styles.teams}>
        <div className={styles.team}>
          <div className={styles.teamName}>{fixture.home.name}</div>
          <FormDots form={fixture.home.form} />
        </div>
        <div className={styles.team}>
          <div className={styles.xg}>
            {expectedGoals.home.toFixed(1)}-{expectedGoals.away.toFixed(1)}
          </div>
          <div className={styles.vs}>xG · {prediction.likelyScore}</div>
        </div>
        <div className={styles.team}>
          <div className={styles.teamName}>{fixture.away.name}</div>
          <FormDots form={fixture.away.form} />
        </div>
      </div>

      <div className={styles.probBar}>
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
        <span>Home</span>
        <span>Draw</span>
        <span>Away</span>
      </div>

      <div className={styles.odds}>
        <span className={`${styles.oddChip} ${bestValue?.outcome === 'home' ? styles.oddChipValue : ''}`}>
          1: {fixture.odds.home.toFixed(2)}
        </span>
        <span className={`${styles.oddChip} ${bestValue?.outcome === 'draw' ? styles.oddChipValue : ''}`}>
          X: {fixture.odds.draw.toFixed(2)}
        </span>
        <span className={`${styles.oddChip} ${bestValue?.outcome === 'away' ? styles.oddChipValue : ''}`}>
          2: {fixture.odds.away.toFixed(2)}
        </span>
      </div>

      <div className={styles.meta}>
        <div className={styles.confidence}>
          <div className={styles.confTrack}>
            {Array.from({ length: 10 }).map((_, i) => (
              <span
                key={i}
                className={`${styles.confPip} ${i < confidenceScore ? styles.confPipOn : ''}`}
              />
            ))}
          </div>
          <span className={styles.confLabel}>Conf {confidenceScore}/10</span>
        </div>
        <div className={styles.edge}>
          <div
            className={`${styles.edgeValue} ${
              bestValue && bestValue.edgePercentage > 0 ? styles.edgePos : styles.edgeNeg
            }`}
          >
            {bestValue ? `+${bestValue.edgePercentage.toFixed(1)}%` : '—'}
          </div>
          <div className={styles.edgeLabel}>Edge</div>
        </div>
      </div>

      <button className={styles.explainToggle} onClick={() => setOpen((o) => !o)}>
        {open ? '▾ Hide reasoning' : '▸ Why this prediction?'}
      </button>
      {open && (
        <div className={styles.explainPanel}>
          {prediction.explanation.map((reason, i) => (
            <div key={i} className={styles.explainItem}>
              <span className={styles.explainBullet}>›</span>
              <span>{reason}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

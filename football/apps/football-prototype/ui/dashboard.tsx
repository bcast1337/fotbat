import { useMemo, useState } from 'react';
import { predictAll } from '../engine/index.js';
import { mockFixtures } from '../data/fixtures.mock.js';
import { MatchCard } from './match-card.js';
import styles from './dashboard.module.css';

/** Filter modes for the fixture grid. */
type Filter = 'all' | 'value' | 'high-confidence';

/**
 * Dashboard is the main intelligence view: it runs the hybrid engine over
 * today's fixtures and renders predictions in a trading-style grid, with
 * filters for value bets and high-confidence picks.
 */
export function Dashboard() {
  const [filter, setFilter] = useState<Filter>('all');

  const predictions = useMemo(() => predictAll(mockFixtures), []);

  const fixturesById = useMemo(
    () => Object.fromEntries(mockFixtures.map((f) => [f.id, f])),
    []
  );

  const valueCount = predictions.filter((p) => p.valueBet).length;
  const avgConfidence =
    predictions.reduce((s, p) => s + p.confidenceScore, 0) / (predictions.length || 1);

  const visible = predictions.filter((p) => {
    if (filter === 'value') return p.valueBet;
    if (filter === 'high-confidence') return p.confidenceScore >= 7;
    return true;
  });

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <div className={styles.logo}>⚽</div>
          <div className={styles.brandText}>
            <h1>Edge FC — Football Intelligence</h1>
            <p>Hybrid ELO + Poisson model · value detection · explainable</p>
          </div>
        </div>
        <div className={styles.stats}>
          <div className={styles.stat}>
            <div className={styles.statValue}>{predictions.length}</div>
            <div className={styles.statLabel}>Matches</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statValue} style={{ color: 'var(--value)' }}>
              {valueCount}
            </div>
            <div className={styles.statLabel}>Value Bets</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statValue}>{avgConfidence.toFixed(1)}</div>
            <div className={styles.statLabel}>Avg Conf</div>
          </div>
        </div>
      </header>

      <div className={styles.toolbar}>
        <button
          className={`${styles.filterBtn} ${filter === 'all' ? styles.filterBtnActive : ''}`}
          onClick={() => setFilter('all')}
        >
          All Matches
        </button>
        <button
          className={`${styles.filterBtn} ${filter === 'value' ? styles.filterBtnActive : ''}`}
          onClick={() => setFilter('value')}
        >
          ★ Value Bets ({valueCount})
        </button>
        <button
          className={`${styles.filterBtn} ${
            filter === 'high-confidence' ? styles.filterBtnActive : ''
          }`}
          onClick={() => setFilter('high-confidence')}
        >
          High Confidence
        </button>
      </div>

      <div className={styles.grid}>
        {visible.map((p) => (
          <MatchCard key={p.fixtureId} prediction={p} fixture={fixturesById[p.fixtureId]} />
        ))}
      </div>
    </div>
  );
}

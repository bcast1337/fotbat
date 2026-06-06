import { useEffect, useMemo, useState } from 'react';
import type { Prediction } from '../engine/types.js';
import { fetchPredictions, fetchStats, type Stats } from '../data/api.js';
import { MatchCard } from './match-card.js';
import { BacktestPanel } from './backtest-panel.js';
import { BankrollPanel } from './bankroll-panel.js';
import styles from './dashboard.module.css';

/** Filter modes for the fixture grid. */
type Filter = 'all' | 'value' | 'high-confidence' | 'goals' | 'btts';

/** Top-level view tabs. */
type View = 'predictions' | 'backtest' | 'bankroll';

/**
 * Dashboard — the main intelligence view.
 *
 * Loads live predictions and summary stats from the Football Intelligence API
 * and renders them in a trading-style grid, with filters for value bets and
 * high-confidence picks.
 */
export function Dashboard() {
  const [view, setView] = useState<View>('predictions');
  const [filter, setFilter] = useState<Filter>('all');
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([fetchPredictions(10), fetchStats(10)])
      .then(([preds, st]) => {
        if (!active) return;
        setPredictions(preds);
        setStats(st);
        setError(null);
      })
      .catch((e) => active && setError(e.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const valueCount = useMemo(
    () => predictions.filter((p) => p.valueBet).length,
    [predictions]
  );

  const goalsCount = useMemo(
    () => predictions.filter((p) => p.goalMarkets?.over25 > 0.60).length,
    [predictions]
  );

  const bttsCount = useMemo(
    () => predictions.filter((p) => p.goalMarkets?.btts > 0.58).length,
    [predictions]
  );

  const visible = predictions.filter((p) => {
    if (filter === 'value') return p.valueBet;
    if (filter === 'high-confidence') return p.confidenceScore >= 7;
    if (filter === 'goals') return p.goalMarkets?.over25 > 0.60;
    if (filter === 'btts') return p.goalMarkets?.btts > 0.58;
    return true;
  });

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <div className={styles.logo}>⚽</div>
          <div className={styles.brandText}>
            <h1>Edge FC — Football Intelligence</h1>
            <p>
              Live data · Hybrid ELO + Poisson model · value detection ·
              explainable
            </p>
          </div>
        </div>
        <div className={styles.stats}>
          <div className={styles.stat}>
            <div className={styles.statValue}>{stats?.matches ?? '—'}</div>
            <div className={styles.statLabel}>Matches</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statValue} style={{ color: 'var(--value)' }}>
              {stats?.valueBets ?? '—'}
            </div>
            <div className={styles.statLabel}>Value Bets</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statValue}>
              {stats ? stats.avgConfidence.toFixed(1) : '—'}
            </div>
            <div className={styles.statLabel}>Avg Conf</div>
          </div>
        </div>
      </header>

      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${view === 'predictions' ? styles.tabActive : ''}`}
          onClick={() => setView('predictions')}
        >
          Live Predictions
        </button>
        <button
          className={`${styles.tab} ${view === 'backtest' ? styles.tabActive : ''}`}
          onClick={() => setView('backtest')}
        >
          Backtest & ROI
        </button>
        <button
          className={`${styles.tab} ${view === 'bankroll' ? styles.tabActive : ''}`}
          onClick={() => setView('bankroll')}
        >
          💰 Bankroll
        </button>
      </div>

      {view === 'backtest' && <BacktestPanel />}
      {view === 'bankroll' && <BankrollPanel />}

      {view === 'predictions' && (
        <>
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
        <button
          className={`${styles.filterBtn} ${
            filter === 'goals' ? styles.filterBtnActive : ''
          }`}
          onClick={() => setFilter('goals')}
        >
          ⚽ O2.5 ({goalsCount})
        </button>
        <button
          className={`${styles.filterBtn} ${
            filter === 'btts' ? styles.filterBtnActive : ''
          }`}
          onClick={() => setFilter('btts')}
        >
          🎯 BTTS ({bttsCount})
        </button>
      </div>

      {loading && (
        <div className={styles.message}>Loading live fixtures & running the model…</div>
      )}
      {error && (
        <div className={styles.error}>
          Could not load data: {error}. Make sure the football-service backend is
          running.
        </div>
      )}
      {!loading && !error && visible.length === 0 && (
        <div className={styles.message}>
          No upcoming fixtures in tracked competitions for this window.
        </div>
      )}

      <div className={styles.grid}>
        {visible.map((p) => (
          <MatchCard key={p.fixtureId} prediction={p} />
        ))}
      </div>
        </>
      )}
    </div>
  );
}

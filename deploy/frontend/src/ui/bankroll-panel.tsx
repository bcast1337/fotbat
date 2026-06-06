import { useCallback, useEffect, useState } from 'react';
import type { TrackedBet, BankrollSummary } from '../engine/types.js';
import {
  fetchBets,
  fetchBankroll,
  patchBet,
  deleteBet,
  postBet,
  type AddBetInput,
} from '../data/api.js';
import styles from './bankroll-panel.module.css';

/**
 * BankrollPanel — personal bet tracker and bankroll manager.
 *
 * Log real bets, settle results, track P&L equity curve, ROI, win rate.
 */

function MiniCurve({ curve }: { curve: number[] }) {
  if (curve.length < 2) return null;
  const W = 560; const H = 90; const PAD = 8;
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
        stroke="rgba(255,255,255,0.08)" strokeWidth="1" strokeDasharray="4,4" />
      <polyline fill="none" stroke={color} strokeWidth="2" points={pts} />
      <circle cx={toX(curve.length - 1)} cy={toY(lastVal)} r="3" fill={color} />
    </svg>
  );
}

function Kpi({ label, value, hint, pos }: { label: string; value: string; hint?: string; pos?: boolean }) {
  const cls = pos === true ? styles.kpiPos : pos === false ? styles.kpiNeg : '';
  return (
    <div className={styles.kpi}>
      <div className={`${styles.kpiValue} ${cls}`}>{value}</div>
      <div className={styles.kpiLabel}>{label}</div>
      {hint && <div className={styles.kpiHint}>{hint}</div>}
    </div>
  );
}

type AddFormProps = {
  onAdd: (input: AddBetInput) => void;
  onCancel: () => void;
};

function AddBetForm({ onAdd, onCancel }: AddFormProps) {
  const [form, setForm] = useState<AddBetInput>({
    fixtureId: '',
    match: '',
    league: '',
    kickoff: new Date().toISOString().slice(0, 16),
    market: '1X2',
    outcome: 'home',
    odds: 2.0,
    stake: 10,
    modelProbability: 0.5,
    edgePercentage: 3,
  });

  const set = <K extends keyof AddBetInput>(k: K, v: AddBetInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className={styles.addForm}>
      <h4 className={styles.addTitle}>Log New Bet</h4>
      <div className={styles.formGrid}>
        <label className={styles.formLabel}>
          Match
          <input className={styles.formInput} value={form.match}
            onChange={(e) => set('match', e.target.value)} placeholder="Man City vs Arsenal" />
        </label>
        <label className={styles.formLabel}>
          League
          <input className={styles.formInput} value={form.league}
            onChange={(e) => set('league', e.target.value)} placeholder="Premier League" />
        </label>
        <label className={styles.formLabel}>
          Market
          <select className={styles.formInput} value={form.market}
            onChange={(e) => set('market', e.target.value)}>
            <option>1X2</option>
            <option>Over 2.5</option>
            <option>Under 2.5</option>
            <option>BTTS Yes</option>
            <option>BTTS No</option>
            <option>Over 1.5</option>
            <option>Over 3.5</option>
            <option>Asian Handicap</option>
            <option>Correct Score</option>
          </select>
        </label>
        <label className={styles.formLabel}>
          Outcome / Selection
          <input className={styles.formInput} value={form.outcome}
            onChange={(e) => set('outcome', e.target.value)} placeholder="home / over / btts-yes..." />
        </label>
        <label className={styles.formLabel}>
          Decimal Odds
          <input className={styles.formInput} type="number" step="0.01" min="1.01"
            value={form.odds} onChange={(e) => set('odds', Number(e.target.value))} />
        </label>
        <label className={styles.formLabel}>
          Stake (€/£/units)
          <input className={styles.formInput} type="number" step="0.5" min="0.5"
            value={form.stake} onChange={(e) => set('stake', Number(e.target.value))} />
        </label>
        <label className={styles.formLabel}>
          Model Probability (0-1)
          <input className={styles.formInput} type="number" step="0.01" min="0" max="1"
            value={form.modelProbability}
            onChange={(e) => set('modelProbability', Number(e.target.value))} />
        </label>
        <label className={styles.formLabel}>
          Edge %
          <input className={styles.formInput} type="number" step="0.1"
            value={form.edgePercentage}
            onChange={(e) => set('edgePercentage', Number(e.target.value))} />
        </label>
        <label className={styles.formLabel}>
          Kickoff
          <input className={styles.formInput} type="datetime-local" value={form.kickoff}
            onChange={(e) => set('kickoff', e.target.value)} />
        </label>
      </div>
      <div className={styles.formActions}>
        <button className={styles.btnSecondary} onClick={onCancel}>Cancel</button>
        <button className={styles.btnPrimary} onClick={() => onAdd(form)}>Log Bet</button>
      </div>
    </div>
  );
}

type BetRowProps = {
  bet: TrackedBet;
  onSettle: (id: string, status: 'won' | 'lost' | 'void') => void;
  onDelete: (id: string) => void;
};

function BetRow({ bet, onSettle, onDelete }: BetRowProps) {
  const statusColor =
    bet.status === 'won' ? styles.statusWon
    : bet.status === 'lost' ? styles.statusLost
    : bet.status === 'void' ? styles.statusVoid
    : styles.statusPending;
  const kickoff = new Date(bet.kickoff).toLocaleString([], {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
  return (
    <div className={styles.betRow}>
      <div className={styles.betMain}>
        <div className={styles.betMatch}>{bet.match}</div>
        <div className={styles.betMeta}>
          {bet.league} · {kickoff} · {bet.market}: {bet.outcome}
        </div>
        <div className={styles.betStats}>
          <span>Odds: <strong>{bet.odds.toFixed(2)}</strong></span>
          <span>Stake: <strong>{bet.stake}</strong></span>
          <span>Model: <strong>{(bet.modelProbability * 100).toFixed(1)}%</strong></span>
          <span>Edge: <strong>+{bet.edgePercentage.toFixed(1)}%</strong></span>
        </div>
      </div>
      <div className={styles.betRight}>
        <span className={`${styles.betStatus} ${statusColor}`}>
          {bet.status.toUpperCase()}
        </span>
        {bet.status !== 'pending' && (
          <span className={`${styles.betPnl} ${bet.pnl >= 0 ? styles.kpiPos : styles.kpiNeg}`}>
            {bet.pnl >= 0 ? '+' : ''}{bet.pnl.toFixed(2)}
          </span>
        )}
        {bet.status === 'pending' && (
          <div className={styles.betActions}>
            <button className={styles.btnWon} onClick={() => onSettle(bet.id, 'won')}>Won</button>
            <button className={styles.btnLost} onClick={() => onSettle(bet.id, 'lost')}>Lost</button>
            <button className={styles.btnVoid} onClick={() => onSettle(bet.id, 'void')}>Void</button>
          </div>
        )}
        <button className={styles.btnDel} onClick={() => onDelete(bet.id)}>×</button>
      </div>
    </div>
  );
}

export function BankrollPanel() {
  const [summary, setSummary] = useState<BankrollSummary | null>(null);
  const [bets, setBets] = useState<TrackedBet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [initial, setInitial] = useState(1000);
  const [filter, setFilter] = useState<'all' | 'pending' | 'won' | 'lost'>('all');

  const reload = useCallback(() => {
    setLoading(true);
    Promise.all([fetchBankroll(initial), fetchBets()])
      .then(([s, b]) => { setSummary(s); setBets(b); setError(null); })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [initial]);

  useEffect(() => { reload(); }, [reload]);

  const handleAdd = async (input: AddBetInput) => {
    try {
      await postBet(input);
      setAdding(false);
      reload();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleSettle = async (id: string, status: 'won' | 'lost' | 'void') => {
    try {
      await patchBet(id, status);
      reload();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this bet?')) return;
    try {
      await deleteBet(id);
      reload();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const visibleBets = filter === 'all' ? bets
    : bets.filter((b) => b.status === filter);

  return (
    <div className={styles.panel}>
      {error && <div className={styles.error}>{error}</div>}

      {/* Bankroll controls */}
      <div className={styles.topBar}>
        <label className={styles.initialLabel}>
          Starting bankroll:
          <input
            className={styles.initialInput}
            type="number"
            value={initial}
            onChange={(e) => setInitial(Number(e.target.value))}
            onBlur={reload}
          />
        </label>
        <button className={styles.btnPrimary} onClick={() => setAdding(!adding)}>
          {adding ? 'Cancel' : '+ Log Bet'}
        </button>
      </div>

      {adding && <AddBetForm onAdd={handleAdd} onCancel={() => setAdding(false)} />}

      {/* KPIs */}
      {!loading && summary && (
        <>
          <div className={styles.kpis}>
            <Kpi label="Current Bankroll"
              value={`${summary.currentBankroll.toFixed(2)}`}
              hint={`Started: ${summary.initialBankroll}`}
              pos={summary.currentBankroll >= summary.initialBankroll} />
            <Kpi label="Total P&L"
              value={`${summary.totalPnl >= 0 ? '+' : ''}${summary.totalPnl.toFixed(2)}`}
              hint={`Staked: ${summary.totalStaked.toFixed(2)}`}
              pos={summary.totalPnl >= 0} />
            <Kpi label="ROI"
              value={`${summary.roi >= 0 ? '+' : ''}${summary.roi.toFixed(1)}%`}
              hint="on settled bets"
              pos={summary.roi >= 0} />
            <Kpi label="Win Rate"
              value={`${summary.winRate.toFixed(1)}%`}
              hint={`${summary.settledBets} settled`} />
            <Kpi label="Active Bets"
              value={String(summary.activeBets)}
              hint="pending settlement" />
          </div>

          {summary.pnlCurve.length > 1 && (
            <div className={styles.curveBox}>
              <h4 className={styles.curveTitle}>P&L Equity Curve</h4>
              <MiniCurve curve={summary.pnlCurve} />
            </div>
          )}

          {summary.bestBet && (
            <div className={styles.bestWorst}>
              <div className={styles.bestCard}>
                <span className={styles.bwLabel}>Best Bet ✅</span>
                <span className={styles.bwMatch}>{summary.bestBet.match}</span>
                <span className={styles.bwPnl}>+{summary.bestBet.pnl.toFixed(2)}</span>
              </div>
              {summary.worstBet && (
                <div className={styles.worstCard}>
                  <span className={styles.bwLabel}>Worst Bet ❌</span>
                  <span className={styles.bwMatch}>{summary.worstBet.match}</span>
                  <span className={styles.bwPnl}>{summary.worstBet.pnl.toFixed(2)}</span>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Bet list */}
      <div className={styles.listHeader}>
        <h3 className={styles.listTitle}>Bets ({visibleBets.length})</h3>
        <div className={styles.filterRow}>
          {(['all', 'pending', 'won', 'lost'] as const).map((f) => (
            <button key={f}
              className={`${styles.filterBtn} ${filter === f ? styles.filterBtnActive : ''}`}
              onClick={() => setFilter(f)}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {loading && <p className={styles.loading}>Loading bet history…</p>}

      {!loading && visibleBets.length === 0 && (
        <p className={styles.empty}>
          {filter === 'all'
            ? 'No bets logged yet. Hit "+ Log Bet" to start tracking!'
            : `No ${filter} bets.`}
        </p>
      )}

      <div className={styles.betList}>
        {visibleBets.map((b) => (
          <BetRow key={b.id} bet={b} onSettle={handleSettle} onDelete={handleDelete} />
        ))}
      </div>
    </div>
  );
}

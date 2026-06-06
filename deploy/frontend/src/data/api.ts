import type { Prediction, TrackedBet, BankrollSummary } from '../engine/types.js';

export function backendUrl(): string {
  if (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_BACKEND_URL) {
    return (import.meta as any).env.VITE_BACKEND_URL;
  }
  return 'http://localhost:3001';
}

export type Stats = {
  from: string;
  matches: number;
  valueBets: number;
  avgConfidence: number;
  apiConfigured: boolean;
  oddsConfigured: boolean;
};

export async function fetchPredictions(days = 10): Promise<Prediction[]> {
  const res = await fetch(`${backendUrl()}/api/predictions?days=${days}`, { credentials: 'include' });
  if (!res.ok) throw new Error(`Failed to load predictions (${res.status})`);
  return res.json();
}

export async function fetchStats(days = 10): Promise<Stats> {
  const res = await fetch(`${backendUrl()}/api/stats?days=${days}`, { credentials: 'include' });
  if (!res.ok) throw new Error(`Failed to load stats (${res.status})`);
  return res.json();
}

export type BacktestSample = { match: string; date: string; predicted: 'home' | 'draw' | 'away'; probability: number; actual: 'home' | 'draw' | 'away'; correct: boolean };
export type ValueBetTrade = { match: string; date: string; outcome: 'home' | 'draw' | 'away'; modelProbability: number; impliedProbability: number; edgePct: number; marketOdds: number; actual: 'home' | 'draw' | 'away'; won: boolean; pnl: number };
export type CompetitionBacktest = { competition: string; from: string; to: string; sampleSize: number; hitRate: number; baselineHitRate: number; brier: number; logLoss: number; roi: number; valueBetCount: number; valueBetHitRate: number; valueBetRoi: number; valueBetCurve: number[]; bestValueBet: ValueBetTrade | null; worstValueBet: ValueBetTrade | null; actuals: { home: number; draw: number; away: number }; samples: BacktestSample[] };
export type BacktestSummary = { sampleSize: number; hitRate: number; baselineHitRate: number; brier: number; logLoss: number; roi: number; valueBetCount: number; valueBetHitRate: number; valueBetRoi: number; competitions: CompetitionBacktest[] };

export async function fetchBacktest(): Promise<BacktestSummary> {
  const res = await fetch(`${backendUrl()}/api/backtest`, { credentials: 'include' });
  if (!res.ok) throw new Error(`Failed to load backtest (${res.status})`);
  return res.json();
}

export type AddBetInput = Omit<TrackedBet, 'id' | 'status' | 'pnl' | 'createdAt'>;

export async function fetchBets(status?: TrackedBet['status']): Promise<TrackedBet[]> {
  const qs = status ? `?status=${status}` : '';
  const res = await fetch(`${backendUrl()}/api/bets${qs}`, { credentials: 'include' });
  if (!res.ok) throw new Error(`Failed to load bets (${res.status})`);
  return res.json();
}

export async function postBet(input: AddBetInput): Promise<TrackedBet> {
  const res = await fetch(`${backendUrl()}/api/bets`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
  if (!res.ok) throw new Error(`Failed to add bet (${res.status})`);
  return res.json();
}

export async function patchBet(id: string, status: 'won' | 'lost' | 'void'): Promise<TrackedBet> {
  const res = await fetch(`${backendUrl()}/api/bets/${id}`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
  if (!res.ok) throw new Error(`Failed to settle bet (${res.status})`);
  return res.json();
}

export async function deleteBet(id: string): Promise<void> {
  const res = await fetch(`${backendUrl()}/api/bets/${id}`, { method: 'DELETE', credentials: 'include' });
  if (!res.ok) throw new Error(`Failed to delete bet (${res.status})`);
}

export async function fetchBankroll(initial = 1000): Promise<BankrollSummary> {
  const res = await fetch(`${backendUrl()}/api/bankroll?initial=${initial}`, { credentials: 'include' });
  if (!res.ok) throw new Error(`Failed to load bankroll (${res.status})`);
  return res.json();
}

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import type { TrackedBet, BankrollSummary } from './types.js';

function dataFile(): string { return path.join(process.env.TRACKER_DATA_DIR ?? os.tmpdir(), 'edge-fc-bets.json'); }
function loadBets(): TrackedBet[] { try { return JSON.parse(fs.readFileSync(dataFile(), 'utf8')) as TrackedBet[]; } catch { return []; } }
function saveBets(bets: TrackedBet[]): void { fs.writeFileSync(dataFile(), JSON.stringify(bets, null, 2), 'utf8'); }
function makeId(): string { return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }

export function addBet(input: Omit<TrackedBet, 'id' | 'status' | 'pnl' | 'createdAt'>): TrackedBet {
  const bets = loadBets(); const bet: TrackedBet = { ...input, id: makeId(), status: 'pending', pnl: 0, createdAt: new Date().toISOString() }; bets.push(bet); saveBets(bets); return bet;
}

export function settleBet(id: string, status: 'won' | 'lost' | 'void'): TrackedBet | null {
  const bets = loadBets(); const bet = bets.find((b) => b.id === id); if (!bet) return null;
  bet.status = status; bet.pnl = status === 'won' ? Math.round((bet.stake * (bet.odds - 1)) * 100) / 100 : status === 'lost' ? -bet.stake : 0;
  saveBets(bets); return bet;
}

export function deleteBet(id: string): boolean { const bets = loadBets(); const idx = bets.findIndex((b) => b.id === id); if (idx === -1) return false; bets.splice(idx, 1); saveBets(bets); return true; }

export function getBets(status?: TrackedBet['status']): TrackedBet[] {
  const bets = loadBets();
  return (status ? bets.filter((b) => b.status === status) : bets).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getBankrollSummary(initialBankroll = 1000): BankrollSummary {
  const bets = loadBets(); const settled = bets.filter((b) => b.status !== 'pending'); const won = settled.filter((b) => b.status === 'won'); const active = bets.filter((b) => b.status === 'pending');
  const totalStaked = settled.reduce((s, b) => s + b.stake, 0); const totalPnl = settled.reduce((s, b) => s + b.pnl, 0); const currentBankroll = initialBankroll + totalPnl;
  const pnlCurve: number[] = []; let running = 0;
  for (const b of [...settled].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) { running += b.pnl; pnlCurve.push(Math.round(running * 100) / 100); }
  const bestBet = settled.length ? settled.reduce((best, b) => (b.pnl > best.pnl ? b : best), settled[0]) : null;
  const worstBet = settled.length ? settled.reduce((worst, b) => (b.pnl < worst.pnl ? b : worst), settled[0]) : null;
  return { initialBankroll, currentBankroll: Math.round(currentBankroll * 100) / 100, totalStaked: Math.round(totalStaked * 100) / 100, totalPnl: Math.round(totalPnl * 100) / 100, roi: Math.round((totalStaked > 0 ? totalPnl / totalStaked : 0) * 10000) / 100, winRate: Math.round((settled.length > 0 ? won.length / settled.length : 0) * 1000) / 10, activeBets: active.length, settledBets: settled.length, bestBet: bestBet ?? null, worstBet: worstBet ?? null, pnlCurve };
}

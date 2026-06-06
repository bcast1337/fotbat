import type { OddsEntry } from './odds-api.js';
import type { MarketOdds } from './types.js';

function normalize(name: string): string {
  return name.toLowerCase()
    .replace(/\b(fc|cf|afc|ac|ss|sc|club|de|cd|rc|calcio)\b/g, '')
    .replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}

function similarity(a: string, b: string): number {
  const ta = new Set(normalize(a).split(' ').filter(Boolean));
  const tb = new Set(normalize(b).split(' ').filter(Boolean));
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  return shared / Math.max(ta.size, tb.size);
}

export function matchOdds(homeName: string, awayName: string, kickoff: string, entries: OddsEntry[]): MarketOdds | null {
  const kickoffTime = new Date(kickoff).getTime();
  let best: { score: number; odds: MarketOdds } | null = null;
  for (const entry of entries) {
    const homeSim = similarity(homeName, entry.home);
    const awaySim = similarity(awayName, entry.away);
    if (homeSim < 0.34 || awaySim < 0.34) continue;
    const hoursApart = Math.abs(new Date(entry.commence).getTime() - kickoffTime) / 3.6e6;
    const score = (homeSim + awaySim) / 2 + (hoursApart <= 24 ? 0.2 : -0.2);
    if (!best || score > best.score) best = { score, odds: entry.odds };
  }
  return best && best.score >= 0.5 ? best.odds : null;
}

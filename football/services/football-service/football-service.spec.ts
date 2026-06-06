import { predictFixture } from './lib/engine.js';
import type { Fixture } from './lib/types.js';

/** Build a fixture for testing the engine. */
function makeFixture(overrides: Partial<Fixture> = {}): Fixture {
  return {
    id: 'test-1',
    league: 'Test League',
    kickoff: '2024-05-12T14:00:00Z',
    status: 'NS',
    home: {
      id: 'h',
      name: 'Strong Home',
      elo: 1950,
      avgScored: 2.4,
      avgConceded: 0.9,
      form: ['W', 'W', 'W', 'D', 'W'],
      hasData: true,
    },
    away: {
      id: 'a',
      name: 'Weak Away',
      elo: 1620,
      avgScored: 1.0,
      avgConceded: 1.8,
      form: ['L', 'L', 'D', 'L', 'L'],
      hasData: true,
    },
    odds: { home: 1.3, draw: 5.5, away: 9.0 },
    ...overrides,
  };
}

describe('football engine', () => {
  it('produces probabilities that sum to ~100 and favor the stronger home side', () => {
    const p = predictFixture(makeFixture());
    const sum = p.probabilities.home + p.probabilities.draw + p.probabilities.away;
    expect(sum).toBeGreaterThanOrEqual(99);
    expect(sum).toBeLessThanOrEqual(101);
    expect(p.probabilities.home).toBeGreaterThan(p.probabilities.away);
  });

  it('generates an explanation and a confidence score in range', () => {
    const p = predictFixture(makeFixture());
    expect(p.explanation.length).toBeGreaterThan(0);
    expect(p.confidenceScore).toBeGreaterThanOrEqual(1);
    expect(p.confidenceScore).toBeLessThanOrEqual(10);
  });

  it('handles fixtures without odds (no value bet)', () => {
    const p = predictFixture(makeFixture({ odds: null }));
    expect(p.valueBet).toBe(false);
    expect(p.bestValue).toBeNull();
    expect(p.edges.length).toBe(0);
  });

  it('flags insufficient data and suppresses value bets when both sides lack data', () => {
    const p = predictFixture(
      makeFixture({
        home: { id: 'h', name: 'Unknown A', elo: 1500, avgScored: 1.3, avgConceded: 1.3, form: [], hasData: false },
        away: { id: 'a', name: 'Unknown B', elo: 1500, avgScored: 1.3, avgConceded: 1.3, form: [], hasData: false },
      })
    );
    expect(p.dataQuality).toBe('insufficient');
    expect(p.valueBet).toBe(false);
    expect(p.confidenceScore).toBeLessThanOrEqual(2);
  });
});

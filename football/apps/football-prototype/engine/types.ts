/**
 * Core domain types for the football intelligence engine.
 */

/** A single team with its dynamic strength rating and recent scoring profile. */
export type Team = {
  id: string;
  name: string;
  /** Dynamic ELO strength rating. */
  elo: number;
  /** Average goals scored per match (rolling). */
  avgScored: number;
  /** Average goals conceded per match (rolling). */
  avgConceded: number;
  /** Recent form: array of results, most recent last. 'W' | 'D' | 'L'. */
  form: Array<'W' | 'D' | 'L'>;
};

/** Bookmaker decimal odds for the three main outcomes. */
export type MarketOdds = {
  home: number;
  draw: number;
  away: number;
};

/** A fixture to be analyzed. */
export type Fixture = {
  id: string;
  league: string;
  kickoff: string;
  home: Team;
  away: Team;
  odds: MarketOdds;
};

/** Outcome probabilities, expressed as fractions that sum to ~1. */
export type OutcomeProbabilities = {
  home: number;
  draw: number;
  away: number;
};

/** The fully analyzed prediction for a fixture. */
export type Prediction = {
  fixtureId: string;
  match: string;
  league: string;
  kickoff: string;
  /** Model probabilities as percentages (0-100). */
  probabilities: {
    home: number;
    draw: number;
    away: number;
  };
  /** Expected goals for each side. */
  expectedGoals: {
    home: number;
    away: number;
  };
  /** Most likely correct score from the Poisson grid. */
  likelyScore: string;
  /** Confidence on a 1-10 scale. */
  confidenceScore: number;
  /** Whether a value bet edge was detected on any outcome. */
  valueBet: boolean;
  /** Best value outcome and its edge, if any. */
  bestValue: {
    outcome: 'home' | 'draw' | 'away';
    edgePercentage: number;
    modelProbability: number;
    impliedProbability: number;
    odds: number;
  } | null;
  /** Per-outcome edge breakdown vs the market. */
  edges: Array<{
    outcome: 'home' | 'draw' | 'away';
    modelProbability: number;
    impliedProbability: number;
    edgePercentage: number;
  }>;
  /** Human-readable reasons explaining the prediction. */
  explanation: string[];
};

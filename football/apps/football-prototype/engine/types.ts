/**
 * Frontend domain types — mirror the backend Prediction shape so the dashboard
 * renders live data returned by the Football Intelligence API.
 */

/** Bookmaker decimal odds for the three main outcomes. */
export type MarketOdds = {
  home: number;
  draw: number;
  away: number;
};

/** Over/Under goal markets. */
export type GoalMarkets = {
  over25: number;
  under25: number;
  over15: number;
  under15: number;
  over35: number;
  under35: number;
  btts: number;
  bttsFail: number;
};

/** Asian handicap probabilities. */
export type AsianHandicap = {
  homeMinusHalf: number;
  homePlusHalf: number;
  awayMinusHalf: number;
  awayPlusHalf: number;
  homeMinus1: number;
  homePlus1: number;
};

/** Top correct score probabilities from the Poisson grid. */
export type CorrectScoreGrid = Array<{ score: string; probability: number }>;

/** Kelly Criterion stake recommendation for a single outcome. */
export type KellyStake = {
  outcome: 'home' | 'draw' | 'away' | 'over25' | 'under25' | 'btts';
  modelProbability: number;
  odds: number;
  edgePercentage: number;
  kellyFraction: number;
  halfKelly: number;
  quarterKelly: number;
};

/** The fully analyzed, explainable prediction for a fixture. */
export type Prediction = {
  fixtureId: string;
  match: string;
  league: string;
  leagueCode: string;
  leagueLogo?: string;
  kickoff: string;
  homeName: string;
  awayName: string;
  homeLogo?: string;
  awayLogo?: string;
  homeForm: Array<'W' | 'D' | 'L'>;
  awayForm: Array<'W' | 'D' | 'L'>;
  odds: MarketOdds | null;
  dataQuality: 'full' | 'partial' | 'insufficient';
  probabilities: { home: number; draw: number; away: number };
  expectedGoals: { home: number; away: number };
  likelyScore: string;
  confidenceScore: number;
  valueBet: boolean;
  bestValue: {
    outcome: 'home' | 'draw' | 'away';
    edgePercentage: number;
    modelProbability: number;
    impliedProbability: number;
    odds: number;
  } | null;
  edges: Array<{
    outcome: 'home' | 'draw' | 'away';
    modelProbability: number;
    impliedProbability: number;
    edgePercentage: number;
  }>;
  goalMarkets: GoalMarkets;
  correctScores: CorrectScoreGrid;
  asianHandicap: AsianHandicap;
  kellyStakes: KellyStake[];
  h2hSummary: {
    played: number;
    homeWins: number;
    draws: number;
    awayWins: number;
    avgGoals: number;
    bttsRate: number;
  };
  homeAdvantageFactor: number;
  explanation: string[];
};

/** A single bet logged in the tracker. */
export type TrackedBet = {
  id: string;
  fixtureId: string;
  match: string;
  league: string;
  kickoff: string;
  market: string;
  outcome: string;
  odds: number;
  stake: number;
  modelProbability: number;
  edgePercentage: number;
  status: 'pending' | 'won' | 'lost' | 'void';
  pnl: number;
  createdAt: string;
};

/** Bankroll tracker summary. */
export type BankrollSummary = {
  initialBankroll: number;
  currentBankroll: number;
  totalStaked: number;
  totalPnl: number;
  roi: number;
  winRate: number;
  activeBets: number;
  settledBets: number;
  bestBet: TrackedBet | null;
  worstBet: TrackedBet | null;
  pnlCurve: number[];
};

/**
 * Shared analysis contracts and model interfaces.
 * Defines report, sentiment, fundamental, and entry-plan data shapes.
 */
export interface AnalystTarget {
  analyst: string;
  targetPrice: number;
  rating: 'buy' | 'hold' | 'sell';
}

export interface TargetConsensus {
  consensusTarget: number;
  upsidePercent: number;
  analysts: AnalystTarget[];
}

export interface SentimentDigest {
  score: number;
  trend: 'bullish' | 'neutral' | 'bearish';
  keySignals: string[];
  sources: Array<{ source: 'X' | 'Financial Times'; signal: string; confidence: number }>;
}

export interface FundamentalSummary {
  model: string;
  summary: string;
  strengths: string[];
  risks: string[];
  valuationNote: string;
}

export interface EntryPlan {
  model: string;
  buyZone: string;
  sellZone: string;
  stopLoss: string;
  takeProfit: string;
  rationale: string[];
}

export interface FundamentalModel {
  id: string;
  name: string;
  summarize(symbol: string, currentPrice: number): FundamentalSummary;
}

export interface EntryPointModel {
  id: string;
  name: string;
  plan(symbol: string, currentPrice: number): EntryPlan;
}

export interface TickerReport {
  symbol: string;
  currentPrice: number;
  targetConsensus: TargetConsensus;
  sentiment: SentimentDigest;
  fundamental: FundamentalSummary;
  entryPlan: EntryPlan;
  comparisons: {
    fundamentals: FundamentalSummary[];
    entries: EntryPlan[];
  };
}

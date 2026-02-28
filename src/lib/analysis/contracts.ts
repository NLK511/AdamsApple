/**
 * Shared analysis contracts and model interfaces.
 * Defines report shapes, pluggable providers, engines, and context composition.
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

export interface NewsSignal {
  source: 'X' | 'Financial Times';
  signal: string;
  confidence: number;
}

export interface SentimentDigest {
  score: number;
  trend: 'bullish' | 'neutral' | 'bearish';
  keySignals: string[];
  sources: NewsSignal[];
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

export interface NewsProvider {
  id: string;
  name: string;
  fetchSignals(symbol: string, fetchImpl: typeof fetch): Promise<NewsSignal[]>;
}

export interface TickerPriceProvider {
  id: string;
  name: string;
  fetchPrice(symbol: string, fetchImpl: typeof fetch): Promise<number | null>;
}

export interface SentimentEngine {
  id: string;
  name: string;
  build(symbol: string, signals: NewsSignal[]): SentimentDigest;
}

export interface AnalysisContext {
  id: string;
  name: string;
  newsProvider: NewsProvider;
  tickerPriceProvider: TickerPriceProvider;
  sentimentEngine: SentimentEngine;
  fundamentalModels: FundamentalModel[];
  entryPointModels: EntryPointModel[];
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

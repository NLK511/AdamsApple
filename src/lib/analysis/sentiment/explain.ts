import type { NewsSignal } from '../contracts';
import { analyzeSignal } from './scoring';

export interface ExplainedSignal {
  source: NewsSignal['source'];
  signal: string;
  confidence: number;
  rawScore: number;
  weightedContribution: number;
  positiveMatches: string[];
  negativeMatches: string[];
}

export interface SentimentExplanation {
  score: number;
  rationale: string;
  signals: ExplainedSignal[];
}

export const explainSentimentSignals = (label: string, signals: NewsSignal[]): SentimentExplanation => {
  if (signals.length === 0) {
    return {
      score: 0,
      rationale: `${label} sentiment has no signals, so score defaults to 0.`,
      signals: []
    };
  }

  const explainedSignals = signals.map((item) => {
    const analysis = analyzeSignal(item.signal);
    const weightedContribution = analysis.score * Math.max(item.confidence, 0.2);
    return {
      source: item.source,
      signal: item.signal,
      confidence: item.confidence,
      rawScore: analysis.score,
      weightedContribution,
      positiveMatches: analysis.positiveMatches,
      negativeMatches: analysis.negativeMatches
    };
  });

  const weightedScore = explainedSignals.reduce((acc, item) => acc + item.weightedContribution, 0);
  const normalized = Number((weightedScore / Math.max(explainedSignals.length, 1)).toFixed(1));

  return {
    score: normalized,
    rationale: `${label} score averages weighted token sentiment across ${explainedSignals.length} signals.`,
    signals: explainedSignals
  };
};

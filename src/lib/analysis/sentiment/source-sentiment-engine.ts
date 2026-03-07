import type { NewsSignal, SentimentScoreEngine } from '../contracts';
import { scoreSignal } from './scoring';

export const createSourceSentimentEngine = (
  id: string,
  name: string,
  predicate: (signal: NewsSignal) => boolean
): SentimentScoreEngine => ({
  id,
  name,
  score(signals: NewsSignal[]): number {
    const filtered = signals.filter(predicate);
    if (filtered.length === 0) return 0;
    const weightedScore = filtered.reduce(
      (acc, item) => acc + scoreSignal(item.signal) * Math.max(item.confidence, 0.2),
      0
    );
    return Number((weightedScore / Math.max(filtered.length, 1)).toFixed(1));
  }
});

export const newsSentimentEngine = createSourceSentimentEngine(
  'news-headline-sentiment',
  'News Headline Sentiment',
  (signal) => signal.source !== 'X'
);

export const socialNetworkSentimentEngine = createSourceSentimentEngine(
  'social-network-headline-sentiment',
  'Social Network Headline Sentiment',
  (signal) => signal.source === 'X'
);

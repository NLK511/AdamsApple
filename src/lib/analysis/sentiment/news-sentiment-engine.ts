import type { NewsSignal } from '../contracts';
import { scoreSignal } from './scoring';

export const newsSentimentEngine = {
  id: 'news-headline-sentiment',
  name: 'News Headline Sentiment',
  score(signals: NewsSignal[]): number {
    const filtered = signals.filter((signal) => signal.source !== 'X');
    if (filtered.length === 0) return 0;
    const weightedScore = filtered.reduce(
      (acc, item) => acc + scoreSignal(item.signal) * Math.max(item.confidence, 0.2),
      0
    );
    return Number((weightedScore / Math.max(filtered.length, 1)).toFixed(1));
  }
};

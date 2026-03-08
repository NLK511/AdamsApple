import type { NewsSignal, SentimentScoreEngine } from '../contracts';
import { scoreSignal } from './scoring';

export const createSourceSentimentEngine = (
  id: string,
  name: string
): SentimentScoreEngine => ({
  id,
  name,
  score(signals: NewsSignal[]): number {
    const weightedScore = signals.reduce(
      (acc, item) => acc + scoreSignal(item.signal) * Math.max(item.confidence, 0.2),
      0
    );
    console.log(`Calculated weighted score for ${id}: ${weightedScore} based on ${signals.length} signals.`);
    return Number((weightedScore / Math.max(signals.length, 1)*100).toFixed(2));
  }
});

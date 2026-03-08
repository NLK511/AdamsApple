export const positiveTokens = ['beats', 'growth', 'surge', 'upgrade', 'strong', 'buy', 'record', 'momentum'];
export const negativeTokens = ['miss', 'downgrade', 'lawsuit', 'drop', 'weak', 'sell', 'cuts'];

export interface SignalRationale {
  score: number;
  positiveMatches: string[];
  negativeMatches: string[];
}

export const analyzeSignal = (text: string): SignalRationale => {
  const content = text.toLowerCase();
  const positiveMatches = positiveTokens.filter((token) => content.includes(token));
  const negativeMatches = negativeTokens.filter((token) => content.includes(token));
  return {
    score: positiveMatches.length - negativeMatches.length,
    positiveMatches,
    negativeMatches
  };
};

export const scoreSignal = (text: string) => analyzeSignal(text).score;

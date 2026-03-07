export const scoreSignal = (text: string) => {
  const content = text.toLowerCase();
  const positive = ['beats', 'growth', 'surge', 'upgrade', 'strong', 'buy', 'record', 'momentum'];
  const negative = ['miss', 'downgrade', 'lawsuit', 'drop', 'weak', 'sell', 'cuts'];
  const posHits = positive.reduce((acc, token) => acc + Number(content.includes(token)), 0);
  const negHits = negative.reduce((acc, token) => acc + Number(content.includes(token)), 0);
  return posHits - negHits;
};

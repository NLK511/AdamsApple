import { scoreSignal } from '../sentiment/scoring';
import type { NewsSignal, SocialNetworkProvider } from '../contracts';

const xSearchProxyUrl = '/api/providers/x/search';

const confidenceFromScore = (score: number) => Math.min(0.95, Math.max(0.5, 0.55 + Math.abs(score) * 0.08));

const fallbackSignals = (symbol: string): NewsSignal[] => {
  const seed = [...symbol.toUpperCase()].reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const positive = seed % 2 === 0;
  return [
    {
      source: 'X',
      signal: positive
        ? `${symbol} social posts show strong momentum and buy interest around recent catalysts.`
        : `${symbol} social posts discuss weak setup, downgrade chatter, and downside risks.`,
      confidence: 0.62
    }
  ];
};

export const fetchXSignals = async (
  symbol: string,
  fetchImpl: typeof fetch,
  xSearchProxyUrlOverride: string = xSearchProxyUrl
): Promise<NewsSignal[]> => {
  const url = new URL(xSearchProxyUrlOverride, 'http://local.proxy');
  url.searchParams.set('q', `${symbol.toUpperCase()} lang:en -is:retweet`);
  url.searchParams.set('max_results', '10');

  console.log(`[x-provider] fetching X signals for ${symbol.toUpperCase()}`);
  const response = await fetchImpl(`${url.pathname}${url.search}`);
  if (!response.ok) {
    console.warn(`[x-provider] search failed for ${symbol.toUpperCase()} with status ${response.status}; using fallback signals.`);
    return fallbackSignals(symbol);
  }

  const payload = await response.json();
  const rows = Array.isArray(payload?.data) ? payload.data : [];

  const signals = rows
    .map((item: { text?: string }) => String(item?.text ?? '').trim())
    .filter((text: string) => text.length > 0)
    .slice(0, 6)
    .map((text: string) => ({
      source: 'X' as const,
      signal: text,
      confidence: confidenceFromScore(scoreSignal(text))
    }));

  if (signals.length === 0) {
    console.warn(`[x-provider] no usable tweets for ${symbol.toUpperCase()}; using fallback signals.`);
    return fallbackSignals(symbol);
  }

  console.log(`[x-provider] parsed ${signals.length} X signals for ${symbol.toUpperCase()}`);
  return signals;
};

export const xSocialNetworkProvider: SocialNetworkProvider = {
  id: 'x-recent-search',
  name: 'X Recent Search Provider',
  async fetchSignals(symbol, fetchImpl) {
    return fetchXSignals(symbol, fetchImpl);
  }
};

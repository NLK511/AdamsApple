/**
 * Live provider adapters using SvelteKit proxy endpoints for external Yahoo APIs.
 * Ensures browser consumers avoid direct cross-origin requests and CORS failures.
 */
import type { NewsProvider, NewsSignal, SocialNetworkProvider } from '../contracts';

const yahooSearchProxyUrl = '/api/providers/yahoo/search';

const parseSource = (publisher: string): NewsSignal['source'] =>
  /financial\s*times/i.test(publisher) ? 'Financial Times' : 'X';

const fetchYahooSignals = async (
  symbol: string,
  fetchImpl: typeof fetch,
  yahooSearchProxyUrlOverride: string = yahooSearchProxyUrl
): Promise<NewsSignal[]> => {
  console.log(`Fetching Yahoo signals for ${symbol} from proxy URL: ${yahooSearchProxyUrlOverride}`);
  const url = new URL(yahooSearchProxyUrlOverride, 'http://local.proxy');
  url.searchParams.set('q', symbol.toUpperCase());
  url.searchParams.set('newsCount', '8');

  const response = await fetchImpl(`${url.pathname}${url.search}`);
  if (!response.ok) return [];

  const payload = await response.json();
  const news = Array.isArray(payload?.news) ? payload.news : [];

  return news
    .map((item: { title?: string; publisher?: string }) => {
      const signal = String(item?.title ?? '').trim();
      if (!signal) return null;
      return {
        source: parseSource(String(item?.publisher ?? 'X')),
        signal,
        confidence: /financial\s*times/i.test(String(item?.publisher ?? '')) ? 0.8 : 0.66
      } satisfies NewsSignal;
    })
    .filter((row: NewsSignal | null): row is NewsSignal => row !== null)
    .slice(0, 6);
};

export const yahooNewsProvider: NewsProvider = {
  id: 'yahoo-news-ft',
  name: 'Yahoo Financial News Provider',
  async fetchSignals(symbol, fetchImpl) {
    const signals = await fetchYahooSignals(symbol, fetchImpl);
    return signals.filter((signal) => signal.source !== 'X');
  }
};

export const yahooSocialNetworkProvider: SocialNetworkProvider = {
  id: 'yahoo-news-x',
  name: 'Yahoo X Signals Provider',
  async fetchSignals(symbol, fetchImpl) {
    const signals = await fetchYahooSignals(symbol, fetchImpl);
    return signals.filter((signal) => signal.source === 'X');
  }
};

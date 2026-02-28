/**
 * Live provider adapters using SvelteKit proxy endpoints for external Yahoo APIs.
 * Ensures browser consumers avoid direct cross-origin requests and CORS failures.
 */
import type { NewsProvider, NewsSignal, TickerPriceProvider } from '../contracts';

export interface LiveProviderConfig {
  yahooQuoteProxyUrl: string;
  yahooSearchProxyUrl: string;
}

export const defaultLiveProviderConfig: LiveProviderConfig = {
  yahooQuoteProxyUrl: '/api/providers/yahoo/quote',
  yahooSearchProxyUrl: '/api/providers/yahoo/search'
};

const parseSource = (publisher: string): NewsSignal['source'] =>
  /financial\s*times/i.test(publisher) ? 'Financial Times' : 'X';

export const fetchYahooPrice = async (
  symbol: string,
  fetchImpl: typeof fetch,
  config = defaultLiveProviderConfig
): Promise<number | null> => {
  const url = new URL(config.yahooQuoteProxyUrl, 'http://local.proxy');
  url.searchParams.set('symbols', symbol.toUpperCase());

  const response = await fetchImpl(`${url.pathname}${url.search}`);
  if (!response.ok) return null;

  const payload = await response.json();
  const quote = payload?.quoteResponse?.result?.[0];
  const price = quote?.regularMarketPrice;
  return Number.isFinite(price) && price > 0 ? Number(price) : null;
};

export const fetchYahooNewsSignals = async (
  symbol: string,
  fetchImpl: typeof fetch,
  config = defaultLiveProviderConfig
): Promise<NewsSignal[]> => {
  const url = new URL(config.yahooSearchProxyUrl, 'http://local.proxy');
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

export const yahooTickerPriceProvider: TickerPriceProvider = {
  id: 'yahoo-price',
  name: 'Yahoo Finance Quote Provider',
  async fetchPrice(symbol, fetchImpl) {
    return fetchYahooPrice(symbol, fetchImpl);
  }
};

export const yahooNewsProvider: NewsProvider = {
  id: 'yahoo-news',
  name: 'Yahoo Finance News Provider',
  async fetchSignals(symbol, fetchImpl) {
    return fetchYahooNewsSignals(symbol, fetchImpl);
  }
};

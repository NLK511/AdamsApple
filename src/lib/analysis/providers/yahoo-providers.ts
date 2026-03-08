/**
 * Live provider adapters using SvelteKit proxy endpoints for external Yahoo APIs.
 * Ensures browser consumers avoid direct cross-origin requests and CORS failures.
 */
import type { NewsProvider, SocialNetworkProvider } from '../contracts';
import {
  buildArticleSignalPipeline,
  extractTextFromHtml,
  normalizeListFetch
} from './shared/article-signal-pipeline';
import { classifyProviderSource } from './shared/source-classifier';
import { providerLog } from './shared/provider-log';

const yahooSearchProxyUrl = '/api/providers/yahoo/search';
const yahooArticleProxyUrl = '/api/providers/yahoo/article';

const fetchYahooListPayload = async (
  symbol: string,
  fetchImpl: typeof fetch,
  yahooSearchProxyUrlOverride: string = yahooSearchProxyUrl
): Promise<unknown> => {
  const url = new URL(yahooSearchProxyUrlOverride, 'http://local.proxy');
  url.searchParams.set('q', symbol.toUpperCase());
  url.searchParams.set('newsCount', '8');

  providerLog(`Fetching Yahoo signals for ${symbol} from proxy URL: ${url.pathname}${url.search}`);
  const response = await fetchImpl(`${url.pathname}${url.search}`);
  providerLog(`Yahoo search response for ${symbol}: ${response.status} ${response.statusText}`);

  if (!response.ok) {
    return { news: [] };
  }

  return response.json();
};

const fetchYahooArticle = async (link: string, title: string, fetchImpl: typeof fetch): Promise<string | null> => {
  const url = new URL(yahooArticleProxyUrl, 'http://local.proxy');
  url.searchParams.set('url', link);

  const response = await fetchImpl(`${url.pathname}${url.search}`);
  if (!response.ok) {
    return title;
  }

  return response.text();
};

const fetchYahooSignals = async (symbol: string, fetchImpl: typeof fetch) =>
  buildArticleSignalPipeline({
    symbol,
    fetchImpl,
    fetchListPayload: fetchYahooListPayload,
    normalizeItems: (payload) => normalizeListFetch((payload as { news?: unknown })?.news),
    fetchArticle: fetchYahooArticle,
    normalizeArticleText: extractTextFromHtml,
    classifySource: (item) => classifyProviderSource(item.publisher)
  });

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

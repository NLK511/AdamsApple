/**
 * Live provider adapters using SvelteKit proxy endpoints for external Yahoo APIs.
 * Ensures browser consumers avoid direct cross-origin requests and CORS failures.
 */
import { scoreSignal } from '../sentiment/scoring';
import type { NewsProvider, NewsSignal, SocialNetworkProvider } from '../contracts';

const yahooSearchProxyUrl = '/api/providers/yahoo/search';
const yahooArticleProxyUrl = '/api/providers/yahoo/article';

const parseSource = (publisher: string): NewsSignal['source'] =>
  /financial\s*times|reuters|bloomberg|wsj|marketwatch|cnbc/i.test(publisher)
    ? 'Financial Times'
    : 'X';

const stripHtml = (html: string) =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const scoreToConfidence = (score: number) => Math.min(0.95, Math.max(0.5, 0.55 + Math.abs(score) * 0.08));

const readArticleSignal = async (link: string, title: string, fetchImpl: typeof fetch): Promise<{ signal: string; confidence: number }> => {
  const url = new URL(yahooArticleProxyUrl, 'http://local.proxy');
  url.searchParams.set('url', link);

  const response = await fetchImpl(`${url.pathname}${url.search}`);
  if (!response.ok) {
    return { signal: title, confidence: 0.6 };
  }

  const html = await response.text();
  const text = stripHtml(html).slice(0, 900);
  const signalText = text.length > 40 ? text : title;
  const score = scoreSignal(signalText);
  return { signal: signalText, confidence: scoreToConfidence(score) };
};

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

  const signals = await Promise.all(
    news.slice(0, 6).map(async (item: { title?: string; publisher?: string; link?: string }) => {
      const title = String(item?.title ?? '').trim();
      if (!title) return null;
      const source = parseSource(String(item?.publisher ?? 'X'));
      const link = String(item?.link ?? '').trim();

      if (!link) {
        return { source, signal: title, confidence: 0.6 } satisfies NewsSignal;
      }

      try {
        const analyzed = await readArticleSignal(link, title, fetchImpl);
        return { source, signal: analyzed.signal, confidence: analyzed.confidence } satisfies NewsSignal;
      } catch {
        return { source, signal: title, confidence: 0.6 } satisfies NewsSignal;
      }
    })
  );

  return signals.filter((row: NewsSignal | null): row is NewsSignal => row !== null);
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

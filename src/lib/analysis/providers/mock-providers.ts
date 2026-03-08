/**
 * Dedicated mock/random providers used by the default mock analysis context.
 * Centralizes synthetic spot prices and headline signals for offline development.
 */
import type { PriceProviderResponse } from '../../../model/providers/price-provider-response';
import type { NewsProvider, NewsSignal, SocialNetworkProvider, TickerPriceProvider } from '../contracts';
import { buildArticleSignalPipeline, normalizeListFetch } from './shared/article-signal-pipeline';
import type { NormalizedProviderNewsItem } from './shared/types';

const symbolSeed = (symbol: string) => [...symbol.toUpperCase()].reduce((acc, char) => acc + char.charCodeAt(0), 0);

export const anchorPrice = async (symbol: string): Promise<PriceProviderResponse | null> => {
  const sum = symbolSeed(symbol) + Date.now() % 1000000;
  return Promise.resolve({
    Ticker: symbol.toUpperCase(),
    Name: symbol.toUpperCase(),
    Price: Number((45 + (sum % 200) + (sum % 13) * 0.8).toFixed(2)),
    ChangeAmount: Number(((sum % 5) - 2.5).toFixed(2)),
    ChangePercentage: Number((((sum % 5) - 2.5) / (45 + (sum % 200)) * 100).toFixed(2))
  } satisfies PriceProviderResponse);
};

const sampleArticles = {
  'https://mock.local/news/earnings-beat':
    'Company beats earnings expectations, records strong growth, and upgrades guidance with accelerating demand.',
  'https://mock.local/news/margin-pressure':
    'Analysts discuss weak margins, demand slowdown risk, and potential forecast cuts after a challenging quarter.',
  'https://mock.local/social/bull-thread':
    'Social thread reports strong momentum and buy interest as users highlight product adoption and record usage.',
  'https://mock.local/social/bear-thread':
    'Social posts flag downgrade chatter, lawsuit worries, and weak trend signals with users reducing exposure.'
} as const;

const buildMockFinancialItems = (symbol: string): NormalizedProviderNewsItem[] => {
  const tone = symbolSeed(symbol) % 2;
  return [
    {
      publisher: 'Financial Times',
      title: `${symbol} analysts review quality of earnings and guidance updates`,
      link: tone === 0 ? 'https://mock.local/news/earnings-beat' : 'https://mock.local/news/margin-pressure'
    }
  ];
};

const buildMockSocialItems = (symbol: string): NormalizedProviderNewsItem[] => {
  const tone = symbolSeed(symbol) % 2;
  return [
    {
      publisher: 'X',
      title: `${symbol} social thread sentiment pulse`,
      link: tone === 0 ? 'https://mock.local/social/bull-thread' : 'https://mock.local/social/bear-thread'
    }
  ];
};

const fetchMockArticle = async (link: string, title: string): Promise<string | null> =>
  sampleArticles[link as keyof typeof sampleArticles] ?? title;

export const mockTickerPriceProvider: TickerPriceProvider = {
  id: 'mock-random-price',
  name: 'Mock Random Price Provider',
  async fetchPrice(symbol: string) {
    return anchorPrice(symbol);
  }
};

export const mockNewsProvider: NewsProvider = {
  id: 'mock-headlines-news',
  name: 'Mock Financial News Provider',
  async fetchSignals(symbol: string, fetchImpl): Promise<NewsSignal[]> {
    return buildArticleSignalPipeline({
      symbol,
      fetchImpl,
      fetchListPayload: async (currentSymbol) => ({ items: buildMockFinancialItems(currentSymbol) }),
      normalizeItems: (payload) => normalizeListFetch((payload as { items?: unknown })?.items),
      fetchArticle: (link, title) => fetchMockArticle(link, title),
      normalizeArticleText: (content) => content.trim(),
      classifySource: () => 'Financial Times'
    });
  }
};

export const mockSocialNetworkProvider: SocialNetworkProvider = {
  id: 'mock-headlines-x',
  name: 'Mock X Provider',
  async fetchSignals(symbol: string, fetchImpl): Promise<NewsSignal[]> {
    return buildArticleSignalPipeline({
      symbol,
      fetchImpl,
      fetchListPayload: async (currentSymbol) => ({ items: buildMockSocialItems(currentSymbol) }),
      normalizeItems: (payload) => normalizeListFetch((payload as { items?: unknown })?.items),
      fetchArticle: (link, title) => fetchMockArticle(link, title),
      normalizeArticleText: (content) => content.trim(),
      classifySource: () => 'X'
    });
  }
};

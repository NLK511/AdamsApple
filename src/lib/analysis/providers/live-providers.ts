/**
 * Live market/news provider adapters built on public endpoints.
 * Fetches spot prices, consensus proxies, and sentiment signals for deep-dive pages.
 */
import type { SentimentDigest, TargetConsensus } from '../contracts';

export interface LiveProviderConfig {
  stooqBaseUrl: string;
  yahooQuoteSummaryBaseUrl: string;
  ftRssSearchBaseUrl: string;
  xRssSearchBaseUrl: string;
}

export interface LiveSnapshot {
  symbol: string;
  currentPrice: number | null;
  targetConsensus: TargetConsensus | null;
  sentiment: SentimentDigest | null;
  sources: {
    market: string[];
    news: string[];
  };
}

export const defaultLiveProviderConfig: LiveProviderConfig = {
  stooqBaseUrl: 'https://stooq.com/q/l/',
  yahooQuoteSummaryBaseUrl: 'https://query1.finance.yahoo.com/v10/finance/quoteSummary/',
  ftRssSearchBaseUrl: 'https://www.ft.com/search',
  xRssSearchBaseUrl: 'https://nitter.net/search/rss'
};

const scoreSignal = (text: string) => {
  const content = text.toLowerCase();
  const positive = ['beats', 'growth', 'surge', 'upgrade', 'strong', 'buy'];
  const negative = ['miss', 'downgrade', 'lawsuit', 'drop', 'weak', 'sell'];
  const posHits = positive.reduce((acc, token) => acc + Number(content.includes(token)), 0);
  const negHits = negative.reduce((acc, token) => acc + Number(content.includes(token)), 0);
  return posHits - negHits;
};

const parseRssTitles = (xml: string, limit = 6) => {
  const matches = [...xml.matchAll(/<title>([^<]+)<\/title>/gi)]
    .map((m) => m[1].trim())
    .filter((value) => value && !value.toLowerCase().includes('rss'));
  return matches.slice(0, limit);
};

const toTrend = (score: number): 'bullish' | 'neutral' | 'bearish' => {
  if (score > 1.2) return 'bullish';
  if (score < -1.2) return 'bearish';
  return 'neutral';
};

export const fetchStooqPrice = async (
  symbol: string,
  fetchImpl: typeof fetch,
  config = defaultLiveProviderConfig
): Promise<number | null> => {
  const code = `${symbol.toLowerCase()}.us`;
  const url = new URL(config.stooqBaseUrl);
  url.searchParams.set('s', code);
  url.searchParams.set('i', 'd');

  const response = await fetchImpl(url.toString());
  if (!response.ok) return null;
  const csv = await response.text();
  const rows = csv.trim().split('\n');
  if (rows.length < 2) return null;
  const cols = rows[1].split(',');
  const close = Number(cols[6]);
  return Number.isFinite(close) && close > 0 ? close : null;
};

export const fetchYahooTargetConsensus = async (
  symbol: string,
  currentPrice: number,
  fetchImpl: typeof fetch,
  config = defaultLiveProviderConfig
): Promise<TargetConsensus | null> => {
  const url = new URL(`${config.yahooQuoteSummaryBaseUrl}${symbol}`);
  url.searchParams.set('modules', 'financialData,recommendationTrend');

  const response = await fetchImpl(url.toString());
  if (!response.ok) return null;
  const payload = await response.json();
  const result = payload?.quoteSummary?.result?.[0];
  if (!result) return null;

  const targetMean = result?.financialData?.targetMeanPrice?.raw;
  if (!Number.isFinite(targetMean)) return null;

  const trend = result?.recommendationTrend?.trend?.[0] ?? {};
  const analysts = [
    { analyst: 'Yahoo Aggregated Buys', targetPrice: Number(targetMean), rating: 'buy' as const },
    { analyst: 'Yahoo Aggregated Holds', targetPrice: Number(targetMean) * 0.97, rating: 'hold' as const },
    { analyst: 'Yahoo Aggregated Sells', targetPrice: Number(targetMean) * 0.92, rating: 'sell' as const }
  ].map((row) => ({ ...row, targetPrice: Number(row.targetPrice.toFixed(2)) }));

  const upsidePercent = Number((((targetMean - currentPrice) / currentPrice) * 100).toFixed(2));
  return {
    consensusTarget: Number(Number(targetMean).toFixed(2)),
    upsidePercent,
    analysts: analysts.map((item, index) => {
      const counts = [trend.strongBuy ?? 0, trend.hold ?? 0, trend.sell ?? 0];
      return {
        ...item,
        analyst: `${item.analyst} (${counts[index] ?? 0})`
      };
    })
  };
};

export const fetchLiveSentiment = async (
  symbol: string,
  fetchImpl: typeof fetch,
  config = defaultLiveProviderConfig
): Promise<SentimentDigest | null> => {
  const ftUrl = new URL(config.ftRssSearchBaseUrl);
  ftUrl.searchParams.set('q', symbol);
  ftUrl.searchParams.set('format', 'rss');

  const xUrl = new URL(config.xRssSearchBaseUrl);
  xUrl.searchParams.set('f', 'tweets');
  xUrl.searchParams.set('q', symbol);

  const [ftResp, xResp] = await Promise.allSettled([fetchImpl(ftUrl.toString()), fetchImpl(xUrl.toString())]);

  let ftTitles: string[] = [];
  let xTitles: string[] = [];

  if (ftResp.status === 'fulfilled' && ftResp.value.ok) {
    ftTitles = parseRssTitles(await ftResp.value.text());
  }
  if (xResp.status === 'fulfilled' && xResp.value.ok) {
    xTitles = parseRssTitles(await xResp.value.text());
  }

  if (ftTitles.length === 0 && xTitles.length === 0) return null;

  const ftScore = ftTitles.reduce((acc, title) => acc + scoreSignal(title), 0);
  const xScore = xTitles.reduce((acc, title) => acc + scoreSignal(title), 0);
  const normalized = Number(((ftScore * 0.6 + xScore * 0.4) / 2).toFixed(1));

  return {
    score: normalized,
    trend: toTrend(normalized),
    keySignals: [...ftTitles.slice(0, 2), ...xTitles.slice(0, 2)],
    sources: [
      {
        source: 'X',
        signal: xTitles[0] ?? 'X feed currently unavailable for this symbol.',
        confidence: xTitles.length > 0 ? 0.7 : 0.3
      },
      {
        source: 'Financial Times',
        signal: ftTitles[0] ?? 'FT feed currently unavailable for this symbol.',
        confidence: ftTitles.length > 0 ? 0.78 : 0.35
      }
    ]
  };
};

export const fetchLiveSnapshot = async (
  symbol: string,
  fetchImpl: typeof fetch,
  config = defaultLiveProviderConfig
): Promise<LiveSnapshot> => {
  const sources = { market: [] as string[], news: [] as string[] };

  let currentPrice: number | null = null;
  try {
    currentPrice = await fetchStooqPrice(symbol, fetchImpl, config);
    if (currentPrice) sources.market.push('stooq');
  } catch {
    // no-op
  }

  let targetConsensus: TargetConsensus | null = null;
  if (currentPrice) {
    try {
      targetConsensus = await fetchYahooTargetConsensus(symbol, currentPrice, fetchImpl, config);
      if (targetConsensus) sources.market.push('yahoo-finance');
    } catch {
      // no-op
    }
  }

  let sentiment: SentimentDigest | null = null;
  try {
    sentiment = await fetchLiveSentiment(symbol, fetchImpl, config);
    if (sentiment) sources.news.push('financial-times-rss', 'nitter-rss');
  } catch {
    // no-op
  }

  return {
    symbol,
    currentPrice,
    targetConsensus,
    sentiment,
    sources
  };
};

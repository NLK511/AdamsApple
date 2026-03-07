/**
 * Dedicated mock/random providers used by the default mock analysis context.
 * Centralizes synthetic spot prices and headline signals for offline development.
 */
import type { PriceProviderResponse } from '../../../model/providers/price-provider-response';
import type { NewsProvider, NewsSignal, SocialNetworkProvider, TickerPriceProvider } from '../contracts';

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

const xSignals = (symbol: string, tone: number) => [
  `${symbol} chatter highlights improving guidance confidence.`,
  `${symbol} social momentum points to range-bound positioning.`,
  `${symbol} users flag macro pressure on near-term catalysts.`
][tone];

const newsSignals = (symbol: string, tone: number) => [
  `${symbol} execution consistency remains the core analyst narrative.`,
  `${symbol} valuation debate centers on margin durability.`,
  `${symbol} sector peers indicate demand normalization themes.`
][tone];

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
  async fetchSignals(symbol: string): Promise<NewsSignal[]> {
    const tone = symbolSeed(symbol) % 3;
    return [{ source: 'Financial Times', signal: newsSignals(symbol, (tone + 1) % 3), confidence: 0.71 + tone * 0.04 }];
  }
};

export const mockSocialNetworkProvider: SocialNetworkProvider = {
  id: 'mock-headlines-x',
  name: 'Mock X Provider',
  async fetchSignals(symbol: string): Promise<NewsSignal[]> {
    const tone = symbolSeed(symbol) % 3;
    return [{ source: 'X', signal: xSignals(symbol, tone), confidence: 0.62 + tone * 0.06 }];
  }
};

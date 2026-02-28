/**
 * Dedicated mock/random providers used by the default mock analysis context.
 * Centralizes synthetic spot prices and headline signals for offline development.
 */
import type { NewsProvider, NewsSignal, TickerPriceProvider } from '../contracts';

const symbolSeed = (symbol: string) => [...symbol.toUpperCase()].reduce((acc, char) => acc + char.charCodeAt(0), 0);

export const anchorPrice = (symbol: string) => {
  const sum = symbolSeed(symbol);
  return Number((45 + (sum % 200) + (sum % 13) * 0.8).toFixed(2));
};

export const buildMockSignals = (symbol: string): NewsSignal[] => {
  const seed = symbolSeed(symbol);
  const tone = seed % 3;

  const xSignals = [
    `${symbol} chatter highlights improving guidance confidence.`,
    `${symbol} social momentum points to range-bound positioning.`,
    `${symbol} users flag macro pressure on near-term catalysts.`
  ];

  const ftSignals = [
    `${symbol} execution consistency remains the core analyst narrative.`,
    `${symbol} valuation debate centers on margin durability.`,
    `${symbol} sector peers indicate demand normalization themes.`
  ];

  return [
    { source: 'X', signal: xSignals[tone], confidence: 0.62 + tone * 0.06 },
    { source: 'Financial Times', signal: ftSignals[(tone + 1) % 3], confidence: 0.71 + tone * 0.04 }
  ];
};

export const mockTickerPriceProvider: TickerPriceProvider = {
  id: 'mock-random-price',
  name: 'Mock Random Price Provider',
  async fetchPrice(symbol: string) {
    return anchorPrice(symbol);
  }
};

export const mockNewsProvider: NewsProvider = {
  id: 'mock-headlines',
  name: 'Mock Headlines Provider',
  async fetchSignals(symbol: string) {
    return buildMockSignals(symbol);
  }
};

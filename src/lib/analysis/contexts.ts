/**
 * Analysis context catalog for wiring providers and engines by runtime profile.
 * Exposes default_mock and default_live presets with pluggable extension points.
 */
import type { AnalysisContext } from './contracts';
import {
  defaultEntryPointModels,
  defaultFundamentalModels
} from './engines';
import { tickerPriceProvider } from './providers/default-providers';
import { yahooNewsProvider, yahooSocialNetworkProvider } from './providers/yahoo-providers';
import { mockNewsProvider, mockSocialNetworkProvider, mockTickerPriceProvider } from './providers/mock-providers';
import { createSourceSentimentEngine } from './sentiment/source-sentiment-engine';

export const analysisContexts: AnalysisContext[] = [
  {
    id: 'default_mock',
    name: 'Default Mock Context',
    refreshIntervalMs: 5000,
    newsProvider: mockNewsProvider,
    tickerPriceProvider: mockTickerPriceProvider,
    socialNetworkProvider: mockSocialNetworkProvider,
    sentimentNewsEngine: createSourceSentimentEngine(
      'mock-news-sentiment',
      'Mock News Sentiment'
    ),
    socialNetworkEngine: createSourceSentimentEngine(
      'mock-social-sentiment',
      'Mock Social Sentiment'
    ),
    fundamentalModels: defaultFundamentalModels,
    entryPointModels: defaultEntryPointModels
  },
  {
    id: 'default_live',
    name: 'Default Live Context ',
    refreshIntervalMs: 30000,
    newsProvider: yahooNewsProvider,
    tickerPriceProvider: tickerPriceProvider,
    socialNetworkProvider: yahooSocialNetworkProvider,
    sentimentNewsEngine: createSourceSentimentEngine(
      'yahoo-news-sentiment',
      'Yahoo News Sentiment'
    ),
    socialNetworkEngine: createSourceSentimentEngine(
      'yahoo-social-sentiment',
      'Yahoo Social Sentiment'
    ),
    fundamentalModels: defaultFundamentalModels,
    entryPointModels: defaultEntryPointModels
  }
];

export const getAnalysisContext = (contextId: string | undefined): AnalysisContext =>
  analysisContexts.find((context) => context.id === contextId) ?? analysisContexts[0];

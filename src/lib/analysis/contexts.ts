/**
 * Analysis context catalog for wiring providers and engines by runtime profile.
 * Exposes default_mock and default_live presets with pluggable extension points.
 */
import type { AnalysisContext } from './contracts';
import {
  defaultEntryPointModels,
  defaultFundamentalModels,
  defaultSentimentEngines
} from './engines';
import { yahooNewsProvider, yahooTickerPriceProvider } from './providers/live-providers';
import { mockNewsProvider, mockTickerPriceProvider } from './providers/mock-providers';

export const analysisContexts: AnalysisContext[] = [
  {
    id: 'default_mock',
    name: 'Default Mock Context',
    newsProvider: mockNewsProvider,
    tickerPriceProvider: mockTickerPriceProvider,
    sentimentEngine: defaultSentimentEngines[0],
    fundamentalModels: defaultFundamentalModels,
    entryPointModels: defaultEntryPointModels
  },
  {
    id: 'default_live',
    name: 'Default Live Context (Yahoo)',
    newsProvider: yahooNewsProvider,
    tickerPriceProvider: yahooTickerPriceProvider,
    sentimentEngine: defaultSentimentEngines[0],
    fundamentalModels: defaultFundamentalModels,
    entryPointModels: defaultEntryPointModels
  }
];

export const getAnalysisContext = (contextId: string | null | undefined): AnalysisContext =>
  analysisContexts.find((context) => context.id === contextId) ?? analysisContexts[0];

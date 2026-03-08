import type {
  AnalysisContext,
  EntryPointModel,
  FundamentalModel,
  NewsProvider,
  SentimentScoreEngine,
  SocialNetworkProvider,
  TickerPriceProvider
} from './contracts';

const MIN_REFRESH_INTERVAL_MS = 1_000;
const MAX_REFRESH_INTERVAL_MS = 300_000;

interface AnalysisContextBuilderInput {
  id: string;
  name: string;
  refreshIntervalMs: number;
  newsProvider: NewsProvider;
  tickerPriceProvider: TickerPriceProvider;
  socialNetworkProvider: SocialNetworkProvider;
  sentimentNewsEngine: SentimentScoreEngine;
  socialNetworkEngine: SentimentScoreEngine;
  fundamentalModels: FundamentalModel[];
  entryPointModels: EntryPointModel[];
}

const requiredFieldMap: Array<[keyof AnalysisContextBuilderInput, string]> = [
  ['newsProvider', 'news provider'],
  ['tickerPriceProvider', 'ticker price provider'],
  ['socialNetworkProvider', 'social network provider'],
  ['sentimentNewsEngine', 'news sentiment engine'],
  ['socialNetworkEngine', 'social network sentiment engine']
];

const isInvalidRefreshInterval = (refreshIntervalMs: number): boolean =>
  refreshIntervalMs < MIN_REFRESH_INTERVAL_MS || refreshIntervalMs > MAX_REFRESH_INTERVAL_MS;

export const validateRefreshInterval = (refreshIntervalMs: number, contextId: string): void => {
  if (isInvalidRefreshInterval(refreshIntervalMs)) {
    throw new Error(
      `Analysis context "${contextId}" has refreshIntervalMs=${refreshIntervalMs}. Expected ${MIN_REFRESH_INTERVAL_MS}-${MAX_REFRESH_INTERVAL_MS}.`
    );
  }
};

export const createAnalysisContext = (input: AnalysisContextBuilderInput): AnalysisContext => {
  for (const [field, label] of requiredFieldMap) {
    if (!input[field]) {
      throw new Error(`Analysis context "${input.id}" is missing ${label}.`);
    }
  }

  validateRefreshInterval(input.refreshIntervalMs, input.id);

  return {
    ...input
  };
};

export const validateUniqueAnalysisContextIds = (contexts: AnalysisContext[]): void => {
  const seen = new Set<string>();

  for (const context of contexts) {
    if (seen.has(context.id)) {
      throw new Error(`Duplicate analysis context id detected: "${context.id}".`);
    }

    seen.add(context.id);
  }
};

export const validateAnalysisContexts = (contexts: AnalysisContext[]): void => {
  validateUniqueAnalysisContextIds(contexts);

  for (const context of contexts) {
    createAnalysisContext(context);
  }
};

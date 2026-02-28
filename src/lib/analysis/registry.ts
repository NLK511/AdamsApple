/**
 * Analysis report assembly and cache integration.
 * Builds ticker reports from a selected context (providers + engines + strategies).
 */
import type { AnalysisContext, EntryPointModel, FundamentalModel, TickerReport } from './contracts';
import { getAnalysisContext } from './contexts';
import { buildTargetConsensus, defaultEntryPointModels, defaultFundamentalModels } from './engines';
import { InMemoryTickerMetadataStorage } from './metadata-storage';

export const metadataStorage = new InMemoryTickerMetadataStorage();

interface BuildOptions {
  contextId?: string | null;
  fundamentalModelId?: string | null;
  entryModelId?: string | null;
  now?: number;
}

const getFundamentalModel = (context: AnalysisContext, id: string | null | undefined): FundamentalModel =>
  context.fundamentalModels.find((model) => model.id === id) ?? context.fundamentalModels[0];

const getEntryPointModel = (context: AnalysisContext, id: string | null | undefined): EntryPointModel =>
  context.entryPointModels.find((model) => model.id === id) ?? context.entryPointModels[0];

export const fundamentalModels = defaultFundamentalModels;
export const entryPointModels = defaultEntryPointModels;

export const buildTickerReport = (
  symbol: string,
  currentPrice = 0,
  opts?: BuildOptions
): TickerReport => {
  const context = getAnalysisContext(opts?.contextId);
  const normalized = symbol.toUpperCase();
  const fundamentalModel = getFundamentalModel(context, opts?.fundamentalModelId);
  const entryModel = getEntryPointModel(context, opts?.entryModelId);
  const mockSignals = [
    { source: 'X' as const, signal: `${normalized} sentiment defaults to context fallback headlines.`, confidence: 0.5 },
    { source: 'Financial Times' as const, signal: `${normalized} sentiment defaults to context fallback headlines.`, confidence: 0.5 }
  ];

  return {
    symbol: normalized,
    currentPrice,
    targetConsensus: buildTargetConsensus(normalized, currentPrice),
    sentiment: context.sentimentEngine.build(normalized, mockSignals),
    fundamental: fundamentalModel.summarize(normalized, currentPrice),
    entryPlan: entryModel.plan(normalized, currentPrice),
    comparisons: {
      fundamentals: context.fundamentalModels.map((model) => model.summarize(normalized, currentPrice)),
      entries: context.entryPointModels.map((model) => model.plan(normalized, currentPrice))
    }
  };
};

export const buildTickerReportCached = (
  symbol: string,
  currentPrice = 0,
  opts?: BuildOptions
): TickerReport => {
  const context = getAnalysisContext(opts?.contextId);
  const normalized = symbol.toUpperCase();
  const now = opts?.now ?? Date.now();
  const fundamentalModel = getFundamentalModel(context, opts?.fundamentalModelId);
  const entryModel = getEntryPointModel(context, opts?.entryModelId);

  const targetConsensus = metadataStorage.getOrCompute(
    normalized,
    'target-consensus',
    () => buildTargetConsensus(normalized, currentPrice),
    now
  ).value;

  const sentiment = metadataStorage.getOrCompute(
    normalized,
    'sentiment',
    () => context.sentimentEngine.build(normalized, []),
    now
  ).value;

  const fundamental = metadataStorage.getOrCompute(
    normalized,
    `fundamental:${fundamentalModel.id}`,
    () => fundamentalModel.summarize(normalized, currentPrice),
    now
  ).value;

  const entryPlan = metadataStorage.getOrCompute(
    normalized,
    `entry:${entryModel.id}`,
    () => entryModel.plan(normalized, currentPrice),
    now
  ).value;

  return {
    symbol: normalized,
    currentPrice,
    targetConsensus,
    sentiment,
    fundamental,
    entryPlan,
    comparisons: {
      fundamentals: context.fundamentalModels.map((model) => model.summarize(normalized, currentPrice)),
      entries: context.entryPointModels.map((model) => model.plan(normalized, currentPrice))
    }
  };
};

export const buildTickerReportWithContext = async (
  symbol: string,
  opts?: BuildOptions,
  fetchImpl: typeof fetch = fetch
): Promise<{
  report: TickerReport;
  context: AnalysisContext;
  liveSources: { market: string[]; news: string[] };
  providerWarnings: string[];
}> => {
  const context = getAnalysisContext(opts?.contextId);
  const normalized = symbol.toUpperCase();
  const now = opts?.now ?? Date.now();
  const providerWarnings: string[] = [];

  let providerPrice: number | null = null;
  try {
    providerPrice = await context.tickerPriceProvider.fetchPrice(normalized, fetchImpl);
  } catch (error) {
    providerWarnings.push(`Price provider error: ${error instanceof Error ? error.message : 'unknown error'}`);
  }

  if (Number.isFinite(providerPrice)) {
    metadataStorage.upsert(normalized, 'current-price', providerPrice, now);
  } else {
    providerWarnings.push(`Price unavailable from ${context.tickerPriceProvider.id}.`);
  }

  const latestPrice = metadataStorage.getLatest<number>(normalized, 'current-price')?.value;
  const currentPrice = Number.isFinite(providerPrice)
    ? Number((providerPrice as number).toFixed(2))
    : Number((latestPrice ?? 0).toFixed(2));

  let newsSignals: Array<{ source: 'X' | 'Financial Times'; signal: string; confidence: number }> = [];
  try {
    newsSignals = await context.newsProvider.fetchSignals(normalized, fetchImpl);
  } catch (error) {
    providerWarnings.push(`News provider error: ${error instanceof Error ? error.message : 'unknown error'}`);
  }
  if (newsSignals.length === 0) {
    providerWarnings.push(`No signals returned from ${context.newsProvider.id}.`);
  }

  const report = buildTickerReportCached(normalized, currentPrice, { ...opts, contextId: context.id, now });

  if (newsSignals.length > 0 && metadataStorage.shouldRefresh(normalized, 'sentiment', now)) {
    const digest = context.sentimentEngine.build(normalized, newsSignals);
    metadataStorage.upsert(normalized, 'sentiment', digest, now);
    report.sentiment = digest;
  } else {
    report.sentiment =
      metadataStorage.getLatest<typeof report.sentiment>(normalized, 'sentiment')?.value ??
      context.sentimentEngine.build(normalized, newsSignals);
  }

  if (metadataStorage.shouldRefresh(normalized, 'target-consensus', now)) {
    const consensus = buildTargetConsensus(normalized, currentPrice);
    metadataStorage.upsert(normalized, 'target-consensus', consensus, now);
    report.targetConsensus = consensus;
  } else {
    report.targetConsensus =
      metadataStorage.getLatest<typeof report.targetConsensus>(normalized, 'target-consensus')?.value ??
      report.targetConsensus;
  }

  return {
    report,
    context,
    providerWarnings,
    liveSources: {
      market: Number.isFinite(providerPrice)
        ? [context.tickerPriceProvider.id]
        : latestPrice !== undefined
          ? ['cache:current-price']
          : ['unavailable:current-price'],
      news: newsSignals.length > 0 ? [context.newsProvider.id] : ['unavailable:news-signals']
    }
  };
};

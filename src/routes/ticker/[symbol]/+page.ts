/**
 * Ticker detail route loader.
 * Resolves engine selection, live data hydration, and cache/history payloads.
 */
import type { PageLoad } from './$types';
import {
  buildTickerReportLive,
  entryPointModels,
  fundamentalModels,
  metadataStorage
} from '$lib/analysis/registry';

const parseMs = (value: string | null) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

export const load: PageLoad = async ({ params, url, fetch }) => {
  const symbol = params.symbol.toUpperCase();
  const entryModelId = url.searchParams.get('entry');
  const fundamentalModelId = url.searchParams.get('fundamental');

  const refreshAllMs = parseMs(url.searchParams.get('refreshAllMs'));
  const refreshTargetMs = parseMs(url.searchParams.get('refreshTargetMs'));
  const refreshSentimentMs = parseMs(url.searchParams.get('refreshSentimentMs'));
  const refreshFundamentalMs = parseMs(url.searchParams.get('refreshFundamentalMs'));
  const refreshEntryMs = parseMs(url.searchParams.get('refreshEntryMs'));

  if (refreshAllMs) {
    metadataStorage.setGlobalRefreshInterval(refreshAllMs);
  }
  if (refreshTargetMs) {
    metadataStorage.setTickerRefreshInterval(symbol, 'target-consensus', refreshTargetMs);
  }
  if (refreshSentimentMs) {
    metadataStorage.setTickerRefreshInterval(symbol, 'sentiment', refreshSentimentMs);
  }

  const selectedFundamental =
    fundamentalModels.find((model) => model.id === fundamentalModelId) ?? fundamentalModels[0];
  const selectedEntry =
    entryPointModels.find((model) => model.id === entryModelId) ?? entryPointModels[0];

  if (refreshFundamentalMs) {
    metadataStorage.setTickerRefreshInterval(
      symbol,
      `fundamental:${selectedFundamental.id}`,
      refreshFundamentalMs
    );
  }
  if (refreshEntryMs) {
    metadataStorage.setTickerRefreshInterval(symbol, `entry:${selectedEntry.id}`, refreshEntryMs);
  }

  const { report, liveSources } = await buildTickerReportLive(
    symbol,
    {
      entryModelId,
      fundamentalModelId
    },
    fetch
  );

  return {
    symbol,
    entryModelId,
    fundamentalModelId,
    entryModels: entryPointModels.map((model) => ({ id: model.id, name: model.name })),
    fundamentalModels: fundamentalModels.map((model) => ({ id: model.id, name: model.name })),
    report,
    liveSources,
    cache: {
      globalRefreshMs: metadataStorage.getGlobalRefreshInterval(),
      targetHistory: metadataStorage.getHistory(symbol, 'target-consensus'),
      sentimentHistory: metadataStorage.getHistory(symbol, 'sentiment'),
      fundamentalHistory: metadataStorage.getHistory(symbol, `fundamental:${selectedFundamental.id}`),
      entryHistory: metadataStorage.getHistory(symbol, `entry:${selectedEntry.id}`)
    }
  };
};

import type { PageLoad } from './$types';
import { buildTickerReport, entryPointModels, fundamentalModels } from '$lib/analysis/registry';

export const load: PageLoad = ({ params, url }) => {
  const symbol = params.symbol.toUpperCase();
  const entryModelId = url.searchParams.get('entry');
  const fundamentalModelId = url.searchParams.get('fundamental');

  return {
    symbol,
    entryModelId,
    fundamentalModelId,
    entryModels: entryPointModels.map((model) => ({ id: model.id, name: model.name })),
    fundamentalModels: fundamentalModels.map((model) => ({ id: model.id, name: model.name })),
    report: buildTickerReport(symbol, undefined, { entryModelId, fundamentalModelId })
  };
};

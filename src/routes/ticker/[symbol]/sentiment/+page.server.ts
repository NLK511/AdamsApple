import type { PageServerLoad } from './$types';
import { getAnalysisContext } from '$lib/analysis/contexts';
import { explainSentimentSignals } from '$lib/analysis/sentiment/explain';

export const load: PageServerLoad = async ({ params, url, fetch }) => {
  const symbol = params.symbol.toUpperCase();
  const context = getAnalysisContext(url.searchParams.get('context'));

  const [newsSignals, socialSignals] = await Promise.all([
    context.newsProvider.fetchSignals(symbol, fetch),
    context.socialNetworkProvider.fetchSignals(symbol, fetch)
  ]);

  return {
    symbol,
    contextId: context.id,
    contextName: context.name,
    providers: {
      news: context.newsProvider.id,
      social: context.socialNetworkProvider.id
    },
    news: explainSentimentSignals('News', newsSignals),
    social: explainSentimentSignals('Social', socialSignals)
  };
};

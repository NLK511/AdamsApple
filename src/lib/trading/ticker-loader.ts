import type { PriceProviderResponse } from '../../model/providers/price-provider-response';
import type { NewsSignal } from '../analysis/contracts';
import { getAnalysisContext } from '../analysis/contexts';
import type { Ticker } from '../analysis/model/tickers/ticker';
import { uid } from './internal/uid';

export const getCurrentTickerPrice = async (
  symbol: string,
  contextId: string,
  fetchImpl: typeof fetch = fetch
): Promise<Ticker> => {
  console.log(`Getting current ticker price for ${symbol} in context ${contextId}`);
  const normalized = symbol.toUpperCase();
  const context = getAnalysisContext(contextId);
  const providerWarnings: string[] = [];

  let newsSignals: NewsSignal[] = [];
  let socialSignals: NewsSignal[] = [];
  try {
    newsSignals = await context.newsProvider.fetchSignals(normalized, fetchImpl);
    console.log(
      `Fetched ${newsSignals.length} news signals for ${normalized} from provider ${context.newsProvider.id}.`
    );
  } catch (error) {
    console.error(
      `News provider error for ${normalized} from provider ${context.newsProvider.id}:`,
      error instanceof Error ? error.message : error
    );
    providerWarnings.push(`News provider error: ${error instanceof Error ? error.message : 'unknown error'}`);
  }

  try {
    socialSignals = await context.socialNetworkProvider.fetchSignals(normalized, fetchImpl);
  } catch (error) {
    providerWarnings.push(`Social provider error: ${error instanceof Error ? error.message : 'unknown error'}`);
  }

  let providerResponse: PriceProviderResponse | null = null;
  try {
    providerResponse = (await context.tickerPriceProvider.fetchPrice(
      normalized,
      fetchImpl
    )) as PriceProviderResponse;
  } catch (error) {
    providerWarnings.push(`Price provider error: ${error instanceof Error ? error.message : 'unknown error'}`);
  }

  if (!Number.isFinite(providerResponse?.Price)) {
    console.error(`Price unavailable for ${normalized} from provider ${context.tickerPriceProvider.id}.`);
    providerWarnings.push(`Price unavailable from ${context.tickerPriceProvider.id}.`);
  }

  const currentPrice = providerResponse?.Price ?? 0;
  const currentPriceChange = providerResponse?.ChangePercentage ?? 0;
  const sentimentNewsScore = context.sentimentNewsEngine.score(newsSignals);
  const sentimentSocialScore = context.socialNetworkEngine.score(socialSignals);

  return {
    id: uid(),
    symbol: normalized,
    currentPrice,
    changes: currentPriceChange,
    alerts: [],
    providerWarnings,
    sentimentNewsScore,
    sentimentSocialScore
  };
};

export const refreshTickerFromContext = async (
  ticker: Ticker,
  contextId: string,
  fetchImpl: typeof fetch = fetch
): Promise<Ticker> => {
  const refreshed = await getCurrentTickerPrice(ticker.symbol, contextId, fetchImpl);

  return {
    ...refreshed,
    id: ticker.id,
    alerts: ticker.alerts
  };
};

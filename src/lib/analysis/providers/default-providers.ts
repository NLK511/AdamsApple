/**
 * Live provider adapters using SvelteKit proxy endpoints for external APIs.
 */
import type { PriceProviderResponse } from '../../../model/providers/price-provider-response';
import type { NewsProvider, NewsSignal, TickerPriceProvider } from '../contracts';


const quoteProxyUrl = '/api/providers/stockpricesdev/quote';

export const fetchPrice = async (
  symbol: string,
  fetchImpl: typeof fetch,
  quoteProxyUrlOverride = quoteProxyUrl
): Promise<PriceProviderResponse> => {
  const url = new URL(quoteProxyUrlOverride, 'http://local.proxy');
  url.searchParams.set('symbols', symbol.toUpperCase());

  console.log(`Fetching price for ${symbol} from proxy URL: ${url.pathname}${url.search}`);
  
  const response = await fetchImpl(`${url.pathname}${url.search}`);
  if (!response.ok) {
    throw new Error(`Price fetch failed: ${response.status} ${response.statusText}`);
  };

  const payload = await response.json();
  return payload;
};


export const tickerPriceProvider: TickerPriceProvider = {
  id: 'stockpricesdev-price',
  name: 'StockPrices.dev Quote Provider',
  async fetchPrice(symbol, fetchImpl) {
    return fetchPrice(symbol, fetchImpl);
  }
};
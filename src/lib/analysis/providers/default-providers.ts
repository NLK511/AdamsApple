/**
 * Live provider adapters using SvelteKit proxy endpoints for external APIs.
 */
import type { NewsProvider, NewsSignal, TickerPriceProvider } from '../contracts';


const quoteProxyUrl = '/api/providers/stockpricesdev/quote';

export const fetchPrice = async (
  symbol: string,
  fetchImpl: typeof fetch,
  quoteProxyUrlOverride = quoteProxyUrl
): Promise<number | null> => {
  const url = new URL(quoteProxyUrlOverride, 'http://local.proxy');
  url.searchParams.set('symbols', symbol.toUpperCase());

  console.log(`Fetching price for ${symbol} from proxy URL: ${url.pathname}${url.search}`);
  
  const response = await fetchImpl(`${url.pathname}${url.search}`);
  if (!response.ok) {
    console.error(`Price fetch failed for ${symbol}: ${response.status} ${response.statusText}`);
    return null;
  };

  const payload = await response.json();
  const price = payload?.Price;
  return Number.isFinite(price) && price > 0 ? Number(price) : null;
};


export const tickerPriceProvider: TickerPriceProvider = {
  id: 'stockpricesdev-price',
  name: 'StockPrices.dev Quote Provider',
  async fetchPrice(symbol, fetchImpl) {
    return fetchPrice(symbol, fetchImpl);
  }
};

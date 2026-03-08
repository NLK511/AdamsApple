import type { Watchlist } from './model/watchlists/watchlist';
import { DEFAULT_WATCHLIST_SYMBOLS } from './internal/constants';
import { uid } from './internal/uid';
import { getCurrentTickerPrice, refreshTickerFromContext } from './ticker-loader';

export const defaultWatchlists = async (
  contextId: string,
  fetchImpl: typeof fetch = fetch
): Promise<Watchlist[]> =>
  Promise.all(
    DEFAULT_WATCHLIST_SYMBOLS.map(async (item) => ({
      id: uid(),
      name: item.name,
      tickers: await Promise.all(
        item.symbols.map((symbol) => getCurrentTickerPrice(symbol, contextId, fetchImpl))
      )
    }))
  );

export const hydrateWatchlistsForContext = async (
  watchlists: Watchlist[],
  contextId: string,
  fetchImpl: typeof fetch = fetch
): Promise<Watchlist[]> =>
  Promise.all(
    watchlists.map(async (watchlist) => ({
      ...watchlist,
      tickers: await Promise.all(
        watchlist.tickers.map((ticker) => refreshTickerFromContext(ticker, contextId, fetchImpl))
      )
    }))
  );

export const addTicker = async (
  watchlist: Watchlist,
  symbol: string,
  contextId: string,
  fetchImpl: typeof fetch = fetch
): Promise<Watchlist> => ({
  ...watchlist,
  tickers: [...watchlist.tickers, await getCurrentTickerPrice(symbol, contextId, fetchImpl)]
});

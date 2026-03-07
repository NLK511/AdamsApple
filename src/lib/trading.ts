/**
 * Trading domain module for watchlists, alerts, and simulated market ticks.
 * Centralizes state shapes and pure update helpers used by dashboard UI.
 */
import type { PriceProviderResponse } from '../model/providers/price-provider-response';
import { getAnalysisContext } from './analysis/contexts';

const DEFAULT_WATCHLIST_SYMBOLS = [
  { name: 'Core Holdings', symbols: ['AAPL', 'MSFT', 'NVDA'] },
  { name: 'Growth Radar', symbols: ['TSLA', 'SHOP', 'AMD'] }
] as const;

export interface AlertRule {
  id: string;
  direction: 'above' | 'below';
  threshold: number;
  enabled: boolean;
  triggered: boolean;
}

export interface Ticker {
  id: string;
  symbol: string;
  currentPrice: number;
  changes: number;
  alerts: AlertRule[];
  providerWarnings: string[];
}

export interface Watchlist {
  id: string;
  name: string;
  tickers: Ticker[];
}

export interface PriceNotification {
  id: string;
  watchlistId: string;
  watchlistName: string;
  tickerId: string;
  tickerSymbol: string;
  alertId: string;
  direction: 'above' | 'below';
  threshold: number;
  currentPrice: number;
  message: string;
  createdAt: string;
  read: boolean;
}

interface TickResult {
  watchlists: Watchlist[];
  notifications: PriceNotification[];
}

const uid = () => Math.random().toString(36).slice(2, 10);

const getCurrentTickerPrice = async (
  symbol: string,
  contextId = 'default_mock',
  fetchImpl: typeof fetch = fetch
): Promise<Ticker> => {
  const normalized = symbol.toUpperCase();
  const context = getAnalysisContext(contextId);
  const providerWarnings: string[] = [];

  let providerResponse: PriceProviderResponse | null = null;
  try {
    providerResponse = await context.tickerPriceProvider.fetchPrice(normalized, fetchImpl) as PriceProviderResponse;
  } catch (error) {
    providerWarnings.push(`Price provider error: ${error instanceof Error ? error.message : 'unknown error'}`);
  }
  if (!Number.isFinite(providerResponse?.Price)) {
    console.error(`Price unavailable for ${normalized} from provider ${context.tickerPriceProvider.id}.`);
    providerWarnings.push(`Price unavailable from ${context.tickerPriceProvider.id}.`);
  }
  const currentPrice = providerResponse?.Price ?? 0;
  const currentPriceChange = providerResponse?.ChangePercentage ?? 0 

  return {
    id: uid(),
    symbol: normalized,
    currentPrice,
    changes: currentPriceChange,
    alerts: [],
    providerWarnings
  };
};


export const defaultWatchlists = async (
  contextId = 'default_mock',
  fetchImpl: typeof fetch = fetch
): Promise<Watchlist[]> =>
  Promise.all(
    DEFAULT_WATCHLIST_SYMBOLS.map(async (item) => ({
      id: uid(),
      name: item.name,
      tickers: await Promise.all(item.symbols.map((symbol) => getCurrentTickerPrice(symbol, contextId, fetchImpl)))
    }))
  );


const refreshTickerFromContext = async (
  ticker: Ticker,
  contextId = 'default_mock',
  fetchImpl: typeof fetch = fetch
): Promise<Ticker> => {
  const refreshed = await getCurrentTickerPrice(ticker.symbol, contextId, fetchImpl);
  return {
    ...refreshed,
    id: ticker.id,
    alerts: ticker.alerts
  };
};

export const hydrateWatchlistsForContext = async (
  watchlists: Watchlist[],
  contextId = 'default_mock',
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
  contextId = 'default_mock',
  fetchImpl: typeof fetch = fetch
): Promise<Watchlist> => ({
  ...watchlist,
  tickers: [...watchlist.tickers, await getCurrentTickerPrice(symbol, contextId, fetchImpl)]
});

export const addAlert = (
  ticker: Ticker,
  direction: 'above' | 'below',
  threshold: number
): Ticker => ({
  ...ticker,
  alerts: [
    ...ticker.alerts,
    {
      id: uid(),
      direction,
      threshold,
      enabled: true,
      triggered: false
    }
  ]
});

export const removeAlert = (ticker: Ticker, alertId: string): Ticker => ({
  ...ticker,
  alerts: ticker.alerts.filter((alert) => alert.id !== alertId)
});

export const toggleAlert = (ticker: Ticker, alertId: string): Ticker => ({
  ...ticker,
  alerts: ticker.alerts.map((alert) =>
    alert.id === alertId ? { ...alert, enabled: !alert.enabled, triggered: false } : alert
  )
});

const buildNotification = (
  watchlist: Watchlist,
  ticker: Ticker,
  alert: AlertRule,
  currentPrice: number,
  timestampMs: number
): PriceNotification => {
  const directionText = alert.direction === 'above' ? 'rose above' : 'fell below';
  return {
    id: uid(),
    watchlistId: watchlist.id,
    watchlistName: watchlist.name,
    tickerId: ticker.id,
    tickerSymbol: ticker.symbol,
    alertId: alert.id,
    direction: alert.direction,
    threshold: alert.threshold,
    currentPrice,
    message: `${ticker.symbol} ${directionText} ${alert.threshold.toFixed(2)} (now ${currentPrice.toFixed(2)})`,
    createdAt: new Date(timestampMs).toISOString(),
    read: false
  };
};

export const tickWatchlistsWithNotifications = (
  watchlists: Watchlist[],
  timestampMs = Date.now()
): TickResult => {
  const notifications: PriceNotification[] = [];

  const nextWatchlists = watchlists.map((watchlist) => ({
    ...watchlist,
    tickers: watchlist.tickers.map((ticker) => {

      const alerts = ticker.alerts.map((alert) => {
        if (!alert.enabled) return alert;
        const hit =
          alert.direction === 'above' ? ticker.currentPrice >= alert.threshold : ticker.currentPrice <= alert.threshold;

        if (hit && !alert.triggered) {
          notifications.push(buildNotification(watchlist, ticker, alert, ticker.currentPrice, timestampMs));
        }

        return { ...alert, triggered: hit };
      });

      return { ...ticker, currentPrice: ticker.currentPrice, changes: ticker.changes, alerts, providerWarnings: ticker.providerWarnings ?? [] };
    })
  }));

  return { watchlists: nextWatchlists, notifications };
};

export const tickWatchlists = (watchlists: Watchlist[]): Watchlist[] =>
  tickWatchlistsWithNotifications(watchlists).watchlists;

export const markAllNotificationsRead = (notifications: PriceNotification[]): PriceNotification[] =>
  notifications.map((notification) => ({ ...notification, read: true }));

export const markNotificationRead = (
  notifications: PriceNotification[],
  notificationId: string
): PriceNotification[] =>
  notifications.map((notification) =>
    notification.id === notificationId ? { ...notification, read: true } : notification
  );

export const unreadNotificationCount = (notifications: PriceNotification[]): number =>
  notifications.filter((notification) => !notification.read).length;

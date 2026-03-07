/**
 * Trading domain module for watchlists, alerts, and simulated market ticks.
 * Centralizes state shapes and pure update helpers used by dashboard UI.
 */
import type { PriceProviderResponse } from '../model/providers/price-provider-response';
import type { AlertDirection } from './analysis/model/alerts/alert-direction';
import type { AlertRule } from './analysis/model/alerts/alert-rule';
import type { PriceNotification } from './analysis/model/notifications/price-notification';
import type { TickResult } from './analysis/model/ticks/tick-result';
import type { Ticker } from './analysis/model/tickers/ticker';
import type { Watchlist } from './analysis/model/watchlists/watchlist';
import type { NewsSignal } from './analysis/contracts';
import { getAnalysisContext } from './analysis/contexts';

const DEFAULT_WATCHLIST_SYMBOLS = [
  { name: 'Core Holdings', symbols: ['AAPL', 'MSFT', 'NVDA'] },
  { name: 'Growth Radar', symbols: ['TSLA', 'SHOP', 'AMD'] }
] as const;

const uid = () => Math.random().toString(36).slice(2, 10);

const getCurrentTickerPrice = async (
  symbol: string,
  contextId:string,
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
    console.log(`Fetched ${newsSignals.length} news signals for ${normalized} from provider ${context.newsProvider.id}.`);
  } catch (error) {
    console.error(`News provider error for ${normalized} from provider ${context.newsProvider.id}:`, error instanceof Error ? error.message : error);
    providerWarnings.push(`News provider error: ${error instanceof Error ? error.message : 'unknown error'}`);
  }
  try {
    socialSignals = await context.socialNetworkProvider.fetchSignals(normalized, fetchImpl);
  } catch (error) {
    providerWarnings.push(`Social provider error: ${error instanceof Error ? error.message : 'unknown error'}`);
  }

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


export const defaultWatchlists = async (
  contextId: string,
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

export const addAlert = (
  ticker: Ticker,
  direction: AlertDirection,
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

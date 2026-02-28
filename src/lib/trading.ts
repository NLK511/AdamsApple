/**
 * Trading domain module for watchlists, alerts, and simulated market ticks.
 * Centralizes state shapes and pure update helpers used by dashboard UI.
 */
import { getAnalysisContext } from './analysis/contexts';

export type ChangeBucket = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

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
  changes: Record<ChangeBucket, number>;
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

const buckets: ChangeBucket[] = ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'];
const uid = () => Math.random().toString(36).slice(2, 10);

const scoreToChanges = (score: number): Record<ChangeBucket, number> => ({
  daily: Number((score * 0.9).toFixed(2)),
  weekly: Number((score * 1.7).toFixed(2)),
  monthly: Number((score * 3.1).toFixed(2)),
  quarterly: Number((score * 4.6).toFixed(2)),
  yearly: Number((score * 7.5).toFixed(2))
});

const buildTicker = async (
  symbol: string,
  contextId = 'default_mock',
  fetchImpl: typeof fetch = fetch
): Promise<Ticker> => {
  const normalized = symbol.toUpperCase();
  const context = getAnalysisContext(contextId);
  const providerWarnings: string[] = [];

  let providerPrice: number | null = null;
  try {
    providerPrice = await context.tickerPriceProvider.fetchPrice(normalized, fetchImpl);
  } catch (error) {
    providerWarnings.push(`Price provider error: ${error instanceof Error ? error.message : 'unknown error'}`);
  }
  if (!Number.isFinite(providerPrice)) {
    providerWarnings.push(`Price unavailable from ${context.tickerPriceProvider.id}.`);
  }
  const currentPrice = Number.isFinite(providerPrice)
    ? Number((providerPrice as number).toFixed(2))
    : 0;

  let signals = [] as Array<{ source: 'X' | 'Financial Times'; signal: string; confidence: number }>;
  try {
    signals = await context.newsProvider.fetchSignals(normalized, fetchImpl);
  } catch (error) {
    providerWarnings.push(`News provider error: ${error instanceof Error ? error.message : 'unknown error'}`);
  }
  if (signals.length === 0) {
    providerWarnings.push(`No signals returned from ${context.newsProvider.id}.`);
  }

  const sentiment = context.sentimentEngine.build(normalized, signals);
  const changes = signals.length > 0
    ? scoreToChanges(sentiment.score)
    : {
        daily: 0,
        weekly: 0,
        monthly: 0,
        quarterly: 0,
        yearly: 0
      };

  return {
    id: uid(),
    symbol: normalized,
    currentPrice,
    changes,
    alerts: [],
    providerWarnings
  };
};

const DEFAULT_WATCHLIST_SYMBOLS = [
  { name: 'Core Holdings', symbols: ['AAPL', 'MSFT', 'NVDA'] },
  { name: 'Growth Radar', symbols: ['TSLA', 'SHOP', 'AMD'] }
] as const;

export const defaultWatchlists = async (
  contextId = 'default_mock',
  fetchImpl: typeof fetch = fetch
): Promise<Watchlist[]> =>
  Promise.all(
    DEFAULT_WATCHLIST_SYMBOLS.map(async (item) => ({
      id: uid(),
      name: item.name,
      tickers: await Promise.all(item.symbols.map((symbol) => buildTicker(symbol, contextId, fetchImpl)))
    }))
  );

export const addTicker = async (
  watchlist: Watchlist,
  symbol: string,
  contextId = 'default_mock',
  fetchImpl: typeof fetch = fetch
): Promise<Watchlist> => ({
  ...watchlist,
  tickers: [...watchlist.tickers, await buildTicker(symbol, contextId, fetchImpl)]
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

const nextChange = (existing: number, volatility: number) => {
  const move = (Math.random() - 0.5) * volatility;
  return Number((existing * 0.92 + move).toFixed(2));
};

export const tickWatchlistsWithNotifications = (
  watchlists: Watchlist[],
  timestampMs = Date.now()
): TickResult => {
  const notifications: PriceNotification[] = [];

  const nextWatchlists = watchlists.map((watchlist) => ({
    ...watchlist,
    tickers: watchlist.tickers.map((ticker) => {
      const priceDelta = (Math.random() - 0.5) * Math.max(0.35, ticker.currentPrice * 0.0125);
      const currentPrice = Number(Math.max(0.2, ticker.currentPrice + priceDelta).toFixed(2));

      const changes = buckets.reduce<Record<ChangeBucket, number>>(
        (acc, bucket) => {
          const volatilityMap: Record<ChangeBucket, number> = {
            daily: 2,
            weekly: 4,
            monthly: 6,
            quarterly: 8,
            yearly: 12
          };
          acc[bucket] = nextChange(ticker.changes[bucket], volatilityMap[bucket]);
          return acc;
        },
        {
          daily: 0,
          weekly: 0,
          monthly: 0,
          quarterly: 0,
          yearly: 0
        }
      );

      const alerts = ticker.alerts.map((alert) => {
        if (!alert.enabled) return alert;
        const hit =
          alert.direction === 'above' ? currentPrice >= alert.threshold : currentPrice <= alert.threshold;

        if (hit && !alert.triggered) {
          notifications.push(buildNotification(watchlist, ticker, alert, currentPrice, timestampMs));
        }

        return { ...alert, triggered: hit };
      });

      return { ...ticker, currentPrice, changes, alerts, providerWarnings: ticker.providerWarnings ?? [] };
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

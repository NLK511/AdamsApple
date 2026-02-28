/**
 * Trading domain module for watchlists, alerts, and simulated market ticks.
 * Centralizes state shapes and pure update helpers used by dashboard UI.
 */
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

const seedTicker = (symbol: string): Ticker => {
  const base = 25 + Math.random() * 375;
  return {
    id: uid(),
    symbol: symbol.toUpperCase(),
    currentPrice: Number(base.toFixed(2)),
    changes: {
      daily: Number((Math.random() * 4 - 2).toFixed(2)),
      weekly: Number((Math.random() * 8 - 4).toFixed(2)),
      monthly: Number((Math.random() * 15 - 7.5).toFixed(2)),
      quarterly: Number((Math.random() * 30 - 15).toFixed(2)),
      yearly: Number((Math.random() * 65 - 20).toFixed(2))
    },
    alerts: []
  };
};

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

export const defaultWatchlists = (): Watchlist[] => [
  {
    id: uid(),
    name: 'Core Holdings',
    tickers: ['AAPL', 'MSFT', 'NVDA'].map(seedTicker)
  },
  {
    id: uid(),
    name: 'Growth Radar',
    tickers: ['TSLA', 'SHOP', 'AMD'].map(seedTicker)
  }
];

export const addTicker = (watchlist: Watchlist, symbol: string): Watchlist => ({
  ...watchlist,
  tickers: [...watchlist.tickers, seedTicker(symbol)]
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
        if (!alert.enabled) {
          return alert;
        }
        const hit =
          alert.direction === 'above' ? currentPrice >= alert.threshold : currentPrice <= alert.threshold;

        if (hit && !alert.triggered) {
          notifications.push(buildNotification(watchlist, ticker, alert, currentPrice, timestampMs));
        }

        return { ...alert, triggered: hit };
      });

      return { ...ticker, currentPrice, changes, alerts };
    })
  }));

  return {
    watchlists: nextWatchlists,
    notifications
  };
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

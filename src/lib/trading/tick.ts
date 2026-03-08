import type { PriceNotification } from '../analysis/model/notifications/price-notification';
import type { TickResult } from '../analysis/model/ticks/tick-result';
import type { Watchlist } from '../analysis/model/watchlists/watchlist';
import { createNotification } from './notifications';

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
          alert.direction === 'above'
            ? ticker.currentPrice >= alert.threshold
            : ticker.currentPrice <= alert.threshold;

        if (hit && !alert.triggered) {
          notifications.push(createNotification(watchlist, ticker, alert, ticker.currentPrice, timestampMs));
        }

        return { ...alert, triggered: hit };
      });

      return {
        ...ticker,
        currentPrice: ticker.currentPrice,
        changes: ticker.changes,
        alerts,
        providerWarnings: ticker.providerWarnings ?? []
      };
    })
  }));

  return { watchlists: nextWatchlists, notifications };
};

export const tickWatchlists = (watchlists: Watchlist[]): Watchlist[] =>
  tickWatchlistsWithNotifications(watchlists).watchlists;

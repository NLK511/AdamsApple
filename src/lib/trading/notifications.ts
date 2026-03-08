import type { AlertRule } from './model/alerts/alert-rule';
import type { PriceNotification } from './model/notifications/price-notification';
import type { Ticker } from './model/tickers/ticker';
import type { Watchlist } from './model/watchlists/watchlist';
import { uid } from './internal/uid';

export const createNotification = (
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

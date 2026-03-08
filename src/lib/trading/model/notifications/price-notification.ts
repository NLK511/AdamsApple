import type { AlertDirection } from '../alerts/alert-direction';

export interface PriceNotification {
  id: string;
  watchlistId: string;
  watchlistName: string;
  tickerId: string;
  tickerSymbol: string;
  alertId: string;
  direction: AlertDirection;
  threshold: number;
  currentPrice: number;
  message: string;
  createdAt: string;
  read: boolean;
}

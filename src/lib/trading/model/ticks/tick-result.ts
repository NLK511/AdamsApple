import type { PriceNotification } from '../notifications/price-notification';
import type { Watchlist } from '../watchlists/watchlist';

export interface TickResult {
  watchlists: Watchlist[];
  notifications: PriceNotification[];
}

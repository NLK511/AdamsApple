import type { Ticker } from '../tickers/ticker';

export interface Watchlist {
  id: string;
  name: string;
  tickers: Ticker[];
}

import type { AlertRule } from '../alerts/alert-rule';

export interface Ticker {
  id: string;
  symbol: string;
  currentPrice: number;
  changes: number;
  alerts: AlertRule[];
  providerWarnings: string[];
  sentimentNewsScore: number;
  sentimentSocialScore: number;
}

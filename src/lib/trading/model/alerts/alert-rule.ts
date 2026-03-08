import type { AlertDirection } from './alert-direction';

export interface AlertRule {
  id: string;
  direction: AlertDirection;
  threshold: number;
  enabled: boolean;
  triggered: boolean;
}

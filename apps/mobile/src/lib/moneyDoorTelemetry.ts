import { trackEvent } from '@/src/lib/analytics';
import {
  setMoneyDoorStatusReporter,
  type MoneyDoorStatusReporter,
} from '@/src/lib/apiConfig';

/** Event name for a money-door kill switch whose state cannot be seen. */
export const MONEY_DOOR_UNKNOWN_EVENT = 'money_door_unknown';

export const reportMoneyDoorUnknown: MoneyDoorStatusReporter = (
  door,
  status,
) => {
  trackEvent(MONEY_DOOR_UNKNOWN_EVENT, { door, reason: status.reason });
};

/** Call once at the composition root. */
export function installMoneyDoorTelemetry(): void {
  setMoneyDoorStatusReporter(reportMoneyDoorUnknown);
}

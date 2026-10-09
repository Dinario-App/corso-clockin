import { trackEvent } from '@/src/lib/analytics';
import {
  setFeeBpsStatusReporter,
  type FeeBpsStatusReporter,
} from '@/src/lib/apiConfig';

/** Event name for a platform fee that cannot be established. */
export const FEE_BPS_UNKNOWN_EVENT = 'fee_bps_unknown';

export const reportFeeBpsUnknown: FeeBpsStatusReporter = (status) => {
  trackEvent(FEE_BPS_UNKNOWN_EVENT, { reason: status.reason });
};

/** Call once at the composition root. */
export function installFeeTelemetry(): void {
  setFeeBpsStatusReporter(reportFeeBpsUnknown);
}

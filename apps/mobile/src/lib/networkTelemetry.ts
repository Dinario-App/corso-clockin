import { trackEvent } from '@/src/lib/analytics';
import {
  setNetworkStatusReporter,
  type NetworkStatusReporter,
} from '@/src/lib/apiConfig';

/** Event name for a cluster/RPC pair that cannot be established. */
export const NETWORK_UNKNOWN_EVENT = 'network_identity_unknown';

export const reportNetworkUnknown: NetworkStatusReporter = (status) => {
  trackEvent(NETWORK_UNKNOWN_EVENT, { reason: status.reason });
};

/** Call once at the composition root. */
export function installNetworkTelemetry(): void {
  setNetworkStatusReporter(reportNetworkUnknown);
}

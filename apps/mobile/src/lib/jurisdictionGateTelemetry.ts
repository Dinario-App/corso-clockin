import { trackEvent } from '@/src/lib/analytics';
import {
  setJurisdictionGateStatusReporter,
  type JurisdictionGateStatusReporter,
} from '@/src/lib/apiConfig';

/** Event name for a jurisdiction gate that is not operating. */
export const JURISDICTION_GATE_UNKNOWN_EVENT = 'jurisdiction_gate_unknown';

export const reportJurisdictionGateUnknown: JurisdictionGateStatusReporter = (
  status,
) => {
  trackEvent(JURISDICTION_GATE_UNKNOWN_EVENT, { reason: status.reason });
};

/** Call once at the composition root. */
export function installJurisdictionGateTelemetry(): void {
  setJurisdictionGateStatusReporter(reportJurisdictionGateUnknown);
}

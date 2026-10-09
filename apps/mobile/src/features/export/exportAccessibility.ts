import { EXPORT_CONSENT_COPY } from '@/src/features/export/exportConsent';

export function resolveExportConsentAccessibility(input: {
  confirmEnabled: boolean;
  busy: boolean;
}) {
  return {
    interstitial: {
      accessibilityRole: 'header' as const,
      accessibilityLabel: EXPORT_CONSENT_COPY.gate1.title,
    },
    confirm: {
      accessibilityRole: 'button' as const,
      accessibilityLabel: EXPORT_CONSENT_COPY.gate1.confirm,
      accessibilityHint: input.confirmEnabled
        ? undefined
        : EXPORT_CONSENT_COPY.gate1.scrollHint,
      accessibilityState: {
        disabled: !input.confirmEnabled || input.busy,
        busy: input.busy,
      },
    },
    cancel: {
      accessibilityRole: 'button' as const,
      accessibilityLabel: EXPORT_CONSENT_COPY.gate1.cancel,
    },
    error: {
      accessibilityRole: 'alert' as const,
      accessibilityLiveRegion: 'assertive' as const,
    },
    /** Gate 3 acknowledgement must be announced, not silently appear. */
    gate3: {
      accessibilityRole: 'alert' as const,
      accessibilityLiveRegion: 'assertive' as const,
      accessibilityLabel: EXPORT_CONSENT_COPY.gate3.body,
    },
  };
}

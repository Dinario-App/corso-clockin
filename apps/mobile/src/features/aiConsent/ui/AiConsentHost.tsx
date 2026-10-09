import { useCallback, useState, useSyncExternalStore } from 'react';
import { router, useFocusEffect } from 'expo-router';
import {
  currentConsentRequest,
  subscribeConsentRequests,
  type ConsentRequest,
  type ConsentResolution,
} from '@/src/features/aiConsent/consentRequests';
import { captureAiConsentOwner } from '@/src/features/aiConsent/aiConsentStore';
import { AiConsentSheet } from './AiConsentSheet';
import { settleConsentTap, type SettledConnectedConsentTap } from './consentTap';
import { resolveAiConsentSheetPresentation } from './aiConsentSheetPresentation';

export type AiConsentHostProps = {
  /**
   * Called once per request, after it has left the queue. Recording the
   * decision is the caller's (`consentRequests.ts`): the host records nothing.
   */
  onResolve?: (request: ConsentRequest, resolution: ConsentResolution) => void;
  onConnectedResolve?: (
    request: ConsentRequest,
    resolution: ConsentResolution,
    answeredBy: string | null,
    settledTap?: SettledConnectedConsentTap,
  ) => Promise<void>;
  testID?: string;
};

export function AiConsentHost({
  onResolve,
  onConnectedResolve,
  testID,
}: AiConsentHostProps) {
  const request = useSyncExternalStore(
    subscribeConsentRequests,
    currentConsentRequest,
    currentConsentRequest,
  );
  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  if (
    request === null ||
    !focused ||
    (request.kind === 'default_assistant' && onResolve === undefined) ||
    (request.kind === 'connected' && onConnectedResolve === undefined)
  ) {
    return null;
  }
  const shown = request;
  function settle(resolution: ConsentResolution) {
    settleConsentTap(shown, resolution, (settled, answer, connectedClaim) => {
      if (settled.kind === 'connected') {
        const answeredBy = captureAiConsentOwner()?.owner ?? null;
        void onConnectedResolve?.(
          settled,
          answer,
          answeredBy,
          connectedClaim,
        );
        return;
      }
      onResolve?.(settled, answer);
    });
  }
  return (
    <AiConsentSheet
      presentation={resolveAiConsentSheetPresentation(shown)}
      onAllow={() => settle('allowed')}
      onDecline={() => settle('declined')}
      onDismiss={() => settle('dismissed')}
      onOpenPrivacy={(href) => router.push(href)}
      testID={testID}
    />
  );
}

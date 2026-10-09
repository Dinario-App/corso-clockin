import { useCallback, useRef } from 'react';
import { isConnected, useEmbeddedSolanaWallet } from '@privy-io/expo';
import { createPrivySigner } from '@/src/features/security/privySigner';
import { createImportedSolanaSigner } from '@/src/features/security/importedSeedSolanaSigner';
import { importedMnemonicStore } from '@/src/features/session/importedMnemonicStore';
import { useCorsoSession } from '@/src/features/session/SessionContext';
import type { BuyAuthorizationSession } from '@/src/features/ramp/buyAuthorization';
import { trackBuyAuthEvent } from '@/src/features/ramp/rampAnalytics';
import {
  createRampSession,
  type RampSessionRequest,
} from '@/src/features/ramp/createRampSession';

function sameSession(
  left: BuyAuthorizationSession | null,
  right: BuyAuthorizationSession,
): boolean {
  return left?.type === right.type && left.address === right.address;
}

export function useBuyRampSession() {
  const { session, lockStateCell } = useCorsoSession();
  const embeddedWallet = useEmbeddedSolanaWallet();
  const liveSessionRef = useRef(session);
  liveSessionRef.current = session;

  return useCallback(
    async (body: RampSessionRequest) =>
      createRampSession(body, {
        currentSession: () => liveSessionRef.current,
        isLocked: () => lockStateCell.current,
        getSigner: async (expected) => {
          const live = liveSessionRef.current;
          if (!sameSession(live, expected) || !live || lockStateCell.current) {
            throw new Error('Buy wallet session changed.');
          }
          if (live.type === 'privy_embedded') {
            if (!isConnected(embeddedWallet)) {
              throw new Error('Embedded wallet is not ready.');
            }
            const wallet = embeddedWallet.wallets.find(
              (candidate) => candidate.address === live.address,
            );
            if (!wallet) throw new Error('Embedded wallet is not ready.');
            return createPrivySigner({ wallet, session: live });
          }
          if (live.type === 'imported_seed') {
            return createImportedSolanaSigner({
              store: importedMnemonicStore,
              session: live,
            });
          }
          throw new Error('Connected-wallet Buy is not available.');
        },
        onBuyAuthEvent: trackBuyAuthEvent,
      }),
    [embeddedWallet, lockStateCell],
  );
}

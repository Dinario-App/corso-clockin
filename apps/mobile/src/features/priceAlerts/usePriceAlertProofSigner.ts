import { useCallback } from 'react';
import { useActiveSigner } from '@/src/features/security/getActiveSigner';
import { useCorsoSession } from '@/src/features/session/SessionContext';
import { isValidPriceMint } from '../balances/priceSnapshot';
import { mwaRuntimeTransact } from '../connect/mwaRuntime';
import { MWA_IDENTITY } from '../connect/connectFlow';
import { createSecureStoreMwaSessionStore } from '../connect/mwaSessionStore';
import { signHeadsUpMwaProof } from '../skills/directory/headsUpMwaProof';
import { alertOwnershipMessage, type AlertScope } from './alertClient';
import { deviceOwnershipDigestMessage } from './pushClient';
import { normalizeThreshold } from './alertModel';
const store = createSecureStoreMwaSessionStore();

export function usePriceAlertProofSigner() {
  const { session, locked, liveSessionCell, lockStateCell, connectedStatus } =
    useCorsoSession();
  const { getActiveSigner } = useActiveSigner();
  const assertCurrent = useCallback(() => {
    if (
      !session ||
      liveSessionCell.current !== session ||
      lockStateCell.current
    )
      throw Error('alert_session_changed');
  }, [session, liveSessionCell, lockStateCell]);
  const signMessage = useCallback(
    async (message: Uint8Array) => {
      // Snapshot before awaits so a caller cannot change the approved purpose.
      const payload = Buffer.from(message);
      const lines = payload.toString('utf8').split('\n');
      const field = (index: number, prefix: string) =>
        lines[index]?.startsWith(prefix)
          ? lines[index]!.slice(prefix.length)
          : '';
      const device = lines[0] === 'Corso price alert device ownership v1';
      const action = field(2, 'Action: price-alert:');
      const create = action === 'create';
      const nonce = field(device ? 7 : create ? 8 : 5, 'Nonce: ');
      const expiresAt = field(device ? 8 : create ? 9 : 6, 'Expires: ');
      const assertChallenge = () => {
        assertCurrent();
        const expires = Date.parse(expiresAt);
        let canonical: string | null = null;
        if (session && isValidPriceMint(session.address, 'mainnet-beta')) {
          if (device) {
            const id = field(4, 'Registration: ');
            const digest = field(6, 'Device digest: ');
            if (
              /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
                id,
              ) &&
              /^[0-9a-f]{64}$/.test(digest)
            )
              canonical = deviceOwnershipDigestMessage(
                session.address,
                digest,
                nonce,
                expiresAt,
                id,
              );
          } else if (
            action === 'list' ||
            action === 'inbox' ||
            action === 'remove' ||
            action === 'create'
          ) {
            const scope: AlertScope = {
              walletAddress: session.address,
              action,
            };
            if (action === 'remove') {
              scope.alertId = field(3, 'Request: DELETE /v1/price-alerts/');
              if (!/^[A-Za-z0-9_-]{1,80}$/.test(scope.alertId))
                throw Error('alert_challenge_invalid');
            }
            if (create) {
              scope.mint = field(5, 'Mint: ');
              const direction = field(6, 'Direction: ');
              scope.thresholdPrice = field(7, 'Threshold USD: ');
              if (
                !isValidPriceMint(scope.mint, 'mainnet-beta') ||
                (direction !== 'above' && direction !== 'below') ||
                normalizeThreshold(scope.thresholdPrice) !==
                  scope.thresholdPrice
              )
                throw Error('alert_challenge_invalid');
              scope.direction = direction;
            }
            canonical = alertOwnershipMessage(scope, nonce, expiresAt);
          }
        }
        if (
          !/^[A-Za-z0-9_-]{43}$/.test(nonce) ||
          !Number.isFinite(expires) ||
          new Date(expires).toISOString() !== expiresAt ||
          expires <= Date.now() ||
          expires > Date.now() + (device ? 120000 : 130000) ||
          !canonical ||
          !payload.equals(Buffer.from(canonical))
        )
          throw Error('alert_challenge_invalid');
      };
      assertChallenge();
      if (!session) throw Error('alert_session_missing');
      if (session.type === 'connected_external') {
        if (connectedStatus !== 'ready')
          throw Error('alert_signer_unavailable');
        return signHeadsUpMwaProof({
          session,
          message: payload,
          assertCurrent: assertChallenge,
          transact: mwaRuntimeTransact,
          store,
          identity: MWA_IDENTITY,
        });
      }
      const signer = await getActiveSigner({
        session,
        notionalSol: null,
        surface: 'swap',
      });
      try {
        assertChallenge();
        const signature = await signer.signMessage(payload);
        assertChallenge();
        return signature;
      } finally {
        signer.clear?.();
      }
    },
    [session, assertCurrent, connectedStatus, getActiveSigner],
  );
  return { session, locked, assertCurrent, signMessage };
}

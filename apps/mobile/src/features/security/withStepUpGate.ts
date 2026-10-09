import type { CorsoSigner } from '@corso/wallet';
import type { Connection, VersionedTransaction } from '@solana/web3.js';
import type { CorsoSession } from '@/src/features/session/types';
import {
  assertMfaForHighValue,
  type StepUpSurface,
} from '@/src/features/security/mfaGateCore';
import type { StepUpPolicy } from '@/src/lib/apiConfig';

export type StepUpSignContext = {
  session: CorsoSession;
  notionalSol: number | null;
  surface: StepUpSurface;
  verifyPrivyMfa?: () => Promise<boolean>;
  policy?: StepUpPolicy;
  assertConfirmAuthorityLive?: () => void;
  /**
   * Optional async pre-raw-sign authority (USDC send). Runs after step-up
   * completes and before the final live root + session/lock assert + raw sign.
   * Used to re-fetch/compare consent terms that can drift during MFA awaits.
   * Omit on other money consumers — gate order is unchanged when absent.
   */
  assertPreRawSignAuthority?: () => Promise<void>;
};

export type StepUpAssertFn = typeof assertMfaForHighValue;

type ClearableCorsoSigner = CorsoSigner<VersionedTransaction, Connection> & {
  clear?: () => void;
};

export function withStepUpGate(
  signer: ClearableCorsoSigner,
  ctx: StepUpSignContext,
  assertFn: StepUpAssertFn = assertMfaForHighValue,
): ClearableCorsoSigner {
  const runGate = () =>
    assertFn({
      session: ctx.session,
      notionalSol: ctx.notionalSol,
      surface: ctx.surface,
      verifyPrivyMfa: ctx.verifyPrivyMfa,
      policy: ctx.policy,
    });
  const clear = signer.clear?.bind(signer);

  return {
    address: signer.address,
    type: signer.type,
    capabilities: signer.capabilities,
    async signTransaction(transaction) {
      await runGate();
      return signer.signTransaction(transaction);
    },
    async signMessage(message) {
      return signer.signMessage(message);
    },
    ...(clear ? { clear } : {}),
    ...(signer.signAndSendTransaction
      ? {
          async signAndSendTransaction(
            transaction: VersionedTransaction,
            connection: Connection,
          ) {
            await runGate();
            return signer.signAndSendTransaction!(transaction, connection);
          },
        }
      : {}),
  };
}

import { useCallback } from 'react';
import {
  useEmbeddedSolanaWallet,
  isConnected,
} from '@privy-io/expo';
import type { CorsoSigner } from '@corso/wallet';
import type { Connection, VersionedTransaction } from '@solana/web3.js';
import { createPrivySigner } from '@/src/features/security/privySigner';
import { createImportedSolanaSigner } from '@/src/features/security/importedSeedSolanaSigner';
import { assertMfaForHighValue } from '@/src/features/security/mfaGate';
import {
  gateMoneySigner,
  mintMoneySignerReadingLiveCell,
  requireMoneySignerGateCells,
  requireMoneySignerLiveForBroadcast,
  requireStepUpSignContext,
  type LiveSessionCell,
  type MoneySignerGateCells,
} from '@/src/features/security/requireMoneySignerGate';
import type { StepUpSignContext } from '@/src/features/security/withStepUpGate';
import { importedMnemonicStore } from '@/src/features/session/importedMnemonicStore';
import { useCorsoSession } from '@/src/features/session/SessionContext';
import type { LiveLockStateCell } from '@/src/features/session/sessionGate';
import { assertMwaMoneyPathAvailable } from '@/src/features/connect/assertMwaMoneyPathAvailable';
import { createMwaSigner } from '@/src/features/connect/mwaSigner';
import { type MwaSessionStore } from '@/src/features/connect/mwaSessionStore';
import {
  MwaError,
  type MwaChain,
  type MwaIdentity,
  type MwaTransact,
} from '@/src/features/connect/mwaTypes';

export type ActiveSigner = CorsoSigner<VersionedTransaction, Connection> & {
  clear?: () => void;
};

export type { StepUpSignContext };

export type MwaSignerPorts = {
  transact: MwaTransact;
  store: MwaSessionStore;
  identity: MwaIdentity;
  chain: MwaChain;
  assertAvailable: () => void;
};

function requireCompleteMwaPorts(mwaPorts: MwaSignerPorts | undefined): MwaSignerPorts {
  if (
    mwaPorts === undefined ||
    mwaPorts.transact === undefined ||
    mwaPorts.store === undefined ||
    mwaPorts.identity === undefined ||
    mwaPorts.chain === undefined ||
    mwaPorts.assertAvailable === undefined
  ) {
    throw new MwaError('platform_unsupported');
  }
  return mwaPorts;
}

export function useActiveSigner(mwaPorts?: MwaSignerPorts): {
  getActiveSigner: (stepUp: StepUpSignContext) => Promise<ActiveSigner>;
  /** Root-shared live session cell — same object SessionContext updates every render. */
  liveSessionCell: LiveSessionCell;
  liveLockCell: LiveLockStateCell;
  /** Opaque Session-owned capability — required at every value-moving submit. */
  moneySignerGateCells: MoneySignerGateCells;
} {
  const {
    session,
    lockStateCell,
    liveSessionCell,
    moneySignerGateCells,
    connectedStatus,
  } = useCorsoSession();
  const solanaWallet = useEmbeddedSolanaWallet();

  // Defense in depth: Session must have already written the live cell this render.
  liveSessionCell.current = session;

  const getActiveSigner = useCallback(
    async (stepUp: StepUpSignContext): Promise<ActiveSigner> => {
      // Validate required step-up context BEFORE any raw signer creation.
      // Incomplete / omitted context fails closed — never mint Privy or seed signer first.
      requireStepUpSignContext(stepUp);
      requireMoneySignerGateCells(moneySignerGateCells);
      // Frozen confirm authority before any acquisition work (swap races).
      stepUp.assertConfirmAuthorityLive?.();

      if (lockStateCell.current) {
        throw new Error('Unlock Corso to approve this transfer.');
      }

      const factorySession = session;
      if (!factorySession) {
        throw new Error('No wallet session.');
      }

      if (factorySession.type === 'connected_external') {
        assertMwaMoneyPathAvailable({
          sessionType: factorySession.type,
          capabilities: factorySession.capabilities,
          connectedStatus,
          readOnly: true,
        });
      }

      const raw = await mintMoneySignerReadingLiveCell({
        stepUp,
        factorySession,
        liveSessionCell,
        liveLockCell: lockStateCell,
        moneySignerGateCells,
        createRaw: async (): Promise<ActiveSigner> => {
          stepUp.assertConfirmAuthorityLive?.();
          if (factorySession.type === 'privy_embedded') {
            if (!isConnected(solanaWallet)) {
              throw new Error('Embedded wallet is not ready.');
            }
            const wallet = solanaWallet.wallets[0];
            if (!wallet?.address) {
              throw new Error('Embedded wallet is not ready.');
            }
            return createPrivySigner({ wallet, session: factorySession });
          }
          if (factorySession.type === 'imported_seed') {
            return createImportedSolanaSigner({
              store: importedMnemonicStore,
              session: factorySession,
            });
          }
          if (factorySession.type === 'connected_external') {
            assertMwaMoneyPathAvailable({
              sessionType: factorySession.type,
              capabilities: factorySession.capabilities,
              connectedStatus,
              readOnly: true,
            });
            const ports = requireCompleteMwaPorts(mwaPorts);
            ports.assertAvailable();
            return createMwaSigner({
              session: factorySession,
              transact: ports.transact,
              store: ports.store,
              identity: ports.identity,
              chain: ports.chain,
              liveAuthority: {
                assertLive: () => {
                  requireMoneySignerGateCells(moneySignerGateCells);
                  requireMoneySignerLiveForBroadcast({
                    stepUpSession: stepUp.session,
                    liveSessionCell,
                    liveLockCell: lockStateCell,
                    rawSigner: {
                      type: factorySession.type,
                      address: factorySession.address,
                    },
                  });
                  stepUp.assertConfirmAuthorityLive?.();
                },
              },
            });
          }
          throw new Error('Connect-wallet send is not available yet.');
        },
      });

      // Post-acquisition await — frozen authority must still hold before gating.
      stepUp.assertConfirmAuthorityLive?.();

      // Belt + suspenders: wrap money methods after context already validated.
      // Thread the opaque Session capability so post-mint A→B switches fail before
      // sign/broadcast (below-threshold, cached, and provider-pending paths).
      return gateMoneySigner(
        raw,
        stepUp,
        moneySignerGateCells,
        assertMfaForHighValue,
      ) as ActiveSigner;
    },
    [
      session,
      solanaWallet,
      lockStateCell,
      liveSessionCell,
      moneySignerGateCells,
      connectedStatus,
      mwaPorts,
    ],
  );

  return {
    getActiveSigner,
    liveSessionCell,
    liveLockCell: lockStateCell,
    moneySignerGateCells,
  };
}

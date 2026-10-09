import type { CorsoSigner } from '@corso/wallet';
import type { Connection, VersionedTransaction } from '@solana/web3.js';
import {
  assertMfaForHighValue,
  StepUpRequiredError,
} from '@/src/features/security/mfaGateCore';
import { sessionIdentityKey } from '@/src/features/security/mfaSessionGuard';
import {
  type StepUpAssertFn,
  type StepUpSignContext,
} from '@/src/features/security/withStepUpGate';
import type { LiveLockStateCell } from '@/src/features/session/sessionGate';
import {
  createLiveSessionCell,
  isActiveSessionMoneySignerGateRoot,
  requireMoneySignerGateCells,
  type LiveSessionCell,
  type MoneySignerGateCells,
} from '@/src/features/session/sessionMoneySignerRoot';

export type MoneySigner = CorsoSigner<VersionedTransaction, Connection>;
type ClearableMoneySigner = MoneySigner & { clear?: () => void };

export type { LiveSessionCell, MoneySignerGateCells };
export {
  createLiveSessionCell,
  isActiveSessionMoneySignerGateRoot,
  requireMoneySignerGateCells,
};

const UNAVAILABLE_MSG =
  "We can't run the security check right now, so this transaction is on hold. Try again in a moment.";

function throwUnavailable(): never {
  throw new StepUpRequiredError('unavailable', UNAVAILABLE_MSG);
}

function requireLiveUnlocked(liveLockCell: LiveLockStateCell): void {
  if (liveLockCell.current) throwUnavailable();
}

/**
 * Runtime assert: step-up context with session identity is mandatory.
 * Omitted / incomplete context → fail closed (no raw signer).
 */
export function requireStepUpSignContext(
  stepUp: StepUpSignContext | null | undefined,
): asserts stepUp is StepUpSignContext {
  if (!stepUp || !stepUp.session?.address || !stepUp.session?.type) {
    throwUnavailable();
  }
  if (stepUp.surface !== 'swap' && stepUp.surface !== 'send') {
    throwUnavailable();
  }
}

/**
 * prepareStepUp must re-check live identity after any await (e.g. refreshPolicy).
 * Stale prepare bound to A after render already shows B → fail closed.
 */
export function requirePrepareSessionStillLive(args: {
  prepareSession: { type: string; address: string } | null | undefined;
  liveSession: { type: string; address: string } | null | undefined;
}): void {
  const prepareKey = sessionIdentityKey(args.prepareSession);
  const liveKey = sessionIdentityKey(args.liveSession);
  if (!prepareKey || !liveKey || prepareKey !== liveKey) {
    throwUnavailable();
  }
}

export function requireIdenticalMoneySignerSessions(args: {
  stepUpSession: { type: string; address: string } | null | undefined;
  liveSession: { type: string; address: string } | null | undefined;
  factorySession: { type: string; address: string } | null | undefined;
}): void {
  const stepUpKey = sessionIdentityKey(args.stepUpSession);
  const liveKey = sessionIdentityKey(args.liveSession);
  const factoryKey = sessionIdentityKey(args.factorySession);
  if (
    !stepUpKey ||
    !liveKey ||
    !factoryKey ||
    stepUpKey !== liveKey ||
    stepUpKey !== factoryKey
  ) {
    throwUnavailable();
  }
}

/**
 * Testable mint path: identity triple-match first, then only then call createRaw.
 * Hostile spies prove createRaw is never invoked on mismatch.
 */
export function createRawMoneySignerIfSessionsMatch<T>(args: {
  stepUp: StepUpSignContext | null | undefined;
  liveSession: { type: string; address: string } | null | undefined;
  factorySession: { type: string; address: string } | null | undefined;
  createRaw: () => T;
}): T {
  requireStepUpSignContext(args.stepUp);
  requireIdenticalMoneySignerSessions({
    stepUpSession: args.stepUp.session,
    liveSession: args.liveSession,
    factorySession: args.factorySession,
  });
  return args.createRaw();
}

export async function mintMoneySignerReadingLiveCell<T>(args: {
  stepUp: StepUpSignContext | null | undefined;
  factorySession: { type: string; address: string } | null | undefined;
  liveSessionCell: LiveSessionCell;
  liveLockCell: LiveLockStateCell;
  moneySignerGateCells: MoneySignerGateCells;
  createRaw: () => T | Promise<T>;
}): Promise<T> {
  requireStepUpSignContext(args.stepUp);
  // Opaque root first — independent/forged cells never reach createRaw.
  requireMoneySignerGateCells(args.moneySignerGateCells);
  // Capability cells must be the exact live cells this mint will read.
  if (
    args.moneySignerGateCells.liveSessionCell !== args.liveSessionCell ||
    args.moneySignerGateCells.liveLockCell !== args.liveLockCell
  ) {
    throwUnavailable();
  }
  const liveSession = args.liveSessionCell.current;
  requireIdenticalMoneySignerSessions({
    stepUpSession: args.stepUp.session,
    liveSession,
    factorySession: args.factorySession,
  });
  requireLiveUnlocked(args.liveLockCell);
  // Frozen confirm authority (swap): check before materialization.
  args.stepUp.assertConfirmAuthorityLive?.();
  const minted = await args.createRaw();
  // After createRaw awaits — generation/request may have raced; re-check.
  requireLiveUnlocked(args.liveLockCell);
  requireIdenticalMoneySignerSessions({
    stepUpSession: args.stepUp.session,
    liveSession: args.liveSessionCell.current,
    factorySession: args.factorySession,
  });
  args.stepUp.assertConfirmAuthorityLive?.();
  return minted;
}

/**
 * Re-check identity for a already-minted raw signer:
 * stepUp.session == liveSessionCell.current == signer {type,address}.
 * Call immediately before and after async MFA/policy, and before sign/broadcast.
 */
export function requireMintedMoneySignerStillLive(args: {
  stepUpSession: { type: string; address: string } | null | undefined;
  liveSessionCell: LiveSessionCell;
  rawSigner: { type: string; address: string };
}): void {
  requireIdenticalMoneySignerSessions({
    stepUpSession: args.stepUpSession,
    liveSession: args.liveSessionCell.current,
    factorySession: {
      type: args.rawSigner.type,
      address: args.rawSigner.address,
    },
  });
}

/**
 * Re-check live lock + minted identity. Call after every async boundary
 * (MFA/policy, provider sign) and immediately before broadcast / API execute.
 */
export function requireMoneySignerLiveForBroadcast(args: {
  stepUpSession: { type: string; address: string } | null | undefined;
  liveSessionCell: LiveSessionCell;
  liveLockCell: LiveLockStateCell;
  rawSigner: { type: string; address: string };
}): void {
  requireLiveUnlocked(args.liveLockCell);
  requireMintedMoneySignerStillLive({
    stepUpSession: args.stepUpSession,
    liveSessionCell: args.liveSessionCell,
    rawSigner: args.rawSigner,
  });
}

/**
 * Wrap a raw CorsoSigner so money methods always cross assertMfaForHighValue
 * and re-bind to the live session + minted signer identity.
 * Missing context throws before any gated method can be called — callers never
 * receive an ungated money signer.
 *
 * Never delegates to atomic raw `signAndSendTransaction` (no pre-broadcast
 * hook). Always: gated sign → live re-check → guarded broadcast.
 */
export function gateMoneySigner(
  signer: ClearableMoneySigner,
  stepUp: StepUpSignContext | null | undefined,
  cells: MoneySignerGateCells,
  assertFn: StepUpAssertFn = assertMfaForHighValue,
): ClearableMoneySigner {
  requireStepUpSignContext(stepUp);
  // Opaque capability — forged/copied/stale/partial cells never wrap a signer.
  requireMoneySignerGateCells(cells);
  const { liveLockCell, liveSessionCell } = cells;
  const rawIdentity = { type: signer.type, address: signer.address };

  const assertLive = () => {
    // Sole active root first — deferred remint during step-up / freeze hook
    // must fail closed even when closed-over live cells still look unlocked.
    requireMoneySignerGateCells(cells);
    requireMoneySignerLiveForBroadcast({
      stepUpSession: stepUp.session,
      liveSessionCell,
      liveLockCell,
      rawSigner: rawIdentity,
    });
    // Frozen confirm authority (swap) — re-check at every gated money boundary.
    stepUp.assertConfirmAuthorityLive?.();
  };

  const runGateThen = async <T>(action: () => Promise<T>): Promise<T> => {
    // Pre-await: stale post-mint A signer under live B must fail here, including
    // below-threshold / cached paths that would otherwise skip MFA work.
    assertLive();
    await assertFn({
      session: stepUp.session,
      notionalSol: stepUp.notionalSol,
      surface: stepUp.surface,
      verifyPrivyMfa: stepUp.verifyPrivyMfa,
      policy: stepUp.policy,
    });
    // Optional post-step-up authority (e.g. USDC complete freeze re-check).
    // Consent terms can drift during the MFA await above; consumers that omit
    // this hook keep prior gate order unchanged.
    if (stepUp.assertPreRawSignAuthority) {
      await stepUp.assertPreRawSignAuthority();
    }
    // MFA/policy (and optional authority) work is async. Root, live session, or
    // lock may change while pending. Final synchronous checks, then raw sign
    // with no intervening await before the underlying signer call starts.
    assertLive();
    return action();
  };
  const clear = signer.clear?.bind(signer);

  if (!signer.capabilities.signTransaction) {
    throwUnavailable();
  }

  return {
    address: signer.address,
    type: signer.type,
    // Advertise signAndSend only as the guarded composite below — never raw atomic.
    capabilities: {
      ...signer.capabilities,
      signTransaction: true,
      signAndSendTransaction: true,
    },
    async signTransaction(transaction) {
      return runGateThen(async () => {
        const signed = await signer.signTransaction(transaction);
        // Provider sign is async — A→B while pending must fail closed before
        // the signed bytes leave this boundary (broadcast / API execute).
        assertLive();
        return signed;
      });
    },
    async signMessage(message) {
      return signer.signMessage(message);
    },
    ...(clear ? { clear } : {}),
    async signAndSendTransaction(
      transaction: VersionedTransaction,
      connection: Connection,
    ) {
      return runGateThen(async () => {
        // Guarded sign (never raw atomic signAndSend — no pre-broadcast hook).
        const signed = await signer.signTransaction(transaction);
        assertLive();
        const signature = await connection.sendRawTransaction(
          signed.serialize(),
          {
            skipPreflight: false,
            preflightCommitment: 'confirmed',
          },
        );
        return { signature };
      });
    },
  };
}

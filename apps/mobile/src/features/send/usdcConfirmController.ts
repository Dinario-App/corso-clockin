import { PublicKey, type Connection } from '@solana/web3.js';
import { usdcMintForCluster } from '@/src/features/balances/usdcConstants';
import {
  buildUsdcTransfer,
  SPL_TOKEN_ACCOUNT_SIZE,
  type BuiltUsdcTransfer,
} from '@/src/features/send/buildUsdcTransfer';
import { atomicToUsdcString } from '@/src/features/send/parseUsdcAmount';
import type { SubmitUsdcTransferConfirmation } from '@/src/features/send/submitUsdcTransfer';
import {
  freezeUsdcSendReviewFromBuilt,
  usdcSendReviewTermsMatch,
  type UsdcSendReviewFreeze,
} from '@/src/features/send/usdcSendIntent';
import { parseRecipientAddress } from '@/src/features/send/validateSend';
import {
  validateUsdcSendForm,
  type UsdcSendCluster,
} from '@/src/features/send/validateUsdcSend';

export type FetchLivePayerSolResult =
  | { ok: true; lamports: number; payer: string }
  | { ok: false; message: string };

/**
 * Live payer SOL from the same final connection used for the confirm rebuild.
 * Binds to the active session address; fails closed on RPC / malformed balance.
 */
export async function fetchLivePayerSolLamports(args: {
  connection: Connection;
  /** Address that must equal the active session (payer). */
  sessionAddress: string;
}): Promise<FetchLivePayerSolResult> {
  const sessionAddress =
    typeof args.sessionAddress === 'string' ? args.sessionAddress.trim() : '';
  if (!sessionAddress) {
    return { ok: false, message: 'Cannot send without a session address' };
  }

  let pubkey: PublicKey;
  try {
    pubkey = new PublicKey(sessionAddress);
  } catch {
    return { ok: false, message: 'Session address is not a valid public key' };
  }

  if (pubkey.toBase58() !== sessionAddress) {
    return { ok: false, message: 'Session address is not a valid public key' };
  }

  let lamports: number;
  try {
    lamports = await args.connection.getBalance(pubkey, 'confirmed');
  } catch {
    return {
      ok: false,
      message: "Couldn't confirm your SOL balance for network fees.",
    };
  }

  if (!Number.isSafeInteger(lamports) || lamports < 0) {
    return {
      ok: false,
      message: "Couldn't confirm your SOL balance for network fees.",
    };
  }

  return { ok: true, lamports, payer: sessionAddress };
}

export type ReconcileUsdcConfirmResult =
  | {
      status: 'ready';
      freeze: UsdcSendReviewFreeze;
      built: BuiltUsdcTransfer;
      liveSolLamports: number;
    }
  | {
      /** Cost/ATA/payer/cluster (or amount/mint/recipient) drifted — show updated review. */
      status: 'review_updated';
      freeze: UsdcSendReviewFreeze;
    }
  | {
      status: 'error';
      message: string;
      returnTo: 'compose' | 'review';
    };

/**
 * Rebuild + live SOL + full review-term compare before any sign/submit.
 * Drift returns `review_updated` so the UI requires another explicit Send tap.
 */
export async function reconcileUsdcConfirmForSubmit(args: {
  connection: Connection;
  reviewed: UsdcSendReviewFreeze;
  sessionAddress: string;
  cluster: UsdcSendCluster;
  usdcBalanceAtomic: bigint | null;
}): Promise<ReconcileUsdcConfirmResult> {
  const sessionAddress =
    typeof args.sessionAddress === 'string' ? args.sessionAddress.trim() : '';
  if (!sessionAddress) {
    return {
      status: 'error',
      message: 'Cannot send without a session address',
      returnTo: 'compose',
    };
  }

  const to = parseRecipientAddress(args.reviewed.recipient);
  if (!to) {
    return {
      status: 'error',
      message: 'Enter a valid Solana address.',
      returnTo: 'compose',
    };
  }

  const mint = usdcMintForCluster(args.cluster);
  if (mint !== args.reviewed.mint && args.cluster === args.reviewed.cluster) {
    return {
      status: 'error',
      message: 'USDC mint is not allowed for this network.',
      returnTo: 'compose',
    };
  }

  let built: BuiltUsdcTransfer;
  try {
    built = await buildUsdcTransfer({
      connection: args.connection,
      fromAddress: sessionAddress,
      recipient: to,
      amountAtomic: args.reviewed.amountAtomic,
      mint,
      cluster: args.cluster,
    });
  } catch (error) {
    return {
      status: 'error',
      message:
        error instanceof Error
          ? error.message
          : "Couldn't send. Try again.",
      returnTo: 'compose',
    };
  }

  let rent = 0;
  if (built.createdDestinationAta) {
    let rentExemption: number;
    try {
      rentExemption = await args.connection.getMinimumBalanceForRentExemption(
        SPL_TOKEN_ACCOUNT_SIZE,
      );
    } catch {
      return {
        status: 'error',
        message: "Couldn't confirm token account rent. Pull back and try again.",
        returnTo: 'compose',
      };
    }
    if (!Number.isSafeInteger(rentExemption) || rentExemption <= 0) {
      return {
        status: 'error',
        message: "Couldn't confirm token account rent. Pull back and try again.",
        returnTo: 'compose',
      };
    }
    rent = rentExemption;
  }

  const freeze = freezeUsdcSendReviewFromBuilt({
    built,
    ataRentLamports: rent,
    cluster: args.cluster,
    payer: sessionAddress,
  });
  if (!freeze.ok) {
    return {
      status: 'error',
      message: freeze.message,
      returnTo: 'compose',
    };
  }

  const nextFreeze: UsdcSendReviewFreeze = Object.freeze({
    amountAtomic: freeze.amountAtomic,
    feeLamports: freeze.feeLamports,
    ataRentLamports: freeze.ataRentLamports,
    needsDestinationAta: freeze.needsDestinationAta,
    mint: freeze.mint,
    cluster: freeze.cluster,
    recipient: freeze.recipient,
    solRequiredLamports: freeze.solRequiredLamports,
    payer: freeze.payer,
  });

  if (!usdcSendReviewTermsMatch(args.reviewed, nextFreeze)) {
    return { status: 'review_updated', freeze: nextFreeze };
  }

  // Live SOL from final connection — never trust a cached hook balance here.
  const liveSol = await fetchLivePayerSolLamports({
    connection: args.connection,
    sessionAddress,
  });
  if (!liveSol.ok) {
    return {
      status: 'error',
      message: liveSol.message,
      returnTo: 'review',
    };
  }
  if (liveSol.payer !== nextFreeze.payer || liveSol.payer !== sessionAddress) {
    return {
      status: 'error',
      message: "Couldn't confirm your SOL balance for network fees.",
      returnTo: 'review',
    };
  }

  const recheck = validateUsdcSendForm({
    recipient: nextFreeze.recipient,
    amount: atomicToUsdcString(nextFreeze.amountAtomic),
    usdcBalanceAtomic: args.usdcBalanceAtomic,
    solBalanceLamports: liveSol.lamports,
    feeLamports: nextFreeze.feeLamports,
    ataRentLamports: nextFreeze.ataRentLamports,
    needsDestinationAta: nextFreeze.needsDestinationAta,
    fromAddress: sessionAddress,
    mint: nextFreeze.mint,
    cluster: args.cluster,
  });
  if (!recheck.ok) {
    return {
      status: 'error',
      message: recheck.message,
      returnTo: 'compose',
    };
  }

  return {
    status: 'ready',
    freeze: nextFreeze,
    built,
    liveSolLamports: liveSol.lamports,
  };
}

/** Map a successful submit result to analytics — never `send_failed`. */
export function analyticsEventForUsdcSubmitResult(
  confirmation: SubmitUsdcTransferConfirmation,
): 'send_succeeded' | 'send_submitted' {
  return confirmation === 'confirmed' ? 'send_succeeded' : 'send_submitted';
}

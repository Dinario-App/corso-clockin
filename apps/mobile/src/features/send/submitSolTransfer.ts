import type { CorsoSigner } from '@corso/wallet';
import type { Connection, VersionedTransaction } from '@solana/web3.js';
import {
  SendTransactionError,
  SolanaJSONRPCError,
  SolanaJSONRPCErrorCode,
} from '@solana/web3.js';
import type { BuiltSolTransfer } from '@/src/features/send/buildSolTransfer';
import {
  assertMfaForHighValue,
  StepUpRequiredError,
} from '@/src/features/security/mfaGateCore';
import {
  gateMoneySigner,
  requireMoneySignerGateCells,
  requireMoneySignerLiveForBroadcast,
  type MoneySignerGateCells,
} from '@/src/features/security/requireMoneySignerGate';
import type { CorsoSession } from '@/src/features/session/types';
import { signatureOfSignedTransaction } from '@/src/features/swap/signedTxSignature';
import type { StepUpPolicy } from '@/src/lib/apiConfig';

export type SubmitSolTransferConfirmation = 'confirmed' | 'uncertain';

export type SubmitSolTransferResult = {
  signature: string;
  confirmation: SubmitSolTransferConfirmation;
};

/** On-chain execution failed after broadcast; signature retained for Activity. */
export class SolTransferExecutionFailedError extends Error {
  readonly signature: string;
  constructor(signature: string) {
    super("Couldn't send. Try again.");
    this.name = 'SolTransferExecutionFailedError';
    this.signature = signature;
  }
}

export function analyticsEventForSolSubmitResult(
  confirmation: SubmitSolTransferConfirmation,
): 'send_succeeded' | 'send_submitted' {
  return confirmation === 'confirmed' ? 'send_succeeded' : 'send_submitted';
}

function humanizeSendError(error: unknown): Error {
  if (error instanceof StepUpRequiredError) {
    return error;
  }
  if (error instanceof SolTransferExecutionFailedError) {
    return error;
  }
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (
      msg.includes('insufficient') ||
      msg.includes('no record of a prior credit') ||
      msg.includes('attempt to debit')
    ) {
      return new Error('Not enough SOL to cover network fees');
    }
    if (msg.includes('blockhash') || msg.includes('expired')) {
      return new Error('This transfer expired. Review again to retry.');
    }
    if (
      msg.includes('user rejected') ||
      msg.includes('cancelled') ||
      msg.includes('canceled') ||
      msg.includes('authentication')
    ) {
      return new Error('Send cancelled.');
    }
    return error;
  }
  return new Error("Couldn't send. Try again.");
}

const DETERMINISTIC_PREFLIGHT_RPC_CODES: ReadonlySet<number> = new Set([
  SolanaJSONRPCErrorCode.JSON_RPC_SERVER_ERROR_SEND_TRANSACTION_PREFLIGHT_FAILURE,
  SolanaJSONRPCErrorCode.JSON_RPC_SERVER_ERROR_TRANSACTION_SIGNATURE_VERIFICATION_FAILURE,
  SolanaJSONRPCErrorCode.JSON_RPC_SERVER_ERROR_TRANSACTION_PRECOMPILE_VERIFICATION_FAILURE,
]);

function isDeterministicPreflightRejection(error: unknown): boolean {
  if (error instanceof SolanaJSONRPCError) {
    return (
      typeof error.code === 'number' &&
      DETERMINISTIC_PREFLIGHT_RPC_CODES.has(error.code)
    );
  }
  if (error instanceof SendTransactionError) {
    return typeof error.transactionError?.message === 'string';
  }
  return false;
}

async function classifyAmbiguousSolBroadcast(args: {
  connection: Connection;
  localSignature: string;
}): Promise<SubmitSolTransferResult> {
  try {
    const status = await args.connection.getSignatureStatus(
      args.localSignature,
      { searchTransactionHistory: true },
    );
    const value = status?.value ?? null;
    if (value) {
      if (value.err != null) {
        throw new SolTransferExecutionFailedError(args.localSignature);
      }
      if (
        value.confirmationStatus === 'confirmed' ||
        value.confirmationStatus === 'finalized'
      ) {
        return {
          signature: args.localSignature,
          confirmation: 'confirmed',
        };
      }
    }
  } catch (error) {
    if (error instanceof SolTransferExecutionFailedError) {
      throw error;
    }
    // Status lookup is itself ambiguous; retain the local signature.
  }
  return {
    signature: args.localSignature,
    confirmation: 'uncertain',
  };
}

/**
 * Sign + broadcast a built SOL transfer via CorsoSigner.
 *
 * Always uses gated sign then guarded broadcast — never atomic raw
 * signAndSend and never the ungated withStepUpGate fallback.
 * Root live identity cells are mandatory at every async boundary.
 */
export async function submitSolTransfer(args: {
  signer: CorsoSigner<VersionedTransaction, Connection>;
  connection: Connection;
  built: BuiltSolTransfer;
  session: CorsoSession;
  /** Optional Privy MFA verify — required for privy_embedded above threshold. */
  verifyPrivyMfa?: () => Promise<boolean>;
  /** Optional resolved step-up policy (avoids config fetch when already prepared). */
  policy?: StepUpPolicy;
  /**
   * Mandatory root-shared live identity cells (same objects as useActiveSigner).
   * Omitted / partial cells fail closed before any sign or broadcast.
   */
  cells: MoneySignerGateCells;
}): Promise<SubmitSolTransferResult> {
  const { connection, built, session } = args;
  // Runtime reject even from JS/untyped callers that omit or partially pass cells.
  requireMoneySignerGateCells(args.cells);
  const cells = args.cells;

  const notionalSol = built.lamports / 1e9;
  const stepUp = {
    session,
    notionalSol,
    surface: 'send' as const,
    verifyPrivyMfa: args.verifyPrivyMfa,
    policy: args.policy,
  };

  const signer = gateMoneySigner(
    args.signer,
    stepUp,
    cells,
    assertMfaForHighValue,
  );

  try {
    if (!signer.capabilities.signTransaction) {
      throw new Error('This wallet cannot sign transfers yet.');
    }

    // Guarded sign — gateMoneySigner also re-checks after provider returns.
    const signed = await signer.signTransaction(built.transaction);
    const localSignature = signatureOfSignedTransaction(signed);

    // Immediate pre-broadcast live re-check (defense in depth).
    requireMoneySignerLiveForBroadcast({
      stepUpSession: session,
      liveSessionCell: cells.liveSessionCell,
      liveLockCell: cells.liveLockCell,
      rawSigner: { type: signer.type, address: signer.address },
    });

    let rpcSignature: string;
    try {
      rpcSignature = await connection.sendRawTransaction(signed.serialize(), {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      });
    } catch (error) {
      if (isDeterministicPreflightRejection(error)) {
        throw error;
      }
      return classifyAmbiguousSolBroadcast({ connection, localSignature });
    }

    if (rpcSignature !== localSignature) {
      return classifyAmbiguousSolBroadcast({ connection, localSignature });
    }

    try {
      const confirmation = await connection.confirmTransaction(
        {
          signature: localSignature,
          blockhash: built.blockhash,
          lastValidBlockHeight: built.lastValidBlockHeight,
        },
        'confirmed',
      );
      const executionErr = confirmation?.value?.err;
      if (executionErr != null) {
        throw new SolTransferExecutionFailedError(localSignature);
      }
      if (executionErr !== null) {
        return { signature: localSignature, confirmation: 'uncertain' };
      }
      return { signature: localSignature, confirmation: 'confirmed' };
    } catch (error) {
      if (error instanceof SolTransferExecutionFailedError) {
        throw error;
      }
      // Broadcast succeeded — confirmation pending/ambiguous is uncertain.
      return { signature: localSignature, confirmation: 'uncertain' };
    }
  } catch (error) {
    throw humanizeSendError(error);
  }
}

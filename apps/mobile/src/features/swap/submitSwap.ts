import type { CorsoSigner } from '@corso/wallet';
import type { Connection, VersionedTransaction } from '@solana/web3.js';
import { VersionedTransaction as VTx } from '@solana/web3.js';
import { Buffer } from 'buffer';
import {
  assertSafeToSign,
  messageBytesOf,
} from '@/src/features/security/assertSafeToSign';
import { assertSignedMatchesMessage } from '@/src/features/security/verifySignedTransaction';
import type { CorsoSession } from '@/src/features/session/types';
import {
  openSolanaConnectionOnKnownNetwork,
  SolanaNetworkUnknownError,
} from '@/src/features/send/solanaConnection';
import { copy } from '@/constants/copy';
import {
  resolveAddressLookupTables,
  toAccountKeysFromLookups,
} from '@/src/features/security/resolveLookupKeys';
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
import {
  assertSwapQuoteDigest,
  computeSwapQuoteDigest,
} from '@/src/features/swap/quoteDigest';
import {
  runSwapOnChainConfirm,
  type SwapConfirmOnChain,
} from '@/src/features/swap/runSwapOnChainConfirm';
import { assertOrderFeeIntegrity } from '@/src/features/swap/feeIntegrity';
import {
  executeSwapOrder,
  landSwapTransaction,
  SwapApiError,
  SwapLandUncertainError,
  type SwapOrderResponse,
} from '@/src/features/swap/swapApi';
import {
  assertApiSignatureMatchesLocalSigned,
  signatureOfSignedTransaction,
} from '@/src/features/swap/signedTxSignature';
import { SOL_MINT } from '@/src/features/swap/tokens';
import {
  createConnectionMintAccountFetcher,
  fetchAndCacheMintDecimalsBatch,
  getMintDecimalsCache,
  provableMintDecimals,
  swapOrderRequiresOutputMintDecimals,
  type MintAccountFetcher,
} from '@/src/features/tokens/mintDecimals';
import type { StatusConnection } from '@/src/features/swap/confirmSwapOnChain';
import type { StepUpPolicy } from '@/src/lib/apiConfig';
import type { PriceCluster } from '@/src/features/balances/priceSnapshot';
import type { ReviewedOutputTokenFactsSnapshot } from '@/src/features/tokenFacts/reviewedTokenFacts';

const DEFAULT_MAX_SLIPPAGE_BPS = 500;

const UNAVAILABLE_MSG =
  "We can't run the security check right now, so this transaction is on hold. Try again in a moment.";

export type { SwapConfirmOnChain as SubmitSwapConfirmOnChain };

function humanizeSwapError(error: unknown): Error {
  if (error instanceof StepUpRequiredError) {
    return error;
  }
  // Pass through untouched, with its signature intact. Rewriting this into any
  // "couldn't swap" phrasing would tell the user a failure Corso cannot prove.
  if (error instanceof SwapLandUncertainError) {
    return error;
  }
  if (error instanceof SolanaNetworkUnknownError) {
    return new Error(copy.swap.networkUnknown);
  }
  if (error instanceof SwapApiError) {
    if (error.code === 'swap_disabled') {
      return new Error('Swap is temporarily unavailable.');
    }
    if (error.code === 'swap_fee_dropped') {
      return new Error(
        'Corso fee could not be verified on this quote. Try again later.',
      );
    }
    if (error.code === 'swap_provider_unconfigured') {
      return new Error(
        'Swap quotes are not available on this API yet. Try again later.',
      );
    }
    if (
      error.code === 'swap_quote_digest_mismatch' ||
      error.code === 'swap_quote_unknown'
    ) {
      return new Error('This quote expired. Go back and review again.');
    }
    if (
      error.code === 'swap_confirm_timeout' ||
      error.code === 'swap_failed_on_chain' ||
      error.code === 'swap_confirm_invalid' ||
      error.code === 'swap_signature_mismatch' ||
      error.code === 'swap_quote_mismatch'
    ) {
      return new Error(error.message);
    }
    return error;
  }
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (
      msg.includes('insufficient') ||
      msg.includes('no record of a prior credit') ||
      msg.includes('attempt to debit')
    ) {
      return new Error('Not enough balance to cover this swap and network fees.');
    }
    if (
      msg.includes('expired') ||
      msg.includes('blockhash') ||
      msg.includes('requestid') ||
      msg.includes('quote changed') ||
      msg.includes('freshness')
    ) {
      return new Error('This quote expired. Go back and review again.');
    }
    if (
      msg.includes('user rejected') ||
      msg.includes('cancelled') ||
      msg.includes('canceled') ||
      msg.includes('authentication')
    ) {
      return new Error('Swap cancelled.');
    }
    if (
      msg.includes('not confirmed') ||
      msg.includes('on-chain') ||
      msg.includes('confirmation timed')
    ) {
      return new Error(
        'Swap was submitted but not confirmed on-chain yet. Check Activity before retrying.',
      );
    }
    return error;
  }
  return new Error("Couldn't swap. Try again.");
}

function serializePossiblyPartial(signed: VersionedTransaction): string {
  const serialize = signed.serialize.bind(signed) as (opts?: {
    requireAllSignatures?: boolean;
    verifySignatures?: boolean;
  }) => Uint8Array;
  const bytes = serialize({
    requireAllSignatures: false,
    verifySignatures: false,
  });
  return Buffer.from(bytes).toString('base64');
}

export async function submitSwap(args: {
  signer: CorsoSigner<VersionedTransaction, Connection>;
  order: SwapOrderResponse;
  session: CorsoSession;
  quoteDigest: string;
  /** Minimal immutable snapshot frozen with Review; never the TokenFacts API payload. */
  reviewedOutputTokenFacts?: ReviewedOutputTokenFactsSnapshot | null;
  reviewedInputTokenFacts?: ReviewedOutputTokenFactsSnapshot | null;
  /** Live cluster independently compared to the reviewed snapshot. */
  cluster?: PriceCluster;
  maxSlippageBps?: number;
  currentBlockHeight?: number | null;
  /** Optional Privy MFA verify — required for privy_embedded above threshold. */
  verifyPrivyMfa?: () => Promise<boolean>;
  /** Optional resolved step-up policy (avoids config fetch when already prepared). */
  policy?: StepUpPolicy;
  /**
   * Mandatory root-shared live identity — re-checked after sign and before API execute.
   * Omitted / partial cells fail closed with zero execute.
   */
  cells: MoneySignerGateCells;
  /**
   * Mandatory frozen confirm authority (swap). Rejected before any RPC/config/
   * signer/sign/execute work when omitted. Re-checked after every await.
   */
  assertConfirmAuthorityLive: () => void;
  connection?: Connection;
  openConnection?: () => Promise<Connection>;
  confirmOnChain?: SwapConfirmOnChain;
  mintAccountFetcher?: MintAccountFetcher;
  /** Presentation-owned analytics hook, called exactly at the first safety assertion. */
  onBeforeSafetyAssertion?: () => void;
}): Promise<{
  signature: string;
  quoteDigest: string;
  confirmationStatus: 'confirmed' | 'finalized';
}> {
  const { order, session, quoteDigest } = args;
  if (typeof args.assertConfirmAuthorityLive !== 'function') {
    throw new StepUpRequiredError('unavailable', UNAVAILABLE_MSG);
  }
  const assertConfirmAuthorityLive = () => {
    args.assertConfirmAuthorityLive();
  };
  assertConfirmAuthorityLive();
  requireMoneySignerGateCells(args.cells);
  const cells = args.cells;

  try {
    if (!args.signer.capabilities.signTransaction) {
      throw new Error(
        'This wallet cannot sign swaps yet. Connect sign-and-send fallback ships later.',
      );
    }

    assertOrderFeeIntegrity(order);

    assertSwapQuoteDigest(order, quoteDigest);
    if (order.quoteDigest !== quoteDigest) {
      throw new Error('Quote binding from API does not match. Get a fresh quote.');
    }

    // Pre-gate / pre-await: frozen authority must hold before any deferred work.
    assertConfirmAuthorityLive();

    const notionalSol = (() => {
      try {
        if (order.inputMint === SOL_MINT) {
          return Number(BigInt(order.inAmount)) / 1e9;
        }
        if (order.outputMint === SOL_MINT) {
          return Number(BigInt(order.outAmount)) / 1e9;
        }
        return null; // unknown → fail-closed step-up
      } catch {
        return null;
      }
    })();
    let currentBlockHeight = args.currentBlockHeight ?? null;
    const hasUsableExpire =
      order.expireAt != null &&
      order.expireAt !== '' &&
      (Number.isFinite(Number(order.expireAt)) ||
        Number.isFinite(Date.parse(order.expireAt)));

    const connection =
      args.connection ??
      (await (args.openConnection ?? openSolanaConnectionOnKnownNetwork)());
    // Post-RPC-open await boundary.
    assertConfirmAuthorityLive();
    if (!hasUsableExpire && currentBlockHeight == null) {
      currentBlockHeight = await connection.getBlockHeight('confirmed');
      // Post-block-height await boundary.
      assertConfirmAuthorityLive();
    }

    const transaction = VTx.deserialize(
      Buffer.from(order.transaction, 'base64'),
    );
    const tables = await resolveAddressLookupTables(transaction, connection);
    // Post-ALT-lookup await boundary — before mint-decimals fetch and sign materialization.
    assertConfirmAuthorityLive();
    const accountKeysFromLookups =
      tables.length > 0
        ? toAccountKeysFromLookups(transaction, tables)
        : undefined;
    const expectedMessageBytes = messageBytesOf(transaction);

    let outputMintDecimals: number | null = null;
    if (swapOrderRequiresOutputMintDecimals(order)) {
      const mintFetcher =
        args.mintAccountFetcher ??
        (typeof connection.getAccountInfo === 'function' ||
        typeof connection.getAccountInfoAndContext === 'function'
          ? createConnectionMintAccountFetcher(connection)
          : async () => null);
      const mintDecimalsCache = getMintDecimalsCache();
      const mintsToResolve = [...new Set([order.inputMint, order.outputMint])];
      try {
        await fetchAndCacheMintDecimalsBatch(
          mintsToResolve,
          mintFetcher,
          mintDecimalsCache,
        );
      } catch {
        // Transient RPC failure — leave cache unchanged so the next attempt can retry.
      }
      assertConfirmAuthorityLive();
      outputMintDecimals = provableMintDecimals(
        order.outputMint,
        mintDecimalsCache,
      );
    }

    const signContext = {
      purpose: 'swap' as const,
      expectedMessageBytes,
      expectedRequiredSignatures: 1,
      mmSignerAddress: null,
      expireAt: order.expireAt,
      lastValidBlockHeight: order.lastValidBlockHeight,
      currentBlockHeight,
      inputMint: order.inputMint,
      outputMint: order.outputMint,
      inAmount: order.inAmount,
      outAmount: order.outAmount,
      otherAmountThreshold: order.otherAmountThreshold,
      maxSlippageBps: args.maxSlippageBps ?? DEFAULT_MAX_SLIPPAGE_BPS,
      quoteSlippageBps: order.slippageBps,
      corsoFeeBps: order.corsoFeeBps,
      quoteFeeBps: order.quoteFeeBps,
      platformFeeBps: order.platformFeeBps,
      positiveSlippageBps: order.positiveSlippageBps,
      feeMint: order.feeMint,
      feeDestination: order.feeDestination,
      platformFeeAmount: order.platformFeeAmount,
      outputMintDecimals,
      reviewedOutputTokenFacts: args.reviewedOutputTokenFacts,
      reviewedInputTokenFacts: args.reviewedInputTokenFacts,
      quoteDigest,
      cluster: args.cluster,
      // Binding requirement 1 — the gate refuses a v1 route unless this is V1.
      instructionVersion: order.instructionVersion,
      accountKeysFromLookups,
    };

    try {
      args.onBeforeSafetyAssertion?.();
    } catch {
      // Analytics is observational and must never block a safety assertion.
    }
    assertSafeToSign(transaction, session, signContext);

    const signer = gateMoneySigner(
      args.signer,
      {
        session,
        notionalSol,
        surface: 'swap',
        verifyPrivyMfa: args.verifyPrivyMfa,
        policy: args.policy,
        assertConfirmAuthorityLive: args.assertConfirmAuthorityLive,
        // Step-up can await while facts age or change. Re-run the complete tx +
        // reviewed-facts gate after it and before the underlying raw signer.
        assertPreRawSignAuthority: async () => {
          assertConfirmAuthorityLive();
          assertSafeToSign(transaction, session, signContext);
        },
      },
      cells,
      assertMfaForHighValue,
    );

    assertConfirmAuthorityLive();
    const signed = await signer.signTransaction(transaction);
    assertConfirmAuthorityLive();
    assertSignedMatchesMessage({
      signed,
      expectedMessageBytes,
      sessionAddress: session.address,
    });

    // Immediate pre-API-execute live re-check (A→B while provider sign pending
    // or between sign and execute must yield zero execute).
    requireMoneySignerLiveForBroadcast({
      stepUpSession: session,
      liveSessionCell: cells.liveSessionCell,
      liveLockCell: cells.liveLockCell,
      rawSigner: { type: args.signer.type, address: args.signer.address },
    });
    assertConfirmAuthorityLive();

    const signedTransaction = serializePossiblyPartial(signed);
    const digest = computeSwapQuoteDigest(order);
    // Retain locally signed signature before any provider round-trip.
    const localSignature = signatureOfSignedTransaction(signed);

    // ---- Metis landing path -------------------------------------------
    // Metis has no `/execute`: Corso lands the transaction itself through
    // `POST /v1/swap/land`. Selected by the quote's pinned `instructionVersion`
    // — the same API-set, digest-bound field the signing gate keys on — so the
    // Meta `/order` + `/execute` path below is untouched.
    if (order.instructionVersion === 'V1' || order.instructionVersion === 'V2') {
      const landed = await landSwapTransaction({
        requestId: order.requestId,
        signedTransaction,
        quoteDigest: digest,
      });
      assertConfirmAuthorityLive();

      // #7 finality binding, unchanged in spirit: the signature the API reports
      // must be the one this device signed, before it is shown as success.
      const boundLandedSignature = assertApiSignatureMatchesLocalSigned({
        localSignature,
        apiSignature: landed.signature,
      });

      // No second client-side confirmation here. The API's `landed` IS an
      // on-chain `getSignatureStatuses` read, so re-polling could only add a
      // failure mode — a device on flaky wifi turning a proven-landed swap into
      // a false "failed", which is the exact outcome this slice exists to
      // prevent. Anything the API could not prove arrived as
      // SwapLandUncertainError above.
      return {
        signature: boundLandedSignature,
        quoteDigest: digest,
        confirmationStatus: landed.confirmationStatus,
      };
    }

    const result = await executeSwapOrder({
      requestId: order.requestId,
      signedTransaction,
      lastValidBlockHeight: order.lastValidBlockHeight,
      quoteDigest: digest,
    });

    // Finality binding: API signature must equal locally signed tx signature
    // before any on-chain poll (blocks unrelated confirmed-sig false success).
    const boundSignature = assertApiSignatureMatchesLocalSigned({
      localSignature,
      apiSignature: result.signature,
    });

    const confirmationStatus = await runSwapOnChainConfirm({
      connection: connection as unknown as StatusConnection,
      signature: boundSignature,
      lastValidBlockHeight: order.lastValidBlockHeight,
      confirmOnChain: args.confirmOnChain,
    });

    return {
      signature: boundSignature,
      quoteDigest: digest,
      confirmationStatus,
    };
  } catch (error) {
    throw humanizeSwapError(error);
  }
}

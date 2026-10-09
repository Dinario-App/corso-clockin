import {
  SystemProgram,
  VersionedTransaction,
  type AccountKeysFromLookups,
  type MessageAccountKeys,
} from '@solana/web3.js';
import { isReviewedToken2022Allowed, isStablecoinToStablecoinSwap } from '@corso/swap-config';
import {
  associatedTokenAddress,
  userAtasForMint,
} from '@/src/features/security/ataAddress';
import {
  decodeJupiterRouteMinOut,
  JUPITER_V6_PROGRAM_ID,
} from '@/src/features/security/decodeJupiterRouteMinOut';
import {
  isReviewedCorsoFeeBps,
  corsoFeeAmount,
  corsoFeeAta,
  corsoFeeAuthority,
} from '@/src/features/security/corsoFeeAccount';
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  SWAP_ROUTER_ALLOWLIST,
  SWAP_SUPPORT_PROGRAM_ALLOWLIST,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from '@/src/features/security/swapProgramAllowlist';
import { SOL_MINT } from '@/src/features/swap/tokens';
import {
  provableMintDecimals,
  swapOrderDeclaresCorsoFee,
} from '@/src/features/tokens/mintDecimals';
import type { PriceCluster } from '@/src/features/balances/priceSnapshot';
import {
  isReviewedOutputTokenFactsFresh,
  isReviewedOutputTokenFactsSnapshot,
  type ReviewedOutputTokenFactsSnapshot,
} from '@/src/features/tokenFacts/reviewedTokenFacts';

const SYSTEM_TRANSFER = 2;
/** SPL Token Transfer (unchecked — no mint in ix) */
const TOKEN_TRANSFER = 3;
/** SPL Token / Token-2022 TransferChecked */
const TOKEN_TRANSFER_CHECKED = 12;
/** SPL Token CloseAccount (validated only for the session WSOL ATA). */
const TOKEN_CLOSE_ACCOUNT = 9;
/** SyncNative */
const TOKEN_SYNC_NATIVE = 17;
/** Exact rent-exempt minimum for a basic SPL token account (lamports). */
const TOKEN_ACCOUNT_RENT_LAMPORTS = 2_039_280n;
const JUPITER_EVENT_AUTHORITY =
  'D8cy77BBepLMngZx6ZukaTff5hCt1HrWyKk3Hnd9oitf';

export type SwapSemanticsContext = {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  otherAmountThreshold: string;
  sessionAddress: string;
  /** Review/API slippage contract. Required before route_v2 can authorize. */
  quoteSlippageBps?: number | null;
  maxSlippageBps?: number | null;
  /** Review/API fee contract. Route_v2 currently accepts only the proven zero shape. */
  corsoFeeBps?: number | null;
  quoteFeeBps?: number | null;
  platformFeeBps?: number | null;
  positiveSlippageBps?: number | null;
  feeMint?: string | null;
  feeDestination?: string | null;
  /**
   * Reviewed Corso fee amount, in output-mint atomic units.
   * Already bound by quoteDigest — reused here, not invented.
   */
  platformFeeAmount?: string | null;
  /**
   * Output mint decimals for the `TransferChecked` decimals byte (requirement 9).
   * Omitted → resolved offline from the known-mint table; unknown → fail closed.
   */
  outputMintDecimals?: number | null;
  /**
   * TokenFacts snapshot the caller froze for Review. Token-2022 stays closed
   * until the review/confirm path supplies this exact snapshot.
   */
  reviewedOutputTokenFacts?: ReviewedOutputTokenFactsSnapshot | null;
  reviewedInputTokenFacts?: ReviewedOutputTokenFactsSnapshot | null;
  quoteDigest?: string;
  cluster?: PriceCluster;
  /**
   * Binding requirement 1 — the `instructionVersion` value ECHOED by the
   * Jupiter quote. Corso sends `V1` explicitly on every quote and swap request;
   * a v1 route instruction may only be authorized when the provider echoed
   * exactly `V1`. Absent (`null`) and `V2` both refuse.
   *
   * The 15/15 v1-instruction result in the finding was obtained on the UNSET
   * default. A default is not a contract: if Jupiter flips it, Corso silently
   * moves to the `*_v2` shape where `platform_fee_account` does not exist at
   * any named position and the fee becomes unprovable, with no error and no
   * signal — exactly how `integratorFeeBps` failed.
   */
  instructionVersion?: string | null;
  /** Required when the tx uses address table lookups (Jupiter Meta/Ultra). */
  accountKeysFromLookups?: AccountKeysFromLookups;
};

/** Pinned `instructionVersion` for the Metis production route. Case-sensitive. */
const REQUIRED_INSTRUCTION_VERSION = 'V1';

/**
 * IDL-named account indexes for the v1 route entrypoints.
 * Source: jup-ag/rfq-v2-sdk `fill-decoder/idls/aggregator.json`, commit
 * f3f30ff2af48f63c11f326a486b8b0eb9611714f (file sha256
 * 30bc8470bb67fdac80e0a368aaff29fcb34476d453cf14bd9861fb968a2d4925).
 *
 * Anchor renders an ABSENT optional account as the program id with positions
 * preserved, so `platform_fee_account` being `optional: true` does not make its
 * index float — it is 6 on `route` and 9 on `shared_accounts_route` whether the
 * fee is present or not. The gate already relies on this convention for
 * `route_v2`'s `destination_token_account`.
 */
const JUPITER_V1_ACCOUNT_LAYOUT = {
  route: {
    minimumAccounts: 9,
    tokenProgram: 0,
    authority: 1,
    source: 2,
    destination: 3,
    absentOptionalDestination: 4,
    sourceMint: null,
    destinationMint: 5,
    platformFeeAccount: 6,
    eventAuthority: 7,
    program: 8,
    token2022Program: null,
  },
  sharedAccountsRoute: {
    minimumAccounts: 13,
    tokenProgram: 0,
    // 1 program_authority, 4 program_source_token_account and
    // 5 program_destination_token_account are Jupiter's own accounts. They are
    // not bindable to session state, so they are deliberately NOT asserted
    // rather than bound to something they do not mean.
    authority: 2,
    source: 3,
    destination: 6,
    absentOptionalDestination: null,
    sourceMint: 7,
    destinationMint: 8,
    platformFeeAccount: 9,
    eventAuthority: 11,
    program: 12,
    token2022Program: 10,
  },
} as const;

function readU32LE(data: Uint8Array, offset: number): number {
  return (
    data[offset]! |
    (data[offset + 1]! << 8) |
    (data[offset + 2]! << 16) |
    (data[offset + 3]! << 24)
  ) >>> 0;
}

function readU64LE(data: Uint8Array, offset: number): bigint {
  const view = new DataView(data.buffer, data.byteOffset + offset, 8);
  return view.getBigUint64(0, true);
}

function asBigInt(raw: string, label: string): bigint {
  try {
    return BigInt(raw);
  } catch {
    throw new Error(`Invalid ${label} on quote`);
  }
}

function assertReviewedToken2022OutputSemantics(args: {
  context: SwapSemanticsContext;
  input?: boolean;
}): void {
  const facts = args.input ? args.context.reviewedInputTokenFacts : args.context.reviewedOutputTokenFacts;
  const nowMs = Date.now();
  if (
    !isReviewedOutputTokenFactsSnapshot(facts) ||
    facts.mint !== (args.input ? args.context.inputMint : args.context.outputMint) ||
    facts.quoteDigest !== args.context.quoteDigest ||
    facts.cluster !== args.context.cluster ||
    facts.chainStatus !== 'ok' ||
    facts.tokenProgram !== 'token-2022'
  ) {
    throw new Error(
      'Token-2022 output semantics were not proven by reviewed TokenFacts. Refusing to sign.',
    );
  }
  if (
    !isReviewedOutputTokenFactsFresh(facts, nowMs)
  ) {
    throw new Error(
      'Token-2022 output semantics were not proven by fresh reviewed TokenFacts. Refusing to sign.',
    );
  }

  if (facts.transferHookConfigured !== false) {
    if (facts.transferHookConfigured === true) {
      throw new Error(
        'Token-2022 transfer-hook behavior is not bounded by the reviewed route. This is a Corso capability limit.',
      );
    }
    throw new Error(
      'Token-2022 output semantics were not proven by reviewed TokenFacts. Refusing to sign.',
    );
  }

  if (facts.transferFeeConfigured !== false) {
    if (facts.transferFeeConfigured === true) {
      throw new Error(
        'Token-2022 transfer-fee math is not available in the current TokenFacts contract, so the reviewed received amount cannot be proven. This is a Corso capability limit.',
      );
    }
    throw new Error(
      'Token-2022 output semantics were not proven by reviewed TokenFacts. Refusing to sign.',
    );
  }

  if (!isReviewedToken2022Allowed({
    ...facts, transferHook: facts.transferHookConfigured, transferFee: facts.transferFeeConfigured,
  })) {
    throw new Error('Token-2022 extensions are not within the reviewed allow-list. Refusing to sign.');
  }
}

export function assertSwapTransactionSemantics(
  transaction: VersionedTransaction,
  context: SwapSemanticsContext,
): void {
  const inAmount = asBigInt(context.inAmount, 'inAmount');
  const minOut = asBigInt(
    context.otherAmountThreshold,
    'otherAmountThreshold',
  );
  if (minOut <= 0n) {
    throw new Error('Quote minimum output is missing. Get a fresh quote.');
  }

  const owner = context.sessionAddress;
  const wsolAtas = userAtasForMint({ mint: SOL_MINT, owner });
  const inputAtas = userAtasForMint({ mint: context.inputMint, owner });
  const outputAtas = userAtasForMint({ mint: context.outputMint, owner });
  const approvedRentRecipients = new Set([
    ...wsolAtas,
    ...inputAtas,
    ...outputAtas,
  ]);

  const reviewedCorsoFeeBps = context.corsoFeeBps ?? 0;
  const reviewedQuoteFeeBps = context.quoteFeeBps ?? 0;
  // Only the OUTER-fee shape obliges an outer transfer: Jupiter carries no fee
  // (platformFeeBps === 0) yet the quote charges the user. A quote that still
  // declares a Jupiter-INTERNAL fee (platformFeeBps !== 0) is not an outer-fee
  // quote at all and keeps falling through to the unchanged refusals below.
  const declaresCorsoFee = swapOrderDeclaresCorsoFee(context);
  let corsoFeeTransferCount = 0;
  let corsoFeeDebit = 0n;

  let accountKeys: MessageAccountKeys;
  try {
    accountKeys = transaction.message.getAccountKeys({
      accountKeysFromLookups: context.accountKeysFromLookups,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.toLowerCase().includes('address table')) {
      throw new Error(
        'Swap quote uses address tables that were not resolved. Get a fresh quote.',
      );
    }
    throw error;
  }
  let sawRouter = false;
  let routerInstructionCount = 0;
  let sawBoundRouteV2Proof = false;
  let sawBoundV1FeeProof = false;
  let sawBoundV2FeeProof = false;
  let boundInputTokenProgram: string | null = null;
  const solBuyFee = context.instructionVersion === 'V2' && context.inputMint === SOL_MINT && context.platformFeeBps === 0 && isReviewedCorsoFeeBps(reviewedCorsoFeeBps);
  let sawSyncNativeOnWsol = false;
  let wrapLamportsToWsol = 0n;
  const rentRecipients = new Set<string>();
  let inputDebits = 0n;
  let outputCredits = 0n;
  let sawOutputTransferChecked = false;
  let sawToken2022OutputActivity = false;
  let routeImpliedMinOut: bigint | null = null;
  let boundRouteAtas: Set<string> | null = null;
  let boundOutputTokenProgram: string | null = null;
  const createdAtas = new Set<string>();

  for (const ix of transaction.message.compiledInstructions) {
    const programPk = accountKeys.get(ix.programIdIndex);
    if (!programPk) {
      throw new Error('Swap transaction has a malformed program id');
    }
    const programId = programPk.toBase58();

    if (!SWAP_SUPPORT_PROGRAM_ALLOWLIST.has(programId)) {
      throw new Error(
        'Swap includes an unexpected program. Refusing to sign.',
      );
    }

    if (SWAP_ROUTER_ALLOWLIST.has(programId)) {
      sawRouter = true;
      routerInstructionCount += 1;
      if (routerInstructionCount > 1) {
        throw new Error(
          'Swap includes multiple Jupiter router routes. Refusing to sign.',
        );
      }

      const decodedRoute = decodeJupiterRouteMinOut(ix.data);

      if (decodedRoute && decodedRoute.family === 'v1') {
        const layout =
          JUPITER_V1_ACCOUNT_LAYOUT[
            decodedRoute.kind as 'route' | 'sharedAccountsRoute'
          ];

        if (programId !== JUPITER_V6_PROGRAM_ID) {
          throw new Error(
            'Swap v1 route uses an unexpected router program. Refusing to sign.',
          );
        }

        // Binding requirement 1 — the pin, checked before anything it protects.
        if (context.instructionVersion !== REQUIRED_INSTRUCTION_VERSION) {
          throw new Error(
            'Swap quote did not pin Jupiter instructionVersion=V1. Refusing to sign.',
          );
        }

        if (ix.accountKeyIndexes.length < layout.minimumAccounts) {
          throw new Error(
            'Swap has malformed v1 route accounts. Refusing to sign.',
          );
        }

        const v1Account = (position: number): {
          address: string;
          messageIndex: number;
        } | null => {
          const messageIndex = ix.accountKeyIndexes[position];
          if (messageIndex == null) return null;
          const address = accountKeys.get(messageIndex)?.toBase58();
          return address ? { address, messageIndex } : null;
        };

        const tokenProgram = v1Account(layout.tokenProgram);
        const authority = v1Account(layout.authority);
        const source = v1Account(layout.source);
        const destination = v1Account(layout.destination);
        const destinationMint = v1Account(layout.destinationMint);
        const feeAccount = v1Account(layout.platformFeeAccount);
        const eventAuthority = v1Account(layout.eventAuthority);
        const routeProgram = v1Account(layout.program);
        const sourceMint =
          layout.sourceMint == null ? null : v1Account(layout.sourceMint);
        const absentOptionalDestination =
          layout.absentOptionalDestination == null
            ? null
            : v1Account(layout.absentOptionalDestination);
        const token2022Program =
          layout.token2022Program == null
            ? null
            : v1Account(layout.token2022Program);

        // Binding requirement 8 — Token-2022 refuses. Jupiter supports it only
        // at instructionVersion=V2, which deletes the named fee account, and
        // transfer hooks / transfer fees make the received amount differ from
        // the sent amount in a way that cannot be proven offline.
        if (
          tokenProgram?.address === TOKEN_2022_PROGRAM_ID ||
          (token2022Program != null &&
            token2022Program.address === TOKEN_2022_PROGRAM_ID)
        ) {
          throw new Error(
            'Swap v1 route uses Token-2022, which requires instructionVersion=V2. Refusing to sign.',
          );
        }
        if (tokenProgram?.address !== TOKEN_PROGRAM_ID) {
          throw new Error(
            'Swap v1 route token program is not the SPL Token program. Refusing to sign.',
          );
        }

        // Every bindable account, derived offline, never read from the quote.
        const expectedSourceAta = associatedTokenAddress({
          mint: context.inputMint,
          owner,
          tokenProgramId: TOKEN_PROGRAM_ID,
        });
        const expectedDestinationAta = associatedTokenAddress({
          mint: context.outputMint,
          owner,
          tokenProgramId: TOKEN_PROGRAM_ID,
        });
        if (
          !authority ||
          !source ||
          !destination ||
          !destinationMint ||
          !eventAuthority ||
          !routeProgram ||
          authority.address !== owner ||
          !transaction.message.isAccountSigner(authority.messageIndex) ||
          source.address !== expectedSourceAta ||
          !transaction.message.isAccountWritable(source.messageIndex) ||
          destination.address !== expectedDestinationAta ||
          !transaction.message.isAccountWritable(destination.messageIndex) ||
          destinationMint.address !== context.outputMint ||
          // `route` carries no source_mint account; the input mint is bound via
          // the source-ATA derivation above instead.
          (sourceMint != null && sourceMint.address !== context.inputMint) ||
          // Anchor absent-optional sentinel — the program id, position kept.
          (absentOptionalDestination != null &&
            absentOptionalDestination.address !== JUPITER_V6_PROGRAM_ID) ||
          (token2022Program != null &&
            token2022Program.address !== JUPITER_V6_PROGRAM_ID) ||
          eventAuthority.address !== JUPITER_EVENT_AUTHORITY ||
          routeProgram.address !== JUPITER_V6_PROGRAM_ID
        ) {
          throw new Error(
            'Swap v1 route accounts do not bind the session source and destination. Refusing to sign.',
          );
        }

        const feeExemptPair = isStablecoinToStablecoinSwap({
          inputMint: context.inputMint,
          outputMint: context.outputMint,
        });
        if (feeExemptPair) {
          if (
            !feeAccount ||
            feeAccount.address !== JUPITER_V6_PROGRAM_ID ||
            transaction.message.isAccountWritable(feeAccount.messageIndex) ||
            decodedRoute.platformFeeBps !== 0 ||
            context.platformFeeBps !== 0 ||
            context.quoteFeeBps !== 0 ||
            context.corsoFeeBps !== 0 ||
            context.feeMint !== null ||
            context.feeDestination !== null ||
            context.platformFeeAmount !== null
          ) {
            throw new Error(
              'Swap v1 fee-free shape does not match the pinned stablecoin waiver. Refusing to sign.',
            );
          }
        } else {
          // Binding requirement 4 — fee authority from PINNED CONFIG only.
          const feeAuthorityKey = corsoFeeAuthority();
          if (!feeAuthorityKey) {
            throw new Error(
              'Corso fee authority is not configured on this build. Refusing to sign.',
            );
          }
          // Binding requirements 3 + 2 — the fee mint is the reviewed OUTPUT
          // mint. Jupiter permits an input-mint fee account on ExactIn; Corso
          // does not, because the min-out proof and the Review number are both
          // stated in the output mint. An input-side fee is a separate slice.
          if (context.feeMint !== context.outputMint) {
            throw new Error(
              'Corso fee mint is not the reviewed output mint. Refusing to sign.',
            );
          }
          const expectedFeeAta = corsoFeeAta({
            mint: context.outputMint,
            authority: feeAuthorityKey,
          });
          if (
            !feeAccount ||
            feeAccount.address !== expectedFeeAta ||
            !transaction.message.isAccountWritable(feeAccount.messageIndex)
          ) {
            throw new Error(
              'Swap v1 platform fee account is not the derived Corso fee account. Refusing to sign.',
            );
          }
          // Review, the digest, and the signed bytes may not disagree.
          if (context.feeDestination !== expectedFeeAta) {
            throw new Error(
              'Corso fee destination does not match the reviewed quote. Refusing to sign.',
            );
          }
          // Fee laundering guard: a misconfigured authority equal to the user
          // would turn the fee into a self-payment and the gate into theatre.
          if (
            outputAtas.has(expectedFeeAta) ||
            inputAtas.has(expectedFeeAta) ||
            expectedFeeAta === owner ||
            feeAuthorityKey === owner
          ) {
            throw new Error(
              'Corso fee destination is a user account. Refusing to sign.',
            );
          }

          // Binding requirement 5 — the bytes match the validated frozen Review rate.
          if (
            decodedRoute.platformFeeBps !== reviewedCorsoFeeBps ||
            context.platformFeeBps !== reviewedCorsoFeeBps ||
            context.quoteFeeBps !== reviewedCorsoFeeBps ||
            !isReviewedCorsoFeeBps(reviewedCorsoFeeBps)
          ) {
            throw new Error(
              'Swap v1 platform fee bps does not match the reviewed fee quote. Refusing to sign.',
            );
          }
        }

        if (decodedRoute.inAmount !== inAmount) {
          throw new Error(
            'Swap v1 route input does not match the reviewed input amount. Refusing to sign.',
          );
        }
        if (
          context.quoteSlippageBps == null ||
          context.maxSlippageBps == null ||
          !Number.isInteger(context.quoteSlippageBps) ||
          !Number.isInteger(context.maxSlippageBps) ||
          decodedRoute.slippageBps !== context.quoteSlippageBps ||
          decodedRoute.slippageBps > context.maxSlippageBps
        ) {
          throw new Error(
            'Swap v1 route slippage does not match the reviewed limit. Refusing to sign.',
          );
        }

        if (!feeExemptPair) {
          if (context.platformFeeAmount == null) {
            throw new Error(
              'Corso fee amount is not fully declared on the reviewed quote. Refusing to sign.',
            );
          }
          const reviewedFeeAmount = asBigInt(
            context.platformFeeAmount,
            'platformFeeAmount',
          );
          const netOutAmount = asBigInt(context.outAmount, 'outAmount');
          const grossOutAmount = netOutAmount + reviewedFeeAmount;
          if (
            reviewedFeeAmount <= 0n ||
            corsoFeeAmount({
              outAmount: grossOutAmount,
              feeBps: reviewedCorsoFeeBps,
            }) !== reviewedFeeAmount
          ) {
            throw new Error(
              'Corso fee amount does not match the reviewed fee. Refusing to sign.',
            );
          }
        }

        // Binding requirement 7 — `otherAmountThreshold` is NET of the fee on
        // this path, established by the same measurement above:
        //   ceil(3_758_170 * 9_950 / 10_000) = 3_739_380 == observed threshold
        //   (a GROSS-derived threshold would have been 3_771_437)
        // The user's floor therefore already accounts for the 85 bps, and the
        // fee must NOT be subtracted a second time here — doing so would
        // reject every honest quote. This is why the requirement had to be
        // measured rather than assumed in either direction.
        if (decodedRoute.impliedMinOut < minOut) {
          throw new Error(
            'Swap v1 route minimum output is below the reviewed quote. Refusing to sign.',
          );
        }

        boundRouteAtas = new Set([source.address, destination.address]);
        boundOutputTokenProgram = tokenProgram.address;
        routeImpliedMinOut = decodedRoute.impliedMinOut;
        sawBoundV1FeeProof = true;
      } else if (decodedRoute) {
        if (programId !== JUPITER_V6_PROGRAM_ID) {
          throw new Error(
            'Swap route_v2 uses an unexpected router program. Refusing to sign.',
          );
        }
        if (ix.accountKeyIndexes.length < 10) {
          throw new Error(
            'Swap has malformed route_v2 accounts. Refusing to sign.',
          );
        }
        const routeAccount = (position: number): {
          address: string;
          messageIndex: number;
        } | null => {
          const messageIndex = ix.accountKeyIndexes[position];
          if (messageIndex == null) return null;
          const address = accountKeys.get(messageIndex)?.toBase58();
          return address ? { address, messageIndex } : null;
        };
        const sharedV2 = decodedRoute.kind === 'sharedAccountsRouteV2';
        const fixedCount = sharedV2 ? 12 : 10;
        if (ix.accountKeyIndexes.length < fixedCount) throw new Error('Malformed V2 accounts');
        const authority = routeAccount(sharedV2 ? 1 : 0);
        const source = routeAccount(sharedV2 ? 2 : 1);
        const destination = routeAccount(sharedV2 ? 5 : 2);
        const sourceMint = routeAccount(sharedV2 ? 6 : 3);
        const destinationMint = routeAccount(sharedV2 ? 7 : 4);
        const sourceTokenProgram = routeAccount(sharedV2 ? 8 : 5);
        const destinationTokenProgram = routeAccount(sharedV2 ? 9 : 6);
        const optionalDestination = sharedV2 ? routeAccount(11) : routeAccount(7);
        const eventAuthority = routeAccount(sharedV2 ? 10 : 8);
        const routeProgram = routeAccount(sharedV2 ? 11 : 9);
        const sourceProgram = sourceTokenProgram?.address;
        const destinationProgram = destinationTokenProgram?.address;
        const isTokenProgram = (value: string | undefined): value is string =>
          value === TOKEN_PROGRAM_ID || value === TOKEN_2022_PROGRAM_ID;
        const expectedSourceAta = isTokenProgram(sourceProgram)
          ? associatedTokenAddress({
              mint: context.inputMint,
              owner,
              tokenProgramId: sourceProgram,
            })
          : null;
        const expectedDestinationAta = isTokenProgram(destinationProgram)
          ? associatedTokenAddress({
              mint: context.outputMint,
              owner,
              tokenProgramId: destinationProgram,
            })
          : null;

        if (
          !authority ||
          !source ||
          !destination ||
          !sourceMint ||
          !destinationMint ||
          !sourceTokenProgram ||
          !destinationTokenProgram ||
          !optionalDestination ||
          !eventAuthority ||
          !routeProgram ||
          authority.address !== owner ||
          !transaction.message.isAccountSigner(authority.messageIndex) ||
          source.address !== expectedSourceAta ||
          !transaction.message.isAccountWritable(source.messageIndex) ||
          destination.address !== expectedDestinationAta ||
          !transaction.message.isAccountWritable(destination.messageIndex) ||
          sourceMint.address !== context.inputMint ||
          destinationMint.address !== context.outputMint ||
          !isTokenProgram(sourceProgram) ||
          !isTokenProgram(destinationProgram) ||
          // Anchor represents an absent optional account with the program id.
          // The approved fixture uses that fail-closed sentinel shape only.
          optionalDestination.address !== JUPITER_V6_PROGRAM_ID ||
          eventAuthority.address !== JUPITER_EVENT_AUTHORITY ||
          routeProgram.address !== JUPITER_V6_PROGRAM_ID
        ) {
          throw new Error(
            'Swap route_v2 accounts do not bind the session source and destination. Refusing to sign.',
          );
        }
        if (decodedRoute.inAmount !== inAmount) {
          throw new Error(
            'Swap route_v2 input does not match the reviewed input amount. Refusing to sign.',
          );
        }
        if (
          context.quoteSlippageBps == null ||
          context.maxSlippageBps == null ||
          !Number.isInteger(context.quoteSlippageBps) ||
          !Number.isInteger(context.maxSlippageBps) ||
          decodedRoute.slippageBps !== context.quoteSlippageBps ||
          decodedRoute.slippageBps > context.maxSlippageBps
        ) {
          throw new Error(
            'Swap route_v2 slippage does not match the reviewed limit. Refusing to sign.',
          );
        }
        if (
          context.platformFeeBps == null ||
          context.positiveSlippageBps == null ||
          !Number.isInteger(context.platformFeeBps) ||
          !Number.isInteger(context.positiveSlippageBps) ||
          decodedRoute.platformFeeBps !== context.platformFeeBps ||
          decodedRoute.positiveSlippageBps !== context.positiveSlippageBps
        ) {
          throw new Error(
            'Swap route_v2 fee fields do not match the reviewed quote. Refusing to sign.',
          );
        }
        const token2022Pair = sourceProgram === TOKEN_2022_PROGRAM_ID || destinationProgram === TOKEN_2022_PROGRAM_ID;
        if (token2022Pair && context.instructionVersion !== 'V2') {
          throw new Error('Token-2022 requires the reviewed V2 instruction version. Refusing to sign.');
        }
        if (context.instructionVersion != null) {
          if (decodedRoute.quotedOutAmount !== asBigInt(context.outAmount, 'outAmount')) throw new Error('Swap V2 quoted output does not match Review. Refusing to sign.');
          if (!token2022Pair || context.instructionVersion !== 'V2') {
            throw new Error('Swap route_v2 nonzero fee account semantics are not proven. Refusing to sign.');
          }
          if (destinationProgram === TOKEN_2022_PROGRAM_ID && context.inputMint !== SOL_MINT) {
            throw new Error('USDC-funded Token-2022 buys are unsupported. Refusing to sign.');
          }
          if (!isReviewedCorsoFeeBps(reviewedCorsoFeeBps) || reviewedQuoteFeeBps !== reviewedCorsoFeeBps || decodedRoute.positiveSlippageBps !== 0) {
            throw new Error('Swap V2 fee schedule does not match the reviewed fee. Refusing to sign.');
          }
          const authorityConfig = corsoFeeAuthority();
          if (!authorityConfig || authorityConfig === owner) throw new Error('Corso fee authority is not configured. Refusing to sign.');
          if (solBuyFee) {
            const expectedSolDestination = corsoFeeAta({mint: SOL_MINT, authority: authorityConfig});
            if (destinationProgram !== TOKEN_2022_PROGRAM_ID || decodedRoute.platformFeeBps !== 0 ||
                context.feeMint !== SOL_MINT || context.feeDestination !== expectedSolDestination ||
                context.platformFeeAmount !== (inAmount * BigInt(reviewedCorsoFeeBps) / 10000n).toString() ||
                Array.from(ix.accountKeyIndexes).some((i) => accountKeys.get(i)?.toBase58() === expectedSolDestination)) {
              throw new Error('Swap V2 SOL buy fee contract does not bind the reviewed input. Refusing to sign.');
            }
          } else {
            const expectedFeeAta = corsoFeeAta({mint: context.outputMint, authority: authorityConfig, tokenProgramId: destinationProgram as typeof TOKEN_PROGRAM_ID | typeof TOKEN_2022_PROGRAM_ID});
            const feeAccount = routeAccount(fixedCount);
            if (decodedRoute.platformFeeBps !== reviewedCorsoFeeBps || context.platformFeeBps !== reviewedCorsoFeeBps ||
                context.feeMint !== context.outputMint || context.feeDestination !== expectedFeeAta ||
                !feeAccount || feeAccount.address !== expectedFeeAta ||
                !transaction.message.isAccountWritable(feeAccount.messageIndex) ||
                transaction.message.isAccountSigner(feeAccount.messageIndex) ||
                inputAtas.has(expectedFeeAta) || outputAtas.has(expectedFeeAta) || expectedFeeAta === owner ||
                Array.from(ix.accountKeyIndexes).filter((i) => accountKeys.get(i)?.toBase58() === expectedFeeAta).length !== 1) {
              throw new Error('Swap V2 fee account is not the derived Corso output fee ATA. Refusing to sign.');
            }
            const feeAmount = asBigInt(context.platformFeeAmount ?? '', 'platformFeeAmount');
            if (feeAmount <= 0n || (asBigInt(context.outAmount, 'outAmount') + feeAmount) * BigInt(reviewedCorsoFeeBps) / 10000n !== feeAmount) {
              throw new Error('Swap V2 fee amount does not match the reviewed net/gross identity. Refusing to sign.');
            }
            sawBoundV2FeeProof = true;
          }
        } else if (sharedV2 || decodedRoute.platformFeeBps !== 0 || decodedRoute.positiveSlippageBps !== 0) {
          throw new Error('Swap route_v2 nonzero fee account semantics are not proven. Refusing to sign.');
        }
        boundInputTokenProgram = sourceProgram!;
        if (decodedRoute.impliedMinOut < minOut) {
          throw new Error(
            'Swap route_v2 minimum output is below the reviewed quote. Refusing to sign.',
          );
        }
        boundRouteAtas = new Set([source.address, destination.address]);
        boundOutputTokenProgram = destinationProgram;
        routeImpliedMinOut = decodedRoute.impliedMinOut;
        sawBoundRouteV2Proof = true;
      }
    }

    if (programPk.equals(SystemProgram.programId)) {
      if (ix.data.length >= 12 && readU32LE(ix.data, 0) === SYSTEM_TRANSFER) {
        const lamports = readU64LE(ix.data, 4);
        const toIndex = ix.accountKeyIndexes[1];
        if (toIndex == null) {
          throw new Error('Swap transaction has a malformed SOL transfer');
        }
        const to = accountKeys.get(toIndex)?.toBase58();
        if (!to) {
          throw new Error('Swap transaction has a malformed SOL transfer');
        }
        if (solBuyFee && to === context.feeDestination) {
          const fromIndex = ix.accountKeyIndexes[0];
          if (ix.data.length !== 12 || ix.accountKeyIndexes.length !== 2 || fromIndex == null ||
              accountKeys.get(fromIndex)?.toBase58() !== owner ||
              !transaction.message.isAccountSigner(fromIndex) ||
              !transaction.message.isAccountWritable(fromIndex) ||
              !transaction.message.isAccountWritable(toIndex) ||
              transaction.message.isAccountSigner(toIndex) || sawRouter ||
              lamports !== inAmount * BigInt(reviewedCorsoFeeBps) / 10000n || lamports <= 0n || corsoFeeTransferCount !== 0) {
            throw new Error('Swap SOL fee transfer does not bind amount, destination, source and position. Refusing to sign.');
          }
          corsoFeeTransferCount++;
          continue;
        }
        if (context.inputMint === SOL_MINT && wsolAtas.has(to)) {
          wrapLamportsToWsol += lamports;
          continue;
        }
        if (approvedRentRecipients.has(to)) {
          if (lamports !== TOKEN_ACCOUNT_RENT_LAMPORTS) {
            throw new Error(
              'Swap rent top-up is not an exact token-account rent amount. Refusing to sign.',
            );
          }
          if (rentRecipients.has(to)) {
            throw new Error(
              'Swap includes a duplicate rent top-up. Refusing to sign.',
            );
          }
          rentRecipients.add(to);
          continue;
        }
        throw new Error(
          'Swap transaction includes an unexpected SOL transfer. Refusing to sign.',
        );
      }
      throw new Error(
        'Swap has an unsupported System instruction. Refusing to sign.',
      );
    }

    if (programId === ASSOCIATED_TOKEN_PROGRAM_ID) {
      const isCreate = ix.data.length === 0;
      const isCreateIdempotent = ix.data.length === 1 && ix.data[0] === 1;
      if (
        (!isCreate && !isCreateIdempotent) ||
        ix.accountKeyIndexes.length !== 6
      ) {
        throw new Error(
          'Swap has an unsupported associated token instruction. Refusing to sign.',
        );
      }

      const payerIndex = ix.accountKeyIndexes[0];
      const ataIndex = ix.accountKeyIndexes[1];
      const ataOwnerIndex = ix.accountKeyIndexes[2];
      const mintIndex = ix.accountKeyIndexes[3];
      const systemProgramIndex = ix.accountKeyIndexes[4];
      const tokenProgramIndex = ix.accountKeyIndexes[5];
      if (
        payerIndex == null ||
        ataIndex == null ||
        ataOwnerIndex == null ||
        mintIndex == null ||
        systemProgramIndex == null ||
        tokenProgramIndex == null
      ) {
        throw new Error('Swap has malformed associated token accounts.');
      }

      const payer = accountKeys.get(payerIndex)?.toBase58();
      const ata = accountKeys.get(ataIndex)?.toBase58();
      const ataOwner = accountKeys.get(ataOwnerIndex)?.toBase58();
      const mint = accountKeys.get(mintIndex)?.toBase58();
      const systemProgram = accountKeys.get(systemProgramIndex)?.toBase58();
      const tokenProgram = accountKeys.get(tokenProgramIndex)?.toBase58();
      const isTokenProgram =
        tokenProgram === TOKEN_PROGRAM_ID ||
        tokenProgram === TOKEN_2022_PROGRAM_ID;
      const reviewedMint =
        mint === context.inputMint || mint === context.outputMint;
      const expectedAta =
        ataOwner && mint && isTokenProgram
          ? associatedTokenAddress({
              owner: ataOwner,
              mint,
              tokenProgramId: tokenProgram,
            })
          : null;

      if (
        payer !== owner ||
        ataOwner !== owner ||
        !reviewedMint ||
        !isTokenProgram ||
        systemProgram !== SystemProgram.programId.toBase58() ||
        ata !== expectedAta ||
        !transaction.message.isAccountSigner(payerIndex) ||
        !transaction.message.isAccountWritable(payerIndex) ||
        !transaction.message.isAccountWritable(ataIndex)
      ) {
        throw new Error(
          'Swap associated token create does not match the reviewed session ATA. Refusing to sign.',
        );
      }
      if (
        mint === context.outputMint &&
        tokenProgram === TOKEN_2022_PROGRAM_ID
      ) {
        sawToken2022OutputActivity = true;
      }
      createdAtas.add(ata);
      continue;
    }

    if (
      programId === TOKEN_PROGRAM_ID ||
      programId === TOKEN_2022_PROGRAM_ID
    ) {
      const disc = ix.data[0];
      if (disc === TOKEN_TRANSFER) {
        throw new Error(
          'Swap uses unchecked token transfers. Refusing to sign.',
        );
      }
      if (disc === TOKEN_CLOSE_ACCOUNT) {
        const accountIndex = ix.accountKeyIndexes[0];
        const destinationIndex = ix.accountKeyIndexes[1];
        const authorityIndex = ix.accountKeyIndexes[2];
        const account = accountIndex != null
          ? accountKeys.get(accountIndex)?.toBase58()
          : undefined;
        const destination = destinationIndex != null
          ? accountKeys.get(destinationIndex)?.toBase58()
          : undefined;
        const authority = authorityIndex != null
          ? accountKeys.get(authorityIndex)?.toBase58()
          : undefined;
        const expectedWsolAta = associatedTokenAddress({
          mint: SOL_MINT,
          owner,
          tokenProgramId: TOKEN_PROGRAM_ID,
        });
        if (
          programId !== TOKEN_PROGRAM_ID ||
          ix.data.length !== 1 ||
          ix.accountKeyIndexes.length !== 3 ||
          accountIndex == null ||
          destinationIndex == null ||
          authorityIndex == null ||
          account !== expectedWsolAta ||
          destination !== owner ||
          authority !== owner ||
          (context.inputMint !== SOL_MINT && context.outputMint !== SOL_MINT) ||
          !transaction.message.isAccountWritable(accountIndex) ||
          !transaction.message.isAccountWritable(destinationIndex) ||
          !transaction.message.isAccountSigner(authorityIndex)
        ) {
          throw new Error(
            'Swap has an invalid CloseAccount instruction. Refusing to sign.',
          );
        }
        continue;
      }
      if (disc === TOKEN_SYNC_NATIVE) {
        const accountIndex = ix.accountKeyIndexes[0];
        const account = accountIndex != null
          ? accountKeys.get(accountIndex)?.toBase58()
          : undefined;
        if (
          ix.data.length !== 1 ||
          ix.accountKeyIndexes.length !== 1 ||
          accountIndex == null ||
          !account ||
          !wsolAtas.has(account) ||
          !transaction.message.isAccountWritable(accountIndex)
        ) {
          throw new Error(
            'Swap has a malformed SyncNative instruction. Refusing to sign.',
          );
        }
        sawSyncNativeOnWsol = true;
        continue;
      }
      if (disc === TOKEN_TRANSFER_CHECKED) {
        if (ix.data.length !== 10 || ix.accountKeyIndexes.length !== 4) {
          throw new Error('Swap has a malformed token transfer');
        }
        const amount = readU64LE(ix.data, 1);
        const sourceIndex = ix.accountKeyIndexes[0];
        const mintIndex = ix.accountKeyIndexes[1];
        const destIndex = ix.accountKeyIndexes[2];
        const authorityIndex = ix.accountKeyIndexes[3];
        if (
          sourceIndex == null ||
          mintIndex == null ||
          destIndex == null ||
          authorityIndex == null
        ) {
          throw new Error('Swap has a malformed token transfer');
        }
        const source = accountKeys.get(sourceIndex)?.toBase58();
        const mint = accountKeys.get(mintIndex)?.toBase58();
        const dest = accountKeys.get(destIndex)?.toBase58();
        const authority = accountKeys.get(authorityIndex)?.toBase58();
        if (!source || !mint || !dest || !authority) {
          throw new Error('Swap has a malformed token transfer');
        }

        const allowedMints = new Set([context.inputMint, context.outputMint]);
        if (!allowedMints.has(mint)) {
          throw new Error(
            'Swap moves an unexpected token mint. Refusing to sign.',
          );
        }

        if (
          amount <= 0n ||
          !transaction.message.isAccountWritable(sourceIndex) ||
          !transaction.message.isAccountWritable(destIndex)
        ) {
          throw new Error('Swap has a malformed token transfer');
        }
        if (
          mint === context.outputMint &&
          programId === TOKEN_2022_PROGRAM_ID
        ) {
          sawToken2022OutputActivity = true;
        }

        // --- Corso outer fee TransferChecked ------------------------------
        // Shape signature: output mint, spent FROM a user output ATA, signed BY
        // the session. That is a user-authorised debit, never a router credit,
        // so it is classified here before the router-credit rules below and is
        // deliberately excluded from `outputCredits`.
        if (
          mint === context.outputMint &&
          outputAtas.has(source) &&
          authority === owner
        ) {
          corsoFeeTransferCount += 1;
          // Requirement 1 — exactly one. Two or more, refuse.
          if (corsoFeeTransferCount > 1) {
            throw new Error(
              'Swap includes more than one Corso fee transfer. Refusing to sign.',
            );
          }
          if (!declaresCorsoFee) {
            throw new Error(
              'Swap moves the output mint to a fee account the reviewed quote did not declare. Refusing to sign.',
            );
          }

          // Requirement 9 — decimals byte must match the mint's real decimals.
          const expectedDecimals =
            context.outputMintDecimals ??
            provableMintDecimals(context.outputMint);
          if (
            expectedDecimals == null ||
            !Number.isInteger(expectedDecimals) ||
            expectedDecimals < 0 ||
            expectedDecimals > 18
          ) {
            throw new Error(
              'Corso fee transfer output mint decimals are unknown. Refusing to sign.',
            );
          }
          if (ix.data[9] !== expectedDecimals) {
            throw new Error(
              'Corso fee transfer decimals do not match the output mint. Refusing to sign.',
            );
          }

          if (boundOutputTokenProgram !== programId) {
            throw new Error(
              'Corso fee token program does not match the reviewed route. Refusing to sign.',
            );
          }
          if (
            programId !== TOKEN_2022_PROGRAM_ID &&
            programId !== TOKEN_PROGRAM_ID
          ) {
            throw new Error(
              'Corso fee transfer uses a token program whose transfer semantics are not proven. Refusing to sign.',
            );
          }

          // Requirements 3 + 4 — destination is the offline-derived ATA of the
          // pinned Corso fee authority. Derived, never read from the response.
          const authorityKey = corsoFeeAuthority();
          if (!authorityKey) {
            throw new Error(
              'Corso fee authority is not configured on this build. Refusing to sign.',
            );
          }
          const expectedFeeAta = corsoFeeAta({
            mint: context.outputMint,
            authority: authorityKey,
            tokenProgramId: programId,
          });
          if (dest !== expectedFeeAta) {
            throw new Error(
              'Corso fee destination is not the derived Corso fee account. Refusing to sign.',
            );
          }
          // The reviewed/digest-bound destination must equal the derived one,
          // so Review, the digest, and the signed bytes cannot disagree.
          if (context.feeDestination !== expectedFeeAta) {
            throw new Error(
              'Corso fee destination does not match the reviewed quote. Refusing to sign.',
            );
          }
          // Fee laundering guard: the fee must never land in a user account.
          if (outputAtas.has(dest) || inputAtas.has(dest) || dest === owner) {
            throw new Error(
              'Corso fee destination is a user account. Refusing to sign.',
            );
          }

          // Requirement 2 — fee mint is the reviewed output mint.
          if (context.feeMint !== context.outputMint) {
            throw new Error(
              'Corso fee mint is not the reviewed output mint. Refusing to sign.',
            );
          }

          // Requirement 5 — source is the user's output ATA under this token
          // program, and the authority is the session signer.
          const expectedUserOutputAta = associatedTokenAddress({
            mint: context.outputMint,
            owner,
            tokenProgramId: programId,
          });
          if (
            source !== expectedUserOutputAta ||
            !transaction.message.isAccountSigner(authorityIndex)
          ) {
            throw new Error(
              'Corso fee transfer roles do not match the reviewed session account. Refusing to sign.',
            );
          }

          // Requirement 6 — amount equals the reviewed fee exactly and equals
          // floor(outAmount * corsoFeeBps / 10_000).
          if (
            reviewedCorsoFeeBps <= 0 ||
            reviewedQuoteFeeBps !== reviewedCorsoFeeBps ||
            context.platformFeeAmount == null
          ) {
            throw new Error(
              'Corso fee amount is not fully declared on the reviewed quote. Refusing to sign.',
            );
          }
          const reviewedFeeAmount = asBigInt(
            context.platformFeeAmount,
            'platformFeeAmount',
          );
          const expectedFeeAmount = corsoFeeAmount({
            outAmount: asBigInt(context.outAmount, 'outAmount'),
            feeBps: reviewedCorsoFeeBps,
          });
          if (
            amount !== reviewedFeeAmount ||
            amount !== expectedFeeAmount
          ) {
            throw new Error(
              'Corso fee amount does not match the reviewed fee. Refusing to sign.',
            );
          }

          corsoFeeDebit += amount;
          continue;
        }

        if (mint === context.inputMint) {
          const expectedInputAta = associatedTokenAddress({
            mint,
            owner,
            tokenProgramId: programId,
          });
          if (
            source !== expectedInputAta ||
            authority !== owner ||
            !transaction.message.isAccountSigner(authorityIndex) ||
            inputAtas.has(dest) ||
            outputAtas.has(dest)
          ) {
            throw new Error(
              'Swap input transfer roles do not match the reviewed session account. Refusing to sign.',
            );
          }
          inputDebits += amount;
        }
        if (mint === context.outputMint) {
          const expectedOutputAta = associatedTokenAddress({
            mint,
            owner,
            tokenProgramId: programId,
          });
          sawOutputTransferChecked = true;
          outputCredits += amount;
          if (amount < minOut) {
            throw new Error(
              'Swap minimum output is below the reviewed quote. Refusing to sign.',
            );
          }
          if (dest !== expectedOutputAta) {
            throw new Error(
              'Swap output destination is not a user token account. Refusing to sign.',
            );
          }
          if (outputAtas.has(source)) {
            throw new Error(
              'Swap output source is a user token account. Refusing to sign.',
            );
          }
          if (authority === owner) {
            throw new Error(
              'Swap output transfer authority is the session signer. Refusing to sign.',
            );
          }
        }
        continue;
      }

      throw new Error(
        'Swap has an unsupported token instruction. Refusing to sign.',
      );
    }
  }

  const signedOutputProgram =
    boundOutputTokenProgram === TOKEN_PROGRAM_ID
      ? 'spl-token'
      : boundOutputTokenProgram === TOKEN_2022_PROGRAM_ID
        ? 'token-2022'
        : null;
  if (
    signedOutputProgram === 'token-2022' ||
    (signedOutputProgram == null && sawToken2022OutputActivity)
  ) {
    assertReviewedToken2022OutputSemantics({ context });
  }
  if ((signedOutputProgram === 'token-2022' || boundInputTokenProgram === TOKEN_2022_PROGRAM_ID || sawToken2022OutputActivity) && !sawBoundRouteV2Proof) throw new Error('Token-2022 requires a fully bound V2 route. Refusing to sign.');
  if (boundInputTokenProgram === TOKEN_2022_PROGRAM_ID) {
    assertReviewedToken2022OutputSemantics({context, input: true});
  }
  if (context.reviewedInputTokenFacts != null && context.reviewedInputTokenFacts.tokenProgram !== (boundInputTokenProgram === TOKEN_2022_PROGRAM_ID ? 'token-2022' : 'spl-token')) throw new Error('Input token program does not match reviewed TokenFacts. Refusing to sign.');
  if (context.reviewedOutputTokenFacts != null) {
    const reviewedProgram = context.reviewedOutputTokenFacts.tokenProgram;
    if (
      signedOutputProgram == null ||
      reviewedProgram !== signedOutputProgram
    ) {
      throw new Error(
        'Output token program does not match reviewed TokenFacts. Refusing to sign.',
      );
    }
  }

  if (!sawRouter) {
    throw new Error(
      'Transaction is not a recognized swap route. Refusing to sign.',
    );
  }

  // --- Corso outer fee: deferred bindings -----------------------------------
  // Requirement 1 — a declared fee obliges exactly one bound transfer.
  // Zero is a refusal: a quote that charges the user a Corso fee in Review while the
  // signed bytes move nothing is exactly the shape this gate exists to stop.
  if ((declaresCorsoFee || solBuyFee) && corsoFeeTransferCount !== 1) {
    throw new Error(
      'Swap declares a Corso fee but does not carry exactly one bound Corso fee transfer. Refusing to sign.',
    );
  }
  // Preserved refusal (was assertSwapSemantics.ts:266-279 inline): a route_v2
  // proof plus a nonzero/destination-bearing reviewed fee is refused unless the
  // Corso outer TransferChecked proved it. The message is unchanged.
  if (sawBoundRouteV2Proof && !sawBoundV2FeeProof && corsoFeeTransferCount === 0) {
    if (
      reviewedCorsoFeeBps !== 0 ||
      reviewedQuoteFeeBps !== 0 ||
      context.feeMint != null ||
      context.feeDestination != null
    ) {
      throw new Error(
        'Swap route_v2 nonzero fee account semantics are not proven. Refusing to sign.',
      );
    }
  }
  // A reviewed nonzero Jupiter-internal fee requires the proven V1 or V2
  // output fee account. Absent that proof the historic refusal stands: a
  // quote that charges the user a fee with no provable destination in the
  // signed bytes is exactly what this gate exists to stop.
  if (!sawBoundV1FeeProof && !sawBoundV2FeeProof && (context.platformFeeBps ?? 0) !== 0) {
    throw new Error(
      'Swap declares a Jupiter platform fee without a proven v1 fee account. Refusing to sign.',
    );
  }
  // A Jupiter-internal fee may never ride alongside the Corso outer fee.
  if (
    corsoFeeTransferCount > 0 &&
    (context.platformFeeBps ?? 0) !== 0
  ) {
    throw new Error(
      'Swap carries a Jupiter-internal platform fee alongside the Corso fee. Refusing to sign.',
    );
  }

  if (context.inputMint === SOL_MINT) {
    if (wrapLamportsToWsol !== inAmount) {
      throw new Error(
        'Swap wrapped SOL amount does not match the reviewed quote. Refusing to sign.',
      );
    }
    if (wrapLamportsToWsol > 0n && !sawSyncNativeOnWsol) {
      throw new Error(
        'Swap wrap is missing SyncNative on the user WSOL account. Refusing to sign.',
      );
    }
    if (inputDebits !== 0n) {
      throw new Error(
        'Swap SOL input includes an unexpected outer token transfer. Refusing to sign.',
      );
    }
  } else if (
    inputDebits !== inAmount &&
    !sawBoundRouteV2Proof &&
    !sawBoundV1FeeProof
  ) {
    throw new Error(
      'Swap does not move the reviewed input amount. Refusing to sign.',
    );
  }

  if (
    sawBoundRouteV2Proof &&
    (inputDebits !== 0n || outputCredits !== 0n)
  ) {
    throw new Error(
      'Swap route_v2 includes an unexpected outer token transfer. Refusing to sign.',
    );
  }
  // Same invariant for v1: the route credits the user by inner CPI, so any
  // outer movement of either reviewed mint is an instruction Corso did not
  // expect (binding requirement 10).
  if (sawBoundV1FeeProof && (inputDebits !== 0n || outputCredits !== 0n)) {
    throw new Error(
      'Swap v1 route includes an unexpected outer token transfer. Refusing to sign.',
    );
  }

  if (boundRouteAtas) {
    for (const ata of createdAtas) {
      if (!boundRouteAtas.has(ata)) {
        throw new Error(
          'Swap associated token create is not bound to the route_v2 accounts. Refusing to sign.',
        );
      }
    }
  }

  if (rentRecipients.size > 5) {
    throw new Error(
      'Swap rent top-up exceeds approved ATA budget. Refusing to sign.',
    );
  }

  if (
    (!sawOutputTransferChecked || outputCredits < minOut) &&
    !sawBoundRouteV2Proof &&
    !sawBoundV1FeeProof
  ) {
    const shapeHint =
      sawRouter && !sawOutputTransferChecked
        ? ' No outer TransferChecked credits the output mint (router CPI shape).'
        : '';
    throw new Error(
      `Swap does not prove the reviewed minimum output.${shapeHint} Refusing to sign.`,
    );
  }

  if (corsoFeeDebit > 0n) {
    const grossProvenMinOut = sawBoundRouteV2Proof
      ? routeImpliedMinOut
      : outputCredits;
    if (grossProvenMinOut == null) {
      throw new Error(
        'Swap does not prove a minimum output to net the Corso fee against. Refusing to sign.',
      );
    }
    if (grossProvenMinOut - corsoFeeDebit < minOut) {
      throw new Error(
        'Swap minimum output is below the reviewed quote after the Corso fee. Refusing to sign.',
      );
    }
  }
}

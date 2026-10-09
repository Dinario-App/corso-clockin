import type { BuiltUsdcTransfer } from '@/src/features/send/buildUsdcTransfer';
import type { UsdcSendCluster } from '@/src/features/send/validateUsdcSend';

export type SendAsset = 'SOL' | 'USDC';

/**
 * Frozen compose/review fields for a USDC send — never sum USDC + SOL.
 * Built fee must be a known positive safe integer (fail closed; no 5_000 default).
 * Payer/session address is part of the immutable consent surface.
 */
export type UsdcSendReviewFreeze = Readonly<{
  amountAtomic: bigint;
  feeLamports: number;
  ataRentLamports: number;
  needsDestinationAta: boolean;
  mint: string;
  cluster: UsdcSendCluster;
  recipient: string;
  /** Network fee + optional destination ATA rent (SOL only). */
  solRequiredLamports: number;
  /** Session address that owned this review (payer / fee payer). */
  payer: string;
}>;

function isNonNegativeSafeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

/**
 * Bind fee/rent from the same build that will be reviewed.
 * `needsDestinationAta` comes only from `built.createdDestinationAta`.
 */
export type FreezeUsdcSendReviewResult =
  | ({ ok: true } & UsdcSendReviewFreeze)
  | { ok: false; message: string };

export function freezeUsdcSendReviewFromBuilt(args: {
  built: BuiltUsdcTransfer;
  /** Rent-exempt lamports when create-ATA is required; ignored (must be 0) otherwise. */
  ataRentLamports: number;
  cluster: UsdcSendCluster;
  /** Active session address bound into the immutable review freeze. */
  payer: string;
}): FreezeUsdcSendReviewResult {
  const { built, cluster } = args;
  const needsDestinationAta = built.createdDestinationAta;
  const payer = typeof args.payer === 'string' ? args.payer.trim() : '';

  if (!payer) {
    return {
      ok: false,
      message: 'Cannot send without a session address',
    };
  }

  if (
    built.feeLamports === null ||
    (!isNonNegativeSafeInteger(built.feeLamports) || built.feeLamports <= 0)
  ) {
    return {
      ok: false,
      message: "Couldn't confirm the network fee. Pull back and try again.",
    };
  }

  if (!isNonNegativeSafeInteger(args.ataRentLamports)) {
    return {
      ok: false,
      message: "Couldn't confirm token account rent. Pull back and try again.",
    };
  }

  if (needsDestinationAta && args.ataRentLamports <= 0) {
    return {
      ok: false,
      message: "Couldn't confirm token account rent. Pull back and try again.",
    };
  }

  const ataRentLamports = needsDestinationAta ? args.ataRentLamports : 0;
  const solRequiredLamports = built.feeLamports + ataRentLamports;
  if (!Number.isSafeInteger(solRequiredLamports)) {
    return {
      ok: false,
      message: "Couldn't confirm the SOL reserve required for this send.",
    };
  }

  return Object.freeze({
    ok: true as const,
    amountAtomic: built.amountAtomic,
    feeLamports: built.feeLamports,
    ataRentLamports,
    needsDestinationAta,
    mint: built.mint,
    cluster,
    recipient: built.recipient,
    solRequiredLamports,
    payer,
  });
}

/**
 * Exact consent-surface compare. Any drift requires an updated review + new Send tap.
 */
export function usdcSendReviewTermsMatch(
  reviewed: UsdcSendReviewFreeze,
  next: UsdcSendReviewFreeze,
): boolean {
  return (
    reviewed.amountAtomic === next.amountAtomic &&
    reviewed.feeLamports === next.feeLamports &&
    reviewed.ataRentLamports === next.ataRentLamports &&
    reviewed.needsDestinationAta === next.needsDestinationAta &&
    reviewed.mint === next.mint &&
    reviewed.cluster === next.cluster &&
    reviewed.recipient === next.recipient &&
    reviewed.solRequiredLamports === next.solRequiredLamports &&
    reviewed.payer === next.payer
  );
}

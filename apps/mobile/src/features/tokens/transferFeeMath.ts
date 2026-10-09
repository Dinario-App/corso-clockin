const ONE_IN_BASIS_POINTS = 10_000n;
const MAX_U64 = 18_446_744_073_709_551_615n;

export type TransferFeeMathInput = Readonly<{
  transferFeeBasisPoints: number;
  maximumFee: bigint;
}>;

function isValidBps(transferFeeBasisPoints: number): boolean {
  return (
    Number.isInteger(transferFeeBasisPoints) &&
    transferFeeBasisPoints >= 0 &&
    transferFeeBasisPoints <= 10_000
  );
}

function isInU64Domain(value: bigint): boolean {
  return value >= 0n && value <= MAX_U64;
}

function ceilDiv(numerator: bigint, denominator: bigint): bigint | null {
  const sum = numerator + denominator;
  if (sum < numerator) return null;
  return (sum - 1n) / denominator;
}

function calculatePreFeeAmount(args: {
  postFeeAmount: bigint;
  transferFeeBasisPoints: number;
  maximumFee: bigint;
}): bigint | null {
  const { postFeeAmount, transferFeeBasisPoints, maximumFee } = args;
  if (!isInU64Domain(postFeeAmount) || !isInU64Domain(maximumFee)) {
    return null;
  }
  if (!isValidBps(transferFeeBasisPoints)) return null;

  const bps = BigInt(transferFeeBasisPoints);
  if (bps === 0n) return postFeeAmount;
  if (postFeeAmount === 0n) return 0n;
  if (bps === ONE_IN_BASIS_POINTS) {
    const sum = postFeeAmount + maximumFee;
    return sum > MAX_U64 ? null : sum;
  }

  const numerator = postFeeAmount * ONE_IN_BASIS_POINTS;
  if (numerator / ONE_IN_BASIS_POINTS !== postFeeAmount) return null;
  const denominator = ONE_IN_BASIS_POINTS - bps;
  const rawPreFeeAmount = ceilDiv(numerator, denominator);
  if (rawPreFeeAmount == null) return null;

  if (rawPreFeeAmount - postFeeAmount >= maximumFee) {
    const sum = postFeeAmount + maximumFee;
    return sum > MAX_U64 ? null : sum;
  }

  return rawPreFeeAmount > MAX_U64 ? null : rawPreFeeAmount;
}

export function calculateTransferFee(args: {
  amount: bigint;
  transferFeeBasisPoints: number;
  maximumFee: bigint;
}): bigint | null {
  const { amount, transferFeeBasisPoints, maximumFee } = args;
  if (!isInU64Domain(amount) || !isInU64Domain(maximumFee)) return null;
  if (!isValidBps(transferFeeBasisPoints)) return null;
  if (amount === 0n || transferFeeBasisPoints === 0) return 0n;

  const numerator = amount * BigInt(transferFeeBasisPoints);
  if (numerator / BigInt(transferFeeBasisPoints) !== amount) return null;
  const rawFee = ceilDiv(numerator, ONE_IN_BASIS_POINTS);
  if (rawFee == null) return null;
  return rawFee < maximumFee ? rawFee : maximumFee;
}

export function amountAfterTransferFee(args: {
  amount: bigint;
  transferFeeBasisPoints: number;
  maximumFee: bigint;
}): bigint | null {
  const fee = calculateTransferFee(args);
  if (fee == null) return null;
  const post = args.amount - fee;
  return post < 0n ? null : post;
}

/**
 * Inverse fee for a post-fee destination amount (`calculate_inverse_fee`).
 * Returns the fee that would be withheld from a gross transfer producing `postFeeAmount`.
 */
export function calculateInverseTransferFee(args: {
  postFeeAmount: bigint;
  transferFeeBasisPoints: number;
  maximumFee: bigint;
}): bigint | null {
  const preFeeAmount = calculatePreFeeAmount(args);
  if (preFeeAmount == null) return null;
  return calculateTransferFee({
    amount: preFeeAmount,
    transferFeeBasisPoints: args.transferFeeBasisPoints,
    maximumFee: args.maximumFee,
  });
}

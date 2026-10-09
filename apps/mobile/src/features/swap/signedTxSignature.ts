/**
 * Local signed-tx signature binding for swap finality (#intent/finality).
 * Provider Success alone is not enough — API signature must equal the
 * signature derived from the locally signed VersionedTransaction.
 */
import { VersionedTransaction } from '@solana/web3.js';
import { SwapApiError } from '@/src/features/swap/swapApi';

const BASE58_ALPHABET =
  '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

/** Minimal base58 encode (Bitcoin alphabet) — avoids undeclared bs58 dep. */
export function encodeBase58(bytes: Uint8Array): string {
  if (bytes.length === 0) return '';
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros += 1;

  let value = 0n;
  for (let i = zeros; i < bytes.length; i += 1) {
    value = value * 256n + BigInt(bytes[i]);
  }

  let body = '';
  while (value > 0n) {
    const mod = Number(value % 58n);
    body = BASE58_ALPHABET[mod] + body;
    value = value / 58n;
  }
  return `${'1'.repeat(zeros)}${body}`;
}

export function signatureOfSignedTransaction(
  signed: VersionedTransaction,
): string {
  const sig = signed.signatures[0];
  if (!sig || sig.length !== 64 || sig.every((b) => b === 0)) {
    throw new SwapApiError(
      'swap_signature_mismatch',
      'Signed transaction is missing a usable signature.',
    );
  }
  return encodeBase58(sig);
}

/**
 * Fail closed before on-chain polling when the API signature is not the
 * exact base58 signature of the locally signed transaction.
 */
export function assertApiSignatureMatchesLocalSigned(args: {
  localSignature: string;
  apiSignature: string;
}): string {
  if (
    !args.localSignature ||
    !args.apiSignature ||
    args.localSignature !== args.apiSignature
  ) {
    throw new SwapApiError(
      'swap_signature_mismatch',
      'Swap provider returned a signature that does not match the signed transaction.',
    );
  }
  return args.localSignature;
}

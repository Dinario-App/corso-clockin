import { PublicKey } from '@solana/web3.js';
import { copy } from '@/constants/copy';
import {
  SOL_MINT,
  USDC_MINT_DEVNET,
  USDC_MINT_MAINNET,
} from '@/src/features/swap/tokens';

/** The all-zero address. Anything sent there is unrecoverable. */
export const SYSTEM_PROGRAM_ADDRESS = '11111111111111111111111111111111';

/** Mints Corso itself trades. A mint is never a wallet. */
export const KNOWN_TOKEN_MINTS: readonly string[] = [
  SOL_MINT,
  USDC_MINT_MAINNET,
  USDC_MINT_DEVNET,
];

export type RecipientRejection =
  | 'empty'
  | 'malformed'
  | 'self'
  | 'system-program'
  | 'token-mint'
  | 'off-curve';

export type RecipientCheck =
  | { ok: true; address: string }
  | { ok: false; reason: RecipientRejection; message: string };

export function recipientRejectionMessage(reason: RecipientRejection): string {
  switch (reason) {
    case 'empty':
    case 'malformed':
      return copy.send.addressInvalid;
    case 'self':
      return copy.send.addressSelf;
    case 'system-program':
      return copy.send.addressBurn;
    case 'token-mint':
      return copy.send.addressTokenMint;
    case 'off-curve':
      return copy.send.addressOffCurve;
  }
}

function reject(reason: RecipientRejection): RecipientCheck {
  return { ok: false, reason, message: recipientRejectionMessage(reason) };
}

export function checkRecipientAddress(input: {
  raw: unknown;
  ownerAddress?: string | null;
}): RecipientCheck {
  if (typeof input.raw !== 'string') return reject('empty');
  const trimmed = input.raw.trim();
  if (trimmed.length === 0) return reject('empty');

  let address: string;
  try {
    // Decodes base58 and enforces 32 bytes; throws on anything else.
    address = new PublicKey(trimmed).toBase58();
  } catch {
    return reject('malformed');
  }
  // `new PublicKey` tolerates shorter input by left-padding, so re-encoding
  // has to round-trip for the string to be a real address.
  if (address !== trimmed) return reject('malformed');

  const owner = typeof input.ownerAddress === 'string'
    ? input.ownerAddress.trim()
    : '';
  if (owner.length > 0 && address === owner) return reject('self');

  if (address === SYSTEM_PROGRAM_ADDRESS) return reject('system-program');
  if (KNOWN_TOKEN_MINTS.includes(address)) return reject('token-mint');

  if (!PublicKey.isOnCurve(new PublicKey(address).toBytes())) {
    return reject('off-curve');
  }

  return { ok: true, address };
}

/** Convenience for call sites that only need yes or no. */
export function isSendableRecipient(input: {
  raw: unknown;
  ownerAddress?: string | null;
}): boolean {
  return checkRecipientAddress(input).ok;
}

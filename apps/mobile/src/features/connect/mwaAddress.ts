import { PublicKey } from '@solana/web3.js';
import { MwaError, type MwaAccount } from './mwaTypes';

const CANONICAL_BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

export function decodeMwaAddressBase64(addressBase64: string): Uint8Array {
  if (typeof addressBase64 !== 'string' || addressBase64.length === 0) {
    throw new MwaError('malformed_response');
  }
  if (/\s/.test(addressBase64) || !CANONICAL_BASE64.test(addressBase64)) {
    throw new MwaError('malformed_response');
  }

  const decoded = Buffer.from(addressBase64, 'base64');
  if (decoded.length !== 32 || decoded.toString('base64') !== addressBase64) {
    throw new MwaError('malformed_response');
  }
  return new Uint8Array(decoded);
}

export function encodeSolanaAddressBase58(bytes: Uint8Array): string {
  if (bytes.length !== 32) {
    throw new MwaError('malformed_response');
  }
  return new PublicKey(bytes).toBase58();
}

export function mwaAddressToBase58(addressBase64: string): string {
  return encodeSolanaAddressBase58(decodeMwaAddressBase64(addressBase64));
}

export function requireSingleMwaAccount(
  accounts: readonly MwaAccount[],
): MwaAccount {
  if (accounts.length !== 1) {
    throw new MwaError('malformed_response');
  }
  const account = accounts[0];
  if (!account) {
    throw new MwaError('malformed_response');
  }
  return account;
}

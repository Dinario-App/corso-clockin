import { mnemonicToSeedSync, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import * as ed25519 from '@noble/ed25519';
import { hmac } from '@noble/hashes/hmac';
import { sha512 } from '@noble/hashes/sha512';
import { utf8ToBytes } from '@noble/hashes/utils';
import bs58 from 'bs58';

// @noble/ed25519 v2 requires an explicit sync sha512 in Node
ed25519.etc.sha512Sync = (...msgs: Uint8Array[]) => sha512(ed25519.etc.concatBytes(...msgs));

/** Solana account path: m/44'/501'/0'/0' */
export const SOLANA_DERIVATION_PATH = "m/44'/501'/0'/0'";

const ED25519_CURVE = utf8ToBytes('ed25519 seed');
const HARDENED_OFFSET = 0x80000000;
const SOLANA_DERIVATION_SEGMENTS = [44, 501, 0, 0] as const;

/** Derive an ed25519 child seed using hardened-only SLIP-0010. */
function deriveSolanaSeed(seed: Uint8Array): Uint8Array {
  let digest = hmac(sha512, ED25519_CURVE, seed);
  let key = digest.slice(0, 32);
  let chainCode = digest.slice(32);
  digest.fill(0);

  for (const segment of SOLANA_DERIVATION_SEGMENTS) {
    const data = new Uint8Array(37);
    data.set(key, 1);
    new DataView(data.buffer).setUint32(33, segment + HARDENED_OFFSET, false);

    digest = hmac(sha512, chainCode, data);
    const nextKey = digest.slice(0, 32);
    const nextChainCode = digest.slice(32);

    key.fill(0);
    chainCode.fill(0);
    data.fill(0);
    digest.fill(0);

    key = nextKey;
    chainCode = nextChainCode;
  }

  chainCode.fill(0);
  return key;
}

export type ImportedWallet = {
  address: string;
  publicKey: Uint8Array;
  /** 64-byte secret key (seed + pubkey) for Solana signers — never log */
  secretKey: Uint8Array;
};

/**
 * Import a BIP39 mnemonic and derive the first Solana keypair (SLIP-0010 ed25519).
 * Caller persists via SecureStore — this function is pure crypto.
 * HARD RULE: never call network from this package.
 */
export function importMnemonicToAddress(mnemonic: string): ImportedWallet {
  const normalized = mnemonic.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!validateMnemonic(normalized, wordlist)) {
    throw new Error('Invalid recovery phrase');
  }

  const seed = mnemonicToSeedSync(normalized);
  const seed32 = deriveSolanaSeed(seed);
  seed.fill(0);
  const publicKey = ed25519.getPublicKey(seed32);
  const secretKey = new Uint8Array(64);
  secretKey.set(seed32);
  secretKey.set(publicKey, 32);
  const address = bs58.encode(publicKey);

  return { address, publicKey, secretKey };
}

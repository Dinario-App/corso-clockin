import * as ed25519 from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha512';
import type { ImportedMnemonicStore } from './secureStore.js';

// @noble/ed25519 v2 requires an explicit sync sha512 in Node and React Native.
ed25519.etc.sha512Sync = (...messages: Uint8Array[]) =>
  sha512(ed25519.etc.concatBytes(...messages));

export type SessionType = 'privy_embedded' | 'imported_seed' | 'connected_external';

export type SignerCapabilities = {
  signTransaction: boolean;
  signAllTransactions: boolean;
  signAndSendTransaction: boolean;
  signMessage: boolean;
  requiresForegroundHandoff: boolean;
};

export interface CorsoSigner<TTransaction = unknown, TConnection = unknown> {
  readonly address: string;
  readonly type: SessionType;
  readonly capabilities: SignerCapabilities;

  signTransaction(transaction: TTransaction): Promise<TTransaction>;
  signMessage(message: Uint8Array): Promise<Uint8Array>;
  signAndSendTransaction?(
    transaction: TTransaction,
    connection: TConnection,
  ): Promise<{ signature: string }>;
}

export interface ImportedSeedSigner extends CorsoSigner<unknown, never> {
  readonly type: 'imported_seed';
  signTransaction(transaction: unknown): Promise<never>;

  /** Zeroizes the in-memory secret and disables this signer instance. */
  clear(): void;
}

const MESSAGE_CAPABILITIES: Readonly<SignerCapabilities> = Object.freeze({
  signTransaction: false,
  signAllTransactions: false,
  signAndSendTransaction: false,
  signMessage: true,
  requiresForegroundHandoff: false,
});

/**
 * Detached Ed25519 over raw bytes (Solana tx message / SIWS payload).
 * Used by the mobile VersionedTransaction adapter — never log secretKey.
 */
export function signEd25519Detached(
  secretKey: Uint8Array,
  message: Uint8Array,
): Uint8Array {
  if (secretKey.length < 32) {
    throw new Error('Invalid secret key');
  }
  return ed25519.sign(message, secretKey.subarray(0, 32));
}

/** Restore the biometric-gated imported mnemonic and keep its signer local to the device. */
export async function createImportedSeedSigner(
  store: ImportedMnemonicStore,
): Promise<ImportedSeedSigner> {
  const wallet = await store.load();
  if (wallet === null) {
    throw new Error('No imported recovery phrase found');
  }

  let cleared = false;

  const assertActive = () => {
    if (cleared) {
      throw new Error('Imported seed signer is locked');
    }
  };

  return {
    address: wallet.address,
    type: 'imported_seed',
    capabilities: MESSAGE_CAPABILITIES,

    async signMessage(message) {
      assertActive();
      return signEd25519Detached(wallet.secretKey, message);
    },

    async signTransaction(_transaction) {
      assertActive();
      throw new Error(
        'imported_seed signTransaction requires the M2 VersionedTransaction adapter',
      );
    },

    clear() {
      if (!cleared) {
        wallet.secretKey.fill(0);
        cleared = true;
      }
    },
  };
}

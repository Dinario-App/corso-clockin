import {
  signEd25519Detached,
  type CorsoSigner,
  type ImportedMnemonicStore,
} from '@corso/wallet';
import {
  Connection,
  Keypair,
  VersionedTransaction,
} from '@solana/web3.js';
import type { CorsoSession } from '@/src/features/session/types';
import {
  assertSafeToSign,
  messageBytesOf,
} from '@/src/features/security/assertSafeToSign';
import { assertSignedMatchesMessage } from '@/src/features/security/verifySignedTransaction';

export type ImportedSolanaSigner = CorsoSigner<
  VersionedTransaction,
  Connection
> & {
  clear(): void;
};

const CAPABILITIES = Object.freeze({
  signTransaction: true,
  signAllTransactions: false,
  signAndSendTransaction: false,
  signMessage: true,
  requiresForegroundHandoff: false,
});

export async function createImportedSolanaSigner(args: {
  store: ImportedMnemonicStore;
  session: CorsoSession;
}): Promise<ImportedSolanaSigner> {
  const { store, session } = args;
  const wallet = await store.load();
  if (wallet === null) {
    throw new Error('No imported recovery phrase found');
  }

  const keypair = Keypair.fromSecretKey(wallet.secretKey);
  wallet.secretKey.fill(0);

  if (keypair.publicKey.toBase58() !== session.address) {
    keypair.secretKey.fill(0);
    throw new Error('Imported key does not match this session');
  }

  let cleared = false;

  const assertActive = () => {
    if (cleared) {
      throw new Error('Imported seed signer is locked');
    }
  };

  async function signTransaction(
    transaction: VersionedTransaction,
  ): Promise<VersionedTransaction> {
    assertActive();
    assertSafeToSign(transaction, session);
    const expectedMessageBytes = messageBytesOf(transaction);
    transaction.sign([keypair]);
    assertSignedMatchesMessage({
      signed: transaction,
      expectedMessageBytes,
      sessionAddress: session.address,
    });
    return transaction;
  }

  return {
    address: session.address,
    type: 'imported_seed',
    capabilities: CAPABILITIES,

    signTransaction,

    async signMessage(message) {
      assertActive();
      return signEd25519Detached(keypair.secretKey, message);
    },

    clear() {
      if (!cleared) {
        keypair.secretKey.fill(0);
        cleared = true;
      }
    },
  };
}

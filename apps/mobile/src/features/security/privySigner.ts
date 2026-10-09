import type { CorsoSigner } from '@corso/wallet';
import type { Connection } from '@solana/web3.js';
import { VersionedTransaction } from '@solana/web3.js';
import { Buffer } from 'buffer';
import type { CorsoSession } from '@/src/features/session/types';
import {
  assertSafeToSign,
  messageBytesOf,
  type SafeToSignContext,
} from '@/src/features/security/assertSafeToSign';
import { assertSignedMatchesMessage } from '@/src/features/security/verifySignedTransaction';

type PrivySolanaProvider = {
  request(args: {
    method: 'signMessage';
    params: { message: string };
  }): Promise<{ signature: string }>;
  request(args: {
    method: 'signAndSendTransaction';
    params: {
      transaction: VersionedTransaction;
      connection: Connection;
    };
  }): Promise<{ signature: string }>;
  request<T extends VersionedTransaction>(args: {
    method: 'signTransaction';
    params: { transaction: T };
  }): Promise<{ signedTransaction: T }>;
};

/** Local mirror — Privy defines this privately; not exported from @privy-io/expo. */
export type ConnectedEmbeddedSolanaWallet = {
  address: string;
  publicKey: string;
  walletIndex: number;
  getProvider: () => Promise<PrivySolanaProvider>;
};

export function createPrivySigner(args: {
  wallet: ConnectedEmbeddedSolanaWallet;
  session: CorsoSession;
  /** Optional per-call context; swap path should always pass one. */
  getSignContext?: () => SafeToSignContext | undefined;
}): CorsoSigner<VersionedTransaction, Connection> {
  const { wallet, session, getSignContext } = args;

  async function signTransaction(
    transaction: VersionedTransaction,
  ): Promise<VersionedTransaction> {
    const context = getSignContext?.() ?? {};
    assertSafeToSign(transaction, session, context);
    const expectedMessageBytes =
      context.expectedMessageBytes ?? messageBytesOf(transaction);
    const provider = await wallet.getProvider();
    const result = await provider.request<VersionedTransaction>({
      method: 'signTransaction',
      params: { transaction },
    });
    const signed = normalizeSignedTransaction(result.signedTransaction);
    assertSignedMatchesMessage({
      signed,
      expectedMessageBytes,
      sessionAddress: session.address,
    });
    return signed;
  }

  return {
    address: wallet.address,
    type: 'privy_embedded',
    capabilities: {
      ...session.capabilities,
      signAndSendTransaction: false,
    },
    signTransaction,
    async signMessage(message) {
      // Unused in swap path — do not treat base64 text as a binary signature.
      const provider = await wallet.getProvider();
      const asString = Buffer.from(message).toString('base64');
      const { signature } = await provider.request({
        method: 'signMessage',
        params: { message: asString },
      });
      return Buffer.from(signature, 'base64');
    },
  };
}

function normalizeSignedTransaction(
  signed: unknown,
): VersionedTransaction {
  if (signed instanceof VersionedTransaction) {
    return signed;
  }
  if (typeof signed === 'string') {
    return VersionedTransaction.deserialize(Buffer.from(signed, 'base64'));
  }
  if (signed instanceof Uint8Array) {
    return VersionedTransaction.deserialize(signed);
  }
  if (
    signed &&
    typeof signed === 'object' &&
    typeof (signed as { serialize?: unknown }).serialize === 'function'
  ) {
    return signed as VersionedTransaction;
  }
  throw new Error('Wallet returned an unexpected signed transaction shape');
}

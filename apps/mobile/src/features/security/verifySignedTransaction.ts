import * as ed25519 from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha512';
import { PublicKey, VersionedTransaction } from '@solana/web3.js';
import { bytesEqual, messageBytesOf } from '@/src/features/security/assertSafeToSign';

// @noble/ed25519 v2 needs sync sha512 in RN/Node.
ed25519.etc.sha512Sync = (...messages: Uint8Array[]) =>
  sha512(ed25519.etc.concatBytes(...messages));

export function assertSignedMatchesMessage(args: {
  signed: VersionedTransaction;
  expectedMessageBytes: Uint8Array;
  sessionAddress: string;
}): void {
  const { signed, expectedMessageBytes, sessionAddress } = args;
  const actualMessage = messageBytesOf(signed);
  if (!bytesEqual(actualMessage, expectedMessageBytes)) {
    throw new Error(
      'Wallet returned a different transaction than reviewed. Refusing to submit.',
    );
  }

  const sig = signed.signatures[0];
  if (!sig || sig.every((b) => b === 0)) {
    throw new Error('Wallet returned an unsigned transaction');
  }

  const pubkey = new PublicKey(sessionAddress).toBytes();
  const ok = ed25519.verify(sig, expectedMessageBytes, pubkey);
  if (!ok) {
    throw new Error('Wallet signature is not valid for this session');
  }
}

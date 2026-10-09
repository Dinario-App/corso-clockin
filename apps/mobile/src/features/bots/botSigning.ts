import { Buffer } from 'buffer';
import { VersionedTransaction } from '@solana/web3.js';
import type { CorsoSession } from '@/src/features/session/types';
import type { StepUpPolicy } from '@/src/lib/apiConfig';
import type { StepUpSignContext } from '@/src/features/security/getActiveSigner';
import type { BotUnsignedTransaction } from './types';

type PreparedStepUp =
  | { needed: false; policy: StepUpPolicy }
  | {
      needed: true;
      policy: StepUpPolicy;
      verifyPrivyMfa?: () => Promise<boolean>;
    };

type TransactionSigner = {
  signTransaction(
    transaction: VersionedTransaction,
  ): Promise<VersionedTransaction>;
  clear?: () => void;
};

const SOLANA_MAX_TX_BYTES = 1_232;

export class BotSigningError extends Error {
  constructor(
    readonly code:
      | 'malformed'
      | 'step_up_not_verified'
      | 'message_changed'
      | 'owner_signature_missing',
  ) {
    super(`Bot signing: ${code}`);
    this.name = 'BotSigningError';
  }
}

function signaturePresent(signature: Uint8Array | undefined): boolean {
  return (
    signature !== undefined &&
    signature.length === 64 &&
    signature.some((byte) => byte !== 0)
  );
}

/** Decodes the issued bytes; refuses anything that does not round-trip exactly. */
export function decodeIssuedTransaction(
  unsigned: BotUnsignedTransaction,
): VersionedTransaction {
  const base64 = unsigned.unsignedTransactionBase64;
  const bytes = Buffer.from(base64, 'base64');
  if (
    bytes.length === 0 ||
    bytes.length > SOLANA_MAX_TX_BYTES ||
    bytes.toString('base64') !== base64
  ) {
    throw new BotSigningError('malformed');
  }
  let decoded: VersionedTransaction;
  try {
    decoded = VersionedTransaction.deserialize(bytes);
  } catch {
    throw new BotSigningError('malformed');
  }
  if (decoded.version !== 0 && decoded.version !== 'legacy') {
    throw new BotSigningError('malformed');
  }
  if (unsigned.ownerSignatureIndex >= decoded.signatures.length) {
    throw new BotSigningError('malformed');
  }
  return decoded;
}

function serializePossiblyPartial(signed: VersionedTransaction): string {
  const serialize = signed.serialize.bind(signed) as (opts?: {
    requireAllSignatures?: boolean;
    verifySignatures?: boolean;
  }) => Uint8Array;
  return Buffer.from(
    serialize({ requireAllSignatures: false, verifySignatures: false }),
  ).toString('base64');
}

export function assertSignedIssuedTransaction(args: {
  issued: VersionedTransaction;
  signed: VersionedTransaction;
  ownerSignatureIndex: number;
}): void {
  const issuedMessage = Buffer.from(args.issued.message.serialize());
  const signedMessage = Buffer.from(args.signed.message.serialize());
  if (
    issuedMessage.length !== signedMessage.length ||
    !issuedMessage.equals(signedMessage)
  ) {
    throw new BotSigningError('message_changed');
  }
  if (!signaturePresent(args.signed.signatures[args.ownerSignatureIndex])) {
    throw new BotSigningError('owner_signature_missing');
  }
}

export async function performBotTransactionSignature(args: {
  session: CorsoSession;
  unsigned: BotUnsignedTransaction;
  prepareStepUp(input: {
    session: CorsoSession;
    notionalSol: null;
    surface: 'swap';
  }): Promise<PreparedStepUp>;
  getActiveSigner(context: StepUpSignContext): Promise<TransactionSigner>;
}): Promise<string> {
  const issued = decodeIssuedTransaction(args.unsigned);
  const prepared = await args.prepareStepUp({
    session: args.session,
    notionalSol: null,
    surface: 'swap',
  });
  if (prepared.needed) {
    if (!prepared.verifyPrivyMfa || !(await prepared.verifyPrivyMfa())) {
      throw new BotSigningError('step_up_not_verified');
    }
  }
  const signer = await args.getActiveSigner({
    session: args.session,
    notionalSol: null,
    surface: 'swap',
    verifyPrivyMfa: prepared.needed ? prepared.verifyPrivyMfa : undefined,
    policy: prepared.policy,
  });
  let signed: VersionedTransaction;
  try {
    signed = await signer.signTransaction(issued);
  } finally {
    signer.clear?.();
  }
  assertSignedIssuedTransaction({
    issued: decodeIssuedTransaction(args.unsigned),
    signed,
    ownerSignatureIndex: args.unsigned.ownerSignatureIndex,
  });
  return serializePossiblyPartial(signed);
}

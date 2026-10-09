import {
  mwaAddressToBase58,
  requireSingleMwaAccount,
} from "@/src/features/connect/mwaAddress";
import {
  MWA_AUTH_TOKEN_REF,
  type MwaSessionStore,
} from "@/src/features/connect/mwaSessionStore";
import {
  parseMwaAuthorization,
  parseMwaCapabilities,
  type MwaTransact,
  type MwaIdentity,
} from "@/src/features/connect/mwaTypes";
import type { CorsoSession } from "@/src/features/session/types";
// This adapter exposes message signing only. It does not mint a money signer.
export async function signHeadsUpMwaProof(args: {
  session: CorsoSession;
  message: Uint8Array;
  assertCurrent(): void;
  transact: MwaTransact;
  store: MwaSessionStore;
  identity: MwaIdentity;
}) {
  const assertCurrent = args.assertCurrent;
  assertCurrent();
  if (
    args.session.type !== "connected_external" ||
    args.session.authTokenRef !== MWA_AUTH_TOKEN_REF ||
    !args.session.capabilities.signMessage
  )
    throw new Error("Heads-Up signer unavailable.");
  const stored = await args.store.load();
  assertCurrent();
  if (!stored || stored.address !== args.session.address)
    throw new Error("Heads-Up signer unavailable.");
  return args.transact(async (wallet) => {
    assertCurrent();
    const auth = parseMwaAuthorization(
      await wallet.reauthorize({
        chain: "solana:mainnet",
        identity: args.identity,
        authToken: stored.authToken,
      }),
    );
    assertCurrent();
    const account = requireSingleMwaAccount(auth.accounts);
    if (mwaAddressToBase58(account.addressBase64) !== args.session.address)
      throw new Error("Heads-Up wallet changed.");
    const capabilities = parseMwaCapabilities(await wallet.getCapabilities());
    assertCurrent();
    if (!capabilities.signMessages || !wallet.signMessages)
      throw new Error("Heads-Up signer unavailable.");
    await args.store.save({
      ...stored,
      authToken: auth.authToken,
      capabilities,
    });
    assertCurrent();
    const payloads = await wallet.signMessages({
      addresses: [account.addressBase64],
      payloads: [args.message],
    });
    assertCurrent();
    const payload = payloads[0];
    if (
      payloads.length !== 1 ||
      !payload ||
      payload.length !== args.message.length + 64 ||
      !Buffer.from(payload.subarray(0, args.message.length)).equals(
        Buffer.from(args.message),
      )
    )
      throw new Error("Invalid Heads-Up signature.");
    return new Uint8Array(payload.subarray(args.message.length));
  });
}

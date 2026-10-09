import { useCallback } from "react";
import { useActiveSigner } from "@/src/features/security/getActiveSigner";
import { useStepUpConfirm } from "@/src/features/security/useStepUpConfirm";
import { useCorsoSession } from "@/src/features/session/SessionContext";
import { performRoutineMessageSignature } from "@/src/features/routines/routineSigning";
import { mwaTransact } from "@/src/features/connect/mwaTransport";
import { createSecureStoreMwaSessionStore } from "@/src/features/connect/mwaSessionStore";
import { ownershipMessage } from "./headsUpAccessClient";
import { signHeadsUpMwaProof } from "./headsUpMwaProof";
const store = createSecureStoreMwaSessionStore();
const identity = {
  name: "Corso" as const,
  uri: "https://corso.trade",
  icon: "favicon.ico",
};
export function useHeadsUpProofSigner() {
  const { session, locked, liveSessionCell, lockStateCell, connectedStatus } =
    useCorsoSession();
  const { getActiveSigner } = useActiveSigner();
  const stepUp = useStepUpConfirm();
  const assertCurrent = useCallback(() => {
    if (
      !session ||
      liveSessionCell.current !== session ||
      lockStateCell.current
    )
      throw new Error("Heads-Up session changed.");
  }, [session, liveSessionCell, lockStateCell]);
  const signMessage = useCallback(
    async (message: Uint8Array) => {
      assertCurrent();
      if (!session) throw new Error("Heads-Up session unavailable.");
      if (session.type === "connected_external") {
        if (connectedStatus !== "ready")
          throw new Error("Heads-Up signer unavailable.");
        return signHeadsUpMwaProof({
          session,
          message,
          assertCurrent,
          transact: mwaTransact,
          store,
          identity,
        });
      }
      const signature = await performRoutineMessageSignature({
        session,
        message,
        prepareStepUp: stepUp.prepareStepUp,
        getActiveSigner,
      });
      assertCurrent();
      return signature;
    },
    [
      assertCurrent,
      session,
      connectedStatus,
      getActiveSigner,
      stepUp.prepareStepUp,
    ],
  );
  // This operation accepts inbox READ authority only. It never exposes the
  // acquired signer, and never changes policy or a transaction's null notional.
  const signInboxReadMessage = useCallback(
    async (message: Uint8Array) => {
      // Own the bytes before the first await; caller mutation cannot widen scope.
      const payload = Buffer.from(message);
      const lines = payload.toString("utf8").split("\n");
      const nonce = lines[5]?.slice(7) ?? "";
      const expiresAt = lines[6]?.slice(9) ?? "";
      const assertInboxRead = () => {
        assertCurrent();
        const expires = Date.parse(expiresAt);
        if (
          !session ||
          !/^[A-Za-z0-9_-]{43}$/.test(nonce) ||
          !Number.isFinite(expires) ||
          new Date(expires).toISOString() !== expiresAt ||
          expires <= Date.now() ||
          expires > Date.now() + 130_000 ||
          !payload.equals(Buffer.from(ownershipMessage(
            { walletAddress: session.address, action: "inbox" },
            nonce,
            expiresAt,
          )))
        ) throw new Error("Invalid Heads-Up challenge.");
      };
      assertInboxRead();
      if (!session) throw new Error("Heads-Up session unavailable.");
      if (session.type === "connected_external") {
        // Existing MWA path already signs messages without transaction step-up.
        const signature = await signMessage(payload);
        assertInboxRead();
        return signature;
      }
      const signer = await getActiveSigner({
        session,
        notionalSol: null,
        surface: "swap",
      });
      try {
        assertInboxRead();
        const signature = await signer.signMessage(payload);
        assertInboxRead();
        return signature;
      } finally {
        signer.clear?.();
      }
    },
    [assertCurrent, session, getActiveSigner, signMessage],
  );
  return {
    session,
    locked,
    assertCurrent,
    signMessage,
    signInboxReadMessage,
    stepUpSheet: stepUp.sheet,
  };
}

import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import type { CorsoSession } from "@/src/features/session/types";
import { useHeadsUpProofSigner } from "./useHeadsUpProofSigner";
import {
  listHeadsUpWatches,
  readHeadsUpInbox,
  removeHeadsUpWatch,
  type OwnedHeadsUpWatch,
  type HeadsUpInboxEvent,
} from "./headsUpAccessClient";
type Data = { watches: OwnedHeadsUpWatch[]; events: HeadsUpInboxEvent[] };
type State = Data & {
  owner: CorsoSession | null;
  status: "loading" | "ready" | "error";
  removing: string | null;
  loadFailed: boolean;
};
const empty: Data = { watches: [], events: [] };
export function useHeadsUpData(kind: "watches" | "inbox") {
  const signer = useHeadsUpProofSigner();
  const { session, locked, signMessage, signInboxReadMessage, assertCurrent } = signer;
  const proof = useRef({ signMessage, signInboxReadMessage, assertCurrent });
  proof.current = { signMessage, signInboxReadMessage, assertCurrent }; // Provider callback changes do not restart focused reads.
  const pending = useRef<AbortController | null>(null);
  const [state, setState] = useState<State>({
    ...empty,
    owner: null,
    status: "loading",
    removing: null,
    loadFailed: false,
  });
  const refresh = useCallback(async () => {
    const { signMessage, signInboxReadMessage, assertCurrent } = proof.current;
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    if (!session || locked) {
      setState({ ...empty, owner: null, status: "error", removing: null, loadFailed: false });
      return;
    }
    setState((previous) => ({
      ...(previous.owner === session ? previous : empty),
      owner: session,
      status: "loading",
      removing: null,
      loadFailed: false,
    }));
    try {
      const args = {
        walletAddress: session.address,
        signMessage: kind === "inbox" ? signInboxReadMessage : signMessage,
        assertCurrent,
        signal: controller.signal,
      };
      const data =
        kind === "watches"
          ? { watches: await listHeadsUpWatches(args), events: [] }
          : { watches: [], events: await readHeadsUpInbox(args) };
      assertCurrent();
      if (!controller.signal.aborted)
        setState({ ...data, owner: session, status: "ready", removing: null, loadFailed: false });
    } catch {
      if (!controller.signal.aborted)
        setState((previous) => ({
          ...(previous.owner === session ? previous : empty),
          owner: session,
          status: "error",
          removing: null,
          loadFailed: true,
        }));
    }
  }, [session, locked, kind]);
  useFocusEffect(
    useCallback(() => {
      void refresh();
      return () => {
        pending.current?.abort();
      };
    }, [refresh]),
  );
  const remove = useCallback(
    async (watchId: string) => {
      const { signMessage, assertCurrent } = proof.current;
      if (!session || locked) return false;
      pending.current?.abort();
      const controller = new AbortController();
      pending.current = controller;
      setState((previous) => ({ ...previous, removing: watchId, loadFailed: false }));
      try {
        await removeHeadsUpWatch(
          {
            walletAddress: session.address,
            signMessage,
            assertCurrent,
            signal: controller.signal,
          },
          watchId,
        );
        assertCurrent();
        if (!controller.signal.aborted)
          setState((previous) => ({
            ...previous,
            status: "ready",
            removing: null,
            watches: previous.watches.filter((w) => w.id !== watchId),
            events: previous.events.map((e) =>
              e.watchId === watchId ? { ...e, active: false } : e,
            ),
          }));
        return !controller.signal.aborted;
      } catch {
        if (!controller.signal.aborted)
          setState((previous) => ({
            ...previous,
            status: "error",
            removing: null,
          }));
        return false;
      }
    },
    [session, locked],
  );
  // Identity changes and locking conceal prior rows during this render, before
  // effects run. Await completions also require the root live session/lock.
  const current = state.owner === session && !!session && !locked;
  return {
    ...(current
      ? state
      : { ...empty, status: "error" as const, removing: null, loadFailed: false }),
    refresh,
    remove,
    stepUpSheet: signer.stepUpSheet,
  };
}

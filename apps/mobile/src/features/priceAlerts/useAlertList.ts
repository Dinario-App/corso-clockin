import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { usePriceAlertProofSigner } from './usePriceAlertProofSigner';
import { fetchTokenSearch } from '../swap/fetchTokenSearch';
import {
  readAlertNotifications,
  removeAlert,
  type OwnedAlert,
  type FiredAlert,
} from './alertClient';
import {
  readAlertPresets,
  removeAlertPreset,
  type AlertPreset,
} from './alertPresetStore';
import { readPushFlags } from './pushClient';
import { pushArmed } from './pushRegistration';
import type { CorsoSession } from '../session/types';
type State = {
  owner: CorsoSession | null;
  armed: boolean;
  alerts: OwnedAlert[];
  events: FiredAlert[];
  presets: Record<string, AlertPreset>;
  symbols: Record<string, string>;
  loading: boolean;
  failed: boolean;
  unavailable: boolean;
  removing: string | null;
};
const empty: State = {
  owner: null,
  armed: false,
  alerts: [],
  events: [],
  presets: {},
  symbols: {},
  loading: false,
  failed: false,
  unavailable: false,
  removing: null,
};
export function useAlertList() {
  const proof = usePriceAlertProofSigner();
  const ref = useRef(proof);
  ref.current = proof;
  const pending = useRef<AbortController | null>(null);
  const [state, setState] = useState<State>(empty);
  const refresh = useCallback(async () => {
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    const p = ref.current;
    if (!p.session || p.locked) {
      setState(empty);
      return;
    }
    const owner = p.session;
    setState({ ...empty, owner, loading: true });
    let armed = false;
    try {
      const flags = await readPushFlags();
      p.assertCurrent();
      if (controller.signal.aborted) return;
      if (!pushArmed(flags)) {
        setState(empty);
        return;
      }
      armed = true;
      const args = {
        walletAddress: owner.address,
        signMessage: p.signMessage,
        assertCurrent: p.assertCurrent,
        signal: controller.signal,
      };
      // Wallet proof requests are sequential: no overlapping wallet dialogs.
      const { alerts, events } = await readAlertNotifications(args);
      const presets = await readAlertPresets(owner.address).catch(() => ({}));
      const symbols: Record<string, string> = {};
      for (const mint of new Set(
        [...alerts, ...events].map((row) => row.mint),
      )) {
        const preset = Object.values(presets).find((row) => row.mint === mint);
        if (preset) symbols[mint] = preset.symbol;
        else {
          const candidates = await fetchTokenSearch({
            query: mint,
            signal: controller.signal,
          });
          const token = candidates.find(
            (row) => row.token.mint === mint,
          )?.token;
          if (token) symbols[mint] = token.symbol;
        }
        p.assertCurrent();
        if (controller.signal.aborted) return;
      }
      p.assertCurrent();
      if (!controller.signal.aborted)
        setState({
          owner,
          armed: true,
          alerts,
          events,
          presets,
          symbols,
          loading: false,
          failed: false,
          unavailable: false,
          removing: null,
        });
    } catch (error) {
      if (!controller.signal.aborted) {
        try {
          p.assertCurrent();
          setState({
            ...empty,
            owner,
            armed,
            failed: armed,
            unavailable: !!(
              error &&
              typeof error === 'object' &&
              'code' in error &&
              error.code === 'disabled'
            ),
          });
        } catch {
          setState(empty);
        }
      }
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      void refresh();
      return () => {
        pending.current?.abort();
      };
    }, [refresh, proof.session, proof.locked]),
  );
  const remove = useCallback(
    async (id: string) => {
      if ((pending.current && state.loading) || state.removing) return;
      const p = ref.current;
      if (!p.session || p.locked) return;
      pending.current?.abort();
      const controller = new AbortController();
      pending.current = controller;
      setState((previous) => ({ ...previous, removing: id, failed: false }));
      try {
        await removeAlert(
          {
            walletAddress: p.session.address,
            signMessage: p.signMessage,
            assertCurrent: p.assertCurrent,
            signal: controller.signal,
          },
          id,
        );
        await removeAlertPreset(id, p.session.address);
        p.assertCurrent();
        if (!controller.signal.aborted)
          setState((previous) => ({
            ...previous,
            alerts: previous.alerts.filter((row) => row.id !== id),
            removing: null,
          }));
      } catch (error) {
        if (!controller.signal.aborted)
          setState((previous) => ({
            ...previous,
            failed: true,
            unavailable: !!(
              error &&
              typeof error === 'object' &&
              'code' in error &&
              error.code === 'disabled'
            ),
            removing: null,
          }));
      }
    },
    [state.loading, state.removing],
  );
  const current =
    state.owner === proof.session && !!proof.session && !proof.locked;
  return {
    ...(current ? state : empty),
    refresh,
    remove,
  };
}

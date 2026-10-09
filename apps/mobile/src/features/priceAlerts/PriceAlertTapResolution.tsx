import { useEffect } from 'react';
import { listAlerts, readAlertPrice } from './alertClient';
import { readAlertPresets } from './alertPresetStore';
import { fetchTokenSearch } from '../swap/fetchTokenSearch';
import { usePriceAlertProofSigner } from './usePriceAlertProofSigner';
import { resolveAlertPrefill } from './alertPrefill';
import { openAlertReview } from './alertTapEntry';
import type { CorsoSession } from '../session/types';
export type AlertTapRequest = {
  id: string;
  owner: CorsoSession;
  tappedAtMs: number;
};
export function PriceAlertTapResolution({
  request,
  finish,
}: {
  request: AlertTapRequest;
  finish(gone: boolean): void;
}) {
  const proof = usePriceAlertProofSigner();
  useEffect(() => {
    let current = true;
    const abort = new AbortController();
    const check = () => {
      proof.assertCurrent();
      if (!current || proof.session !== request.owner || proof.locked)
        throw Error('alert_tap_stale');
    };
    void (async () => {
      check();
      const alerts = await listAlerts({
        walletAddress: request.owner.address,
        signMessage: proof.signMessage,
        assertCurrent: check,
        signal: abort.signal,
      });
      check();
      const alert = alerts.find(
        (a) => a.id === request.id && a.walletAddress === request.owner.address,
      );
      if (!alert) throw Error('alert_tap_gone');
      const presets = await readAlertPresets(request.owner.address);
      check();
      const preset = presets[alert.id];
      const candidates =
        preset === undefined
          ? await fetchTokenSearch({ query: alert.mint, signal: abort.signal })
          : [];
      check();
      const fallbackToken = candidates.find(
        (row) => row.token.mint === alert.mint,
      )?.token;
      const prefill = resolveAlertPrefill({
        alert,
        walletAddress: request.owner.address,
        preset,
        fallbackToken,
        nowMs: Date.now(),
      });
      if (!prefill) throw Error('alert_tap_gone');
      const spot = await readAlertPrice(alert.mint).catch(() => null);
      check();
      await openAlertReview(
        request.owner,
        request.tappedAtMs,
        prefill,
        spot,
        check,
      );
      check();
      finish(false);
    })().catch(() => {
      if (current) finish(true);
    });
    return () => {
      current = false;
      abort.abort();
    };
  }, [request, finish]);
  return null;
}

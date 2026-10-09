import { useCallback, useEffect, useRef, useState } from 'react';
import type { View } from 'react-native';
import type { AnchorRect } from '@/src/ui/primitives/AnchoredMenu';
import type { ReportStatus } from './reportTokenPresentation';
import { hideReportedToken } from './reportedTokenStore';
import { submitTokenReport, type ReportReason } from './submitTokenReport';

/** The token the open menu is about. Null when the menu is closed. */
export type ReportTarget = {
  mint: string;
  symbol?: string | null;
  name?: string | null;
};

export type UseTokenReport = {
  visible: boolean;
  anchor: AnchorRect | null;
  status: ReportStatus;
  target: ReportTarget | null;
  /** Open the menu against a measured control or row. */
  open: (target: ReportTarget, node: View | null) => void;
  select: (reason: ReportReason) => void;
  retry: () => void;
  close: () => void;
};

/** How long the outcome line stays up before the menu closes itself. */
const OUTCOME_DWELL_MS = 1400;

export function useTokenReport(): UseTokenReport {
  const [visible, setVisible] = useState(false);
  const [anchor, setAnchor] = useState<AnchorRect | null>(null);
  const [status, setStatus] = useState<ReportStatus>('idle');
  const [target, setTarget] = useState<ReportTarget | null>(null);
  const lastReason = useRef<ReportReason | null>(null);
  const dwell = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearDwell = useCallback(() => {
    if (dwell.current !== null) {
      clearTimeout(dwell.current);
      dwell.current = null;
    }
  }, []);

  const close = useCallback(() => {
    clearDwell();
    setVisible(false);
    setStatus('idle');
    setTarget(null);
    lastReason.current = null;
  }, [clearDwell]);

  const open = useCallback(
    (next: ReportTarget, node: View | null) => {
      clearDwell();
      lastReason.current = null;
      setStatus('idle');
      setTarget(next);
      if (!node) {
        // Unmeasurable control: the menu stays closed rather than flashing at
        // the wrong place, which is the same contract `AnchoredMenu` keeps for
        // a null anchor.
        return;
      }
      node.measureInWindow((x, y, width, height) => {
        setAnchor({ x, y, width, height });
        setVisible(true);
      });
    },
    [clearDwell],
  );

  const send = useCallback(
    (reason: ReportReason, sending: ReportTarget) => {
      lastReason.current = reason;
      hideReportedToken(sending.mint);
      setStatus('sending');
      void submitTokenReport({
        mint: sending.mint,
        reason,
        name: sending.name ?? null,
        symbol: sending.symbol ?? null,
      }).then((result) => {
        setStatus(result.ok ? 'sent' : 'failed');
        if (!result.ok) return;
        clearDwell();
        dwell.current = setTimeout(close, OUTCOME_DWELL_MS);
      });
    },
    [clearDwell, close],
  );

  const select = useCallback(
    (reason: ReportReason) => {
      if (!target || status !== 'idle') return;
      send(reason, target);
    },
    [send, status, target],
  );

  // The dwell timer outlives a navigation away from the list otherwise, and
  // fires `close` into an unmounted tree.
  useEffect(() => clearDwell, [clearDwell]);

  const retry = useCallback(() => {
    const reason = lastReason.current;
    if (!target || reason === null || status === 'sending') return;
    send(reason, target);
  }, [send, status, target]);

  return { visible, anchor, status, target, open, select, retry, close };
}

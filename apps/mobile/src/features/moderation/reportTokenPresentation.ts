import { copy } from '@/constants/copy';
import { REPORT_REASONS, type ReportReason } from './submitTokenReport';

export type { ReportReason };
export { REPORT_REASONS };

/**
 * Where the report is in its life. `sent` and `failed` are both terminal and
 * both mean the pair is hidden — the difference is only whether the queue
 * heard about it, and the copy says exactly that rather than dressing a
 * failed send as a success.
 */
export type ReportStatus = 'idle' | 'sending' | 'sent' | 'failed';

export type ReportReasonRow = {
  key: ReportReason;
  label: string;
  accessibilityLabel: string;
};

export type ReportMenuView = {
  title: string;
  /** The reasons, or `[]` once a reason has been chosen. */
  reasons: readonly ReportReasonRow[];
  /** The line under the reasons: what will happen, then what did. */
  note: string;
  /** A retry row, present only after a failed send. */
  retryLabel: string | null;
  /** True while the send is in flight; the rows stop taking presses. */
  busy: boolean;
  dismissLabel: string;
};

export function resolveReportReasonRows(): ReportReasonRow[] {
  return REPORT_REASONS.map((key) => {
    const label = copy.report.reason[key];
    return { key, label, accessibilityLabel: copy.report.reasonA11y(label) };
  });
}

export function resolveReportNote(status: ReportStatus): string {
  if (status === 'sending') return copy.report.sending;
  if (status === 'sent') return copy.report.sent;
  if (status === 'failed') return copy.report.failed;
  return copy.report.note;
}

export function resolveReportMenu(status: ReportStatus): ReportMenuView {
  return {
    title: copy.report.title,
    reasons: status === 'idle' ? resolveReportReasonRows() : [],
    note: resolveReportNote(status),
    retryLabel: status === 'failed' ? copy.report.retry : null,
    busy: status === 'sending',
    dismissLabel: copy.report.close,
  };
}

/**
 * What assistive tech calls the control that opens the menu. On a row it is
 * announced as the long-press action; on token detail it is the `⋯` button.
 */
export function resolveReportA11yLabel(input: {
  symbol?: string | null;
  labelWithheld?: boolean;
}): string {
  const symbol = input.symbol?.trim() ?? '';
  if (input.labelWithheld === true || symbol.length === 0)
    return copy.report.openWithheldA11y;
  return copy.report.openA11y(symbol);
}

/**
 * The count line a list prints when this install has hidden pairs, so the
 * hide is visible rather than silent. `null` at zero: a list with nothing
 * hidden must not carry a line saying so.
 */
export function resolveReportedHiddenLine(count: number): string | null {
  if (!Number.isFinite(count) || count <= 0) return null;
  return copy.report.hiddenLine(Math.floor(count));
}

/**
 * How many of the rows a list was about to draw this install has reported.
 * The presenters filter with the set; this counts what the filter removed, so
 * the line above can be honest about a number rather than guessing one.
 */
export function countReportedIn(
  rows: ReadonlyArray<{ mint: string }>,
  reportedMints: ReadonlySet<string> | undefined,
): number {
  if (!reportedMints || reportedMints.size === 0) return 0;
  return rows.reduce(
    (count, row) => (reportedMints.has(row.mint) ? count + 1 : count),
    0,
  );
}

import type {
  DetailsSnapshot,
  ReviewWhyBlock,
  WhyCode,
  WhyLine,
  WhyResponse,
} from '@corso/why';
import { WHY_SURFACES } from '@corso/why';
import {
  WHY_COPY_BY_VERSION,
  WHY_TEMPLATE_VERSION,
  type WhyFormat,
  whyCopyV1,
} from '@/constants/copy/why';
import { formatObservationClock } from '@/src/features/home/asOfPresentation';
import { readLaunchDockBuildFlag } from '@/src/features/navigation/launchDockEnv';
import {
  feeBpsToPercentLabel,
  formatAtomicAmount,
} from '@/src/features/swap/tokens';

// ── Formatting params ──────────────────────────────────────────────────────

/** `2.10` → `2.1`, `0.40` → `0.4`, `12.00` → `12`. */
function trimDecimal(value: string): string {
  return value.includes('.') ? value.replace(/\.?0+$/, '') : value;
}

function groupThousands(integer: string): string {
  return integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export const WHY_FORMAT: WhyFormat = {
  pct: (value) => `${trimDecimal(value.replace(/^[+-]/, ''))}%`,
  signedPct: (value) => {
    const magnitude = trimDecimal(value.replace(/^[+-]/, ''));
    if (Number(magnitude) === 0) return '0%';
    return `${value.startsWith('-') ? '−' : '+'}${magnitude}%`;
  },
  share: (value) => `${trimDecimal(value)}%`,
  money: (value) => {
    const [integer, fraction = ''] = value.split('.');
    const whole = groupThousands(String(Number(integer)));
    // Whole dollars from $1,000 up; cents below it.
    if (Number(integer) >= 1000) return `$${whole}`;
    return `$${whole}.${fraction.padEnd(2, '0').slice(0, 2)}`;
  },
  ratio: (value) => trimDecimal(value),
};

// ── One line ───────────────────────────────────────────────────────────────

export type WhyLineView = {
  code: WhyCode;
  /** The template's words. */
  text: string;
  /** The small grey basis label: `Order flow · 1 day`. */
  basis: string;
};

type TemplateSet =
  (typeof WHY_COPY_BY_VERSION)[keyof typeof WHY_COPY_BY_VERSION];

function templateSet(version: number): TemplateSet | null {
  return Object.hasOwn(WHY_COPY_BY_VERSION, version)
    ? WHY_COPY_BY_VERSION[version as keyof typeof WHY_COPY_BY_VERSION]
    : null;
}

/**
 * The words for one line under template `version`, or null when that version
 * has no template for its code or no label for its basis.
 */
export function renderWhyLine(
  line: WhyLine,
  version: number = WHY_TEMPLATE_VERSION,
): WhyLineView | null {
  const set = templateSet(version);
  if (!set || !Object.hasOwn(set.lines, line.code)) return null;
  if (!Object.hasOwn(set.basis, line.source.kind)) return null;
  const template = set.lines[line.code] as (
    params: unknown,
    format: WhyFormat,
  ) => string;
  let text: string;
  try {
    text = template(line.params, WHY_FORMAT);
  } catch {
    return null;
  }
  const kind = set.basis[line.source.kind];
  const hours = line.source.windowHours;
  const window =
    hours !== null && Object.hasOwn(set.window, hours)
      ? set.window[hours as keyof typeof set.window]
      : null;
  if (hours !== null && window === null) return null;
  return {
    code: line.code,
    text,
    basis: window ? `${kind} · ${window}` : kind,
  };
}

function renderLines(lines: readonly WhyLine[], version: number) {
  return lines
    .map((line) => renderWhyLine(line, version))
    .filter((line): line is WhyLineView => line !== null);
}

// ── Review (Buy = Sell) ────────────────────────────────────────────────────

export type ReviewWhyView =
  | { kind: 'absent' }
  | { kind: 'unavailable'; title: string; line: string }
  | { kind: 'ready'; title: string; asOf: string; lines: WhyLineView[] };

/**
 * The Review tray. `null` = still loading, which renders nothing: no skeleton
 * chrome stands in for lines that may never arrive. There is no side
 * argument; Buy and Sell pass the same block and get the same view.
 */
export function presentReviewWhy(block: ReviewWhyBlock | null): ReviewWhyView {
  if (block === null || block.state === 'disabled') return { kind: 'absent' };
  const unavailable: ReviewWhyView = {
    kind: 'unavailable',
    title: whyCopyV1.title,
    line: whyCopyV1.review.unavailable,
  };
  if (block.state !== 'ready') return unavailable;
  const lines = renderLines(block.lines, WHY_TEMPLATE_VERSION).slice(
    0,
    WHY_SURFACES.review.max,
  );
  const clock = formatObservationClock(block.asOf);
  if (lines.length < WHY_SURFACES.review.min || clock === null)
    return unavailable;
  return {
    kind: 'ready',
    title: whyCopyV1.title,
    asOf: whyCopyV1.asOf(clock),
    lines,
  };
}

// ── Moving and the desk strip: one line per asset ──────────────────────────

/** The one line for `mint` in a moving/strip response, or null. */
export function oneLineFor(
  response: WhyResponse | null,
  mint: string,
): WhyLineView | null {
  if (!response || response.state !== 'ready') return null;
  const payload = response.items.find(
    (item) => item.subject.kind === 'asset' && item.subject.mint === mint,
  );
  if (!payload || payload.state !== 'ready') return null;
  const [first] = payload.lines;
  return first ? renderWhyLine(first) : null;
}

export type DeskStripView =
  | { kind: 'absent' }
  | { kind: 'unavailable'; title: string; line: string }
  | {
      kind: 'ready';
      title: string;
      asOf: string;
      cards: { mint: string; symbol: string; why: WhyLineView }[];
    };

/**
 * The Portfolio desk strip. `read` is what the why read produced:
 * `off` (flag off, or the engine said disabled) → absent; `loading` → absent;
 * `null` → the read failed. A card without a line is left out rather than
 * shown empty, and a strip with no line at all is the unavailable line.
 */
export function presentDeskStrip(
  read: 'off' | 'loading' | WhyResponse | null,
  assets: readonly { mint: string; symbol: string }[],
): DeskStripView {
  if (read === 'off' || read === 'loading') return { kind: 'absent' };
  if (read?.state === 'disabled') return { kind: 'absent' };
  const unavailable: DeskStripView = {
    kind: 'unavailable',
    title: whyCopyV1.title,
    line: whyCopyV1.strip.unavailable,
  };
  if (!read) return unavailable;
  const cards = assets.flatMap((asset) => {
    const why = oneLineFor(read, asset.mint);
    return why ? [{ ...asset, why }] : [];
  });
  const clock = formatObservationClock(read.asOf);
  if (cards.length === 0 || clock === null) return unavailable;
  return {
    kind: 'ready',
    title: whyCopyV1.title,
    asOf: whyCopyV1.asOf(clock),
    cards,
  };
}

// ── Activity "Details": the freeze ─────────────────────────────────────────

export type DetailsSeenView = {
  heading: string;
  note: string;
  /** `At Review · <clock>`; `null` when the why was not ready (no Review time). */
  capturedAt: string | null;
  quoteHeading: string;
  quote: { label: string; value: string }[];
  why:
    | { kind: 'lines'; head: string; lines: WhyLineView[] }
    | { kind: 'line'; line: string }
    | null;
};

export function presentDetailsSeen(
  snapshot: DetailsSnapshot | null,
  launchDockOn: boolean = readLaunchDockBuildFlag(),
): DetailsSeenView | null {
  if (!launchDockOn || !snapshot) return null;
  const copy = whyCopyV1.details;
  let clock: string | null = null;
  if (snapshot.capturedAt !== undefined) {
    clock = formatObservationClock(snapshot.capturedAt);
    if (clock === null) return null;
  }
  const { quote } = snapshot;
  const amount = (
    atomic: string,
    token: { decimals: number; symbol: string },
  ) => `${formatAtomicAmount(atomic, token.decimals)} ${token.symbol}`;
  const rows = [
    { label: copy.youPay, value: amount(quote.payAtomic, quote.pay) },
    {
      label: copy.youGetAbout,
      value: amount(quote.receiveAtomic, quote.receive),
    },
    {
      label: copy.youGetAtLeast,
      value: amount(quote.minReceivedAtomic, quote.receive),
    },
    { label: copy.fee, value: feeBpsToPercentLabel(quote.feeBps) },
    {
      label: copy.priceCanMove,
      value:
        quote.maxSlippageBps === null
          ? copy.priceCanMoveAuto
          : copy.priceCanMoveValue(feeBpsToPercentLabel(quote.maxSlippageBps)),
    },
  ];

  let why: DetailsSeenView['why'] = null;
  if (snapshot.why.state === 'unavailable') {
    why = { kind: 'line', line: copy.whyUnavailable };
  } else if (snapshot.why.state === 'ready') {
    const set = templateSet(snapshot.templateVersion);
    const whyClock = formatObservationClock(snapshot.why.asOf);
    const lines = set
      ? renderLines(snapshot.why.lines, snapshot.templateVersion)
      : [];
    why =
      set && whyClock !== null && lines.length === snapshot.why.lines.length
        ? {
            kind: 'lines',
            head: `${set.title} · ${set.asOf(whyClock)}`,
            lines,
          }
        : { kind: 'line', line: copy.savedWithOtherVersion };
  }

  return {
    heading: copy.heading,
    note: copy.frozenNote,
    capturedAt: clock === null ? null : copy.capturedAt(clock),
    quoteHeading: copy.quoteHeading,
    quote: rows,
    why,
  };
}

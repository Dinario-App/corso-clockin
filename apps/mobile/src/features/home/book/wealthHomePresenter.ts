import { copy } from '@/constants/copy';
import type {
  BookRow,
  BookSection,
  HomeBookModel,
  WealthMix,
  WealthMixSegment,
  WealthMixStep,
} from '@/src/ui/ethena/homeBookModel';
import {
  presentHomeBook,
  splitBookLines,
  subtotal,
  sum,
  type HomeBookRead,
  type Line,
} from './homeBookPresenter';

export type WealthHomeOptions = Readonly<{
  classes: boolean;
  doing: boolean;
}>;

/** The flag's own defaults: no class rows, How you're doing shown. */
export const WEALTH_V1_HOME_OPTIONS: WealthHomeOptions = Object.freeze({
  classes: false,
  doing: true,
});

type ClassPart = {
  key: string;
  label: string;
  step: WealthMixStep;
  lines: readonly Line[];
};

export function presentWealthHome(
  read: HomeBookRead,
  nowMs: number,
  options: WealthHomeOptions = WEALTH_V1_HOME_OPTIONS,
): HomeBookModel {
  // The base Book, with the flag-off launch-dock relabel left out: the
  // sleeve section folds into Crypto here.
  const base = presentHomeBook(read, nowMs, false);
  const t = copy.wealthV1.home;
  if (base.sections === null) {
    return { ...base, wealth: { doing: null, mix: null } };
  }
  if (base.state === 'loading') {
    return {
      ...base,
      sections: base.sections
        .filter((section) => section.key === 'cash' || section.key === 'majors')
        .map((section) =>
          section.key === 'majors' ? { ...section, label: t.crypto } : section,
        ),
      wealth: { doing: null, mix: null },
    };
  }
  if (base.newBookLine !== null) {
    // The zero book: the shipped new-book card, and nothing else.
    return {
      ...base,
      sections: base.sections.filter((section) => section.key === 'majors'),
      wealth: { doing: null, mix: null },
    };
  }

  const { cash, majors, sleeve } = splitBookLines(read);
  const crypto = [...majors, ...sleeve];
  const all = [...cash, ...crypto];
  const anyUnpriced = all.some((entry) => entry.cents === null);
  const total = sum(all);
  // ⛔ A partial book is not a denominator (the base presenter's rule).
  const shareOf = anyUnpriced || total === 0n ? null : total;

  const byKey = new Map(base.sections.map((section) => [section.key, section]));
  const cashSection = byKey.get('cash') as BookSection;
  const majorsSection = byKey.get('majors') as BookSection;
  // The base Book's third section: everything not cash and not a major.
  const otherRows = base.sections
    .filter((section) => section.key !== 'cash' && section.key !== 'majors')
    .flatMap((section) => section.rows);

  const parts: ClassPart[] = [
    { key: 'cash', label: copy.homeBook.cash, step: 0, lines: cash },
    { key: 'crypto', label: t.crypto, step: 1, lines: crypto },
  ];
  const mix = presentMix(parts, anyUnpriced, total);
  // A block's share is the mix's own (largest remainder), so `62%` over a
  // block and `Cash 62%` in the legend never disagree. An empty block is `$0`.
  const blockSubtotal = (part: ClassPart) => {
    const dollars = subtotal(part.lines, null);
    const percent =
      shareOf === null || mix?.kind !== 'ready'
        ? null
        : mix.segments.find((segment) => segment.key === part.key)?.percent;
    return percent == null ? dollars : `${dollars} · ${percent}%`;
  };

  const sections: BookSection[] = [
    {
      ...cashSection,
      subtotal: blockSubtotal(parts[0]),
      rows: cashSection.rows.map(cashTickerRow),
    },
    {
      key: 'majors',
      label: t.crypto,
      subtotal: blockSubtotal(parts[1]),
      rows: [...majorsSection.rows, ...otherRows.map(otherHoldingsRow)],
      emptyLine: t.emptyCrypto,
    },
  ];
  if (options.classes) {
    sections.push({
      key: 'gold',
      label: t.gold,
      subtotal: '',
      status: t.classNotYet,
      rows: [],
      emptyLine: null,
    });
  }

  const doing = options.doing
    ? {
        title: t.doingTitle,
        rows: [
          { key: 'paid', label: t.doingPaid, value: t.doingUnavailable },
          {
            key: 'worth',
            label: t.doingWorthNow,
            // A partial book has no worth-now figure (the total's own rule).
            value: anyUnpriced ? t.doingUnavailable : subtotal(all, null),
          },
        ],
      }
    : null;

  return {
    ...base,
    sections,
    wealth: { doing, mix },
  };
}

function cashTickerRow(row: BookRow): BookRow {
  return row.symbol === 'USDC' ? { ...row, sub: row.symbol } : row;
}

function otherHoldingsRow(row: BookRow): BookRow {
  return {
    ...row,
    name: copy.homeBook.sleeve,
    // The partial caveat, when there is one, outranks the count.
    sub: row.sub ?? row.name,
  };
}

function presentMix(
  parts: readonly ClassPart[],
  anyUnpriced: boolean,
  total: bigint,
): WealthMix | null {
  const t = copy.wealthV1.home;
  if (anyUnpriced) {
    return { kind: 'unavailable', title: t.mixTitle, line: t.mixUnavailable };
  }
  if (total === 0n) return null;
  const held = parts
    .map((part) => ({ part, cents: sum(part.lines) }))
    .filter((entry) => entry.cents > 0n);
  const percents = wholePercents(
    held.map((entry) => entry.cents),
    total,
  );
  const segments: WealthMixSegment[] = held.map((entry, index) => ({
    key: entry.part.key,
    step: entry.part.step,
    percent: percents[index],
  }));
  return {
    kind: 'ready',
    title: t.mixTitle,
    segments,
    legend: held.map((entry, index) => ({
      key: entry.part.key,
      step: entry.part.step,
      text: t.mixLegend(entry.part.label, String(percents[index])),
    })),
  };
}

/**
 * Whole percents that sum to exactly 100 (largest remainder): floors first,
 * then the leftover points go to the largest remainders, ties to the earlier
 * class. Every held class shows at least 1%, so nothing held reads as none.
 */
export function wholePercents(
  parts: readonly bigint[],
  total: bigint,
): number[] {
  if (parts.length === 0 || total <= 0n) return [];
  const floors = parts.map((part) => (part * 100n) / total);
  const remainders = parts.map((part) => (part * 100n) % total);
  let left = 100n - floors.reduce((acc, floor) => acc + floor, 0n);
  const order = parts
    .map((_, index) => index)
    .sort((a, b) =>
      remainders[a] === remainders[b]
        ? a - b
        : remainders[a] > remainders[b]
          ? -1
          : 1,
    );
  const out = floors.map((floor) => Number(floor));
  for (const index of order) {
    if (left <= 0n) break;
    out[index] += 1;
    left -= 1n;
  }
  // A held class never rounds to 0%: borrow the point from the largest.
  for (let index = 0; index < out.length; index += 1) {
    if (out[index] > 0) continue;
    const largest = out.indexOf(Math.max(...out));
    out[largest] -= 1;
    out[index] = 1;
  }
  return out;
}

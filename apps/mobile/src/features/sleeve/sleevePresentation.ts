import { copy } from '@/constants/copy';
import type {
  FiatLineResult,
  HoldingLine,
} from '@/src/features/balances/computeFiatTotal';
import { classifyHolding } from '@/src/features/balances/majors';
import {
  formatCents,
  type HomeBookRead,
} from '@/src/features/home/book/homeBookPresenter';
import { formatAtomicAmount } from '@/src/features/swap/tokens';
import { formatCompactTokenAmount } from '@/src/ui/format/numberCraft';

export type SleeveState = 'loading' | 'refused' | 'empty' | 'partial' | 'ready';

export type SleeveRow = {
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
  quantity: string | null;
  /** `null` when this token has no price. Never `$0` for an unpriced token. */
  value: string | null;
};

export type SleeveModel = {
  state: SleeveState;
  title: string;
  eyebrow: string | null;
  /** `null` when the read was refused. Otherwise one line, including `$0.00`. */
  hero: string | null;
  refusedMessage: string | null;
  keepSmall: string | null;
  holdingsLabel: string;
  countLabel: string | null;
  rows: readonly SleeveRow[];
  findToken: { label: string; disabled: boolean };
  sell: { label: string; shown: boolean; disabled: boolean };
  note: string | null;
};

export function presentSleeve(
  read: HomeBookRead,
  nowMs: number,
  options?: { swapsOff?: boolean },
): SleeveModel {
  const swapsOff = options?.swapsOff === true;
  if (
    read.holdings &&
    (read.holdings.quantityStatus === 'error' ||
      read.holdings.quantityStatus === 'partial')
  ) {
    return refused(swapsOff);
  }
  if (
    read.status === 'loading' ||
    read.holdings == null ||
    read.holdings.quantityStatus === 'loading'
  ) {
    return loading(swapsOff);
  }

  const priced = new Map(read.result.lines.map((line) => [line.mint, line]));
  const rows: Array<SleeveRow & { cents: bigint | null }> = [];
  for (const line of read.holdings.lines) {
    if (!isHeld(line)) continue;
    if (classifyHolding(line, read.holdings.cluster) !== 'sleeve') continue;
    const cents = centsOf(priced.get(line.mint));
    rows.push({
      mint: line.mint,
      symbol: line.symbol,
      name: line.symbol,
      decimals: line.decimals,
      quantity: quantity(line),
      value: cents === null ? null : formatCents(cents),
      cents,
    });
  }
  rows.sort((a, b) => {
    const left = a.cents ?? -1n;
    const right = b.cents ?? -1n;
    if (left === right) return 0;
    return left > right ? -1 : 1;
  });

  const visible = rows.map(({ cents: _cents, ...row }) => row);
  const base = frame(swapsOff, visible);
  if (read.stale) {
    base.note = staleNote(read.staleAsOfMs, nowMs) ?? base.note;
  }
  if (visible.length === 0) {
    return {
      ...base,
      state: 'empty',
      eyebrow: copy.sleeve.valueEyebrow,
      hero: formatCents(0n),
      keepSmall: copy.sleeve.keepSmall,
      sell: { ...base.sell, shown: false },
    };
  }

  const unpriced = rows.filter((row) => row.cents === null);
  const pricedRows = rows.filter(
    (row): row is typeof row & { cents: bigint } => row.cents !== null,
  );
  if (unpriced.length > 0) {
    return {
      ...base,
      state: 'partial',
      eyebrow: copy.sleeve.valuePartial,
      hero:
        pricedRows.length === 0
          ? copy.homeBook.notPriced
          : formatCents(pricedRows.reduce((sum, row) => sum + row.cents, 0n)),
      keepSmall: copy.sleeve.keepSmall,
    };
  }
  return {
    ...base,
    state: 'ready',
    eyebrow: copy.sleeve.valueEyebrow,
    hero: formatCents(rows.reduce((sum, row) => sum + (row.cents ?? 0n), 0n)),
    keepSmall: copy.sleeve.keepSmall,
  };
}

/** One line. Shrinks so a font-scale 2 hero does not wrap mid-number. */
export function sleeveHeroFontSize(args: {
  text: string;
  fontScale: number;
  screenWidth: number;
}): number {
  const width = Math.max(0, args.screenWidth - 64);
  const scale =
    Number.isFinite(args.fontScale) && args.fontScale > 0 ? args.fontScale : 1;
  let size = 40 * scale;
  while (size > 11 && args.text.length * size * 0.7 > width) size -= 0.5;
  return size;
}

function frame(swapsOff: boolean, rows: readonly SleeveRow[]): SleeveModel {
  return {
    state: 'ready',
    title: copy.sleeve.title,
    eyebrow: null,
    hero: null,
    refusedMessage: null,
    keepSmall: null,
    holdingsLabel: copy.sleeve.holdings,
    countLabel: rows.length > 0 ? copy.homeBook.assets(rows.length) : null,
    rows,
    findToken: { label: copy.sleeve.findToken, disabled: swapsOff },
    sell: {
      label: copy.assetDetail.sell,
      shown: true,
      disabled: swapsOff,
    },
    note: swapsOff ? copy.majorDetail.swapsUnavailable : null,
  };
}

function loading(swapsOff: boolean): SleeveModel {
  return {
    ...frame(true, []),
    state: 'loading',
    eyebrow: copy.sleeve.valueEyebrow,
    hero: copy.homeBook.placeholder,
    findToken: { label: copy.sleeve.findToken, disabled: true },
    sell: { label: copy.assetDetail.sell, shown: true, disabled: true },
    note: swapsOff ? copy.majorDetail.swapsUnavailable : null,
  };
}

function refused(swapsOff: boolean): SleeveModel {
  return {
    ...frame(swapsOff, []),
    state: 'refused',
    refusedMessage: copy.homeBook.unavailable,
    sell: { label: copy.assetDetail.sell, shown: true, disabled: true },
    findToken: { label: copy.sleeve.findToken, disabled: swapsOff },
  };
}

function isHeld(line: HoldingLine): boolean {
  try {
    return BigInt(line.atomic) > 0n;
  } catch {
    return false;
  }
}

function centsOf(result: FiatLineResult | undefined): bigint | null {
  if (!result?.priced || result.fiatAmount == null) return null;
  const match = /^(\d+)\.(\d{2})$/.exec(result.fiatAmount);
  if (!match) return null;
  return BigInt(match[1]) * 100n + BigInt(match[2]);
}

function quantity(line: HoldingLine): string | null {
  let atomic: bigint;
  try {
    atomic = BigInt(line.atomic);
  } catch {
    return null;
  }
  const text = formatAtomicAmount(atomic.toString(), line.decimals);
  return formatCompactTokenAmount(text)?.compact ?? null;
}

function staleNote(asOfMs: number | null, nowMs: number): string | null {
  if (asOfMs === null) return null;
  const minutes = Math.floor(Math.max(0, nowMs - asOfMs) / 60_000);
  const age =
    minutes < 1
      ? copy.homeBook.ageUnderMinute
      : minutes < 60
        ? copy.homeBook.ageMinutes(minutes)
        : copy.homeBook.ageHours(Math.floor(minutes / 60));
  return copy.homeBook.asOf(age);
}

import { copy } from '@/constants/copy';
import { classifyHolding, getMajorAsset } from '@/src/features/balances/majors';
import { readLaunchDockBuildFlag } from '@/src/features/navigation/launchDockEnv';
import type {
  FiatLineResult,
  FiatTotalStatus,
  HoldingLine,
  HoldingsSnapshot,
} from '@/src/features/balances/computeFiatTotal';
import { walletTotalCaveat } from '@/src/features/balances/walletHoldings';
import {
  formatCompactTokenAmount,
  groupDecimalDigits,
} from '@/src/ui/format/numberCraft';
import type {
  BookHero,
  BookMark,
  BookRow,
  BookSection,
  HomeBookModel,
  HomeBookState,
} from '@/src/ui/ethena/homeBookModel';

export const MAX_MAJOR_ROWS = 5;

/** The slice of `FiatTotalState` the Book reads. Nothing else. */
export type HomeBookRead = {
  status: FiatTotalStatus;
  result: { lines: readonly FiatLineResult[] };
  holdings: HoldingsSnapshot | null;
  /** A known-good total held across a later failed read. */
  stale: boolean;
  staleAsOfMs: number | null;
};

type Line = {
  line: HoldingLine;
  /** Cents, or `null` when this line has no price. */
  cents: bigint | null;
};

const MAJOR_MARKS: Readonly<Record<string, { glyph: string; mark: BookMark }>> =
  {
    SOL: { glyph: '◎', mark: 'sol' },
    cbBTC: { glyph: '₿', mark: 'btc' },
    ETH: { glyph: 'Ξ', mark: 'eth' },
  };

export function presentHomeBook(
  read: HomeBookRead,
  nowMs: number,
  launchDock: boolean = readLaunchDockBuildFlag(),
): HomeBookModel {
  const model = presentBook(read, nowMs);
  if (!launchDock || !model.sections) return model;
  return {
    ...model,
    sections: model.sections.map((section) =>
      section.key === 'sleeve'
        ? { ...section, label: copy.launchDock.locked.otherHoldings }
        : section,
    ),
  };
}

function presentBook(read: HomeBookRead, nowMs: number): HomeBookModel {
  const t = copy.homeBook;
  const heldSnapshot = read.holdings?.quantityStatus === 'ready';

  if (read.stale && heldSnapshot) {
    return bookFrom(read, 'stale', staleNote(read.staleAsOfMs, nowMs));
  }
  if (read.status === 'loading' || (read.stale && !heldSnapshot)) {
    return loading();
  }
  if (read.status === 'unavailable' && !heldSnapshot) {
    return {
      state: 'unavailable',
      hero: { kind: 'unavailable', message: t.unavailable },
      newBookLine: null,
      sections: null,
    };
  }
  if (read.status === 'zero') {
    return { ...bookFrom(read, 'new', null), newBookLine: t.newBook };
  }
  if (read.status === 'partially_priced' || read.status === 'unavailable') {
    // `unavailable` over a COMPLETE quantity read means nothing could be
    // priced — the balance was read, the prices were not. That is a partial
    // book with no priced part, not a refused read.
    return bookFrom(read, 'partial', null);
  }
  return bookFrom(read, 'book', null);
}

function loading(): HomeBookModel {
  const t = copy.homeBook;
  return {
    state: 'loading',
    hero: { kind: 'loading', eyebrow: t.eyebrow, placeholder: t.placeholder },
    newBookLine: null,
    sections: (['cash', 'majors', 'sleeve'] as const).map((key) => ({
      key,
      label: t[key],
      subtotal: t.placeholder,
      rows: [],
      emptyLine: null,
    })),
  };
}

function bookFrom(
  read: HomeBookRead,
  requested: Exclude<HomeBookState, 'loading' | 'unavailable' | 'cashOnly'>,
  note: string | null,
): HomeBookModel {
  const t = copy.homeBook;
  const holdings = read.holdings as HoldingsSnapshot;
  const priced = new Map(read.result.lines.map((l) => [l.mint, l]));

  const cash: Line[] = [];
  const majors: Line[] = [];
  const sleeve: Line[] = [];
  for (const line of holdings.lines) {
    if (!isHeld(line)) continue;
    const section = classifyHolding(line, holdings.cluster);
    if (section === 'hidden') continue;
    const entry = { line, cents: centsOf(priced.get(line.mint)) };
    if (section === 'cash') cash.push(entry);
    else if (section === 'major') majors.push(entry);
    else sleeve.push(entry);
  }

  const all = [...cash, ...majors, ...sleeve];
  const anyUnpriced = all.some((entry) => entry.cents === null);
  const state: HomeBookState =
    requested === 'book' && anyUnpriced
      ? 'partial'
      : requested === 'book' && majors.length === 0 && sleeve.length === 0
        ? 'cashOnly'
        : requested;
  const partial = state === 'partial' || anyUnpriced;
  const total = sum(all);
  const shareOf = partial || total === 0n ? null : total;

  const sections: BookSection[] = [
    {
      key: 'cash',
      label: t.cash,
      subtotal: subtotal(cash, shareOf),
      rows: cash.length === 0 ? [] : [cashRow(cash)],
      emptyLine: t.emptyCash,
    },
    {
      key: 'majors',
      label: t.majors,
      subtotal: subtotal(majors, shareOf),
      rows: [...majors]
        .sort(largestFirst)
        .slice(0, MAX_MAJOR_ROWS)
        .map(majorRow),
      emptyLine: t.emptyMajors,
    },
    {
      key: 'sleeve',
      label: t.sleeve,
      subtotal: subtotal(sleeve, shareOf),
      rows: sleeve.length === 0 ? [] : [sleeveRow(sleeve)],
      emptyLine: t.emptySleeve,
    },
  ];

  const pricedAny = all.some((entry) => entry.cents !== null);
  const hero: BookHero =
    partial && !pricedAny
      ? {
          kind: 'value',
          eyebrow: t.eyebrowPartial,
          amount: t.notPriced,
          cents: null,
          note,
          delta: null,
        }
      : {
          kind: 'value',
          eyebrow: partial ? t.eyebrowPartial : t.eyebrow,
          ...splitDollars(total),
          note,
          delta: null,
        };

  return { state, hero, newBookLine: null, sections };
}

/** A line with nothing in it is not a holding (walletHoldings keeps SOL at 0). */
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

function sum(lines: readonly Line[]): bigint {
  return lines.reduce((acc, entry) => acc + (entry.cents ?? 0n), 0n);
}

function largestFirst(a: Line, b: Line): number {
  // Unpriced rows sink below priced ones; ties keep the read's order.
  const av = a.cents ?? -1n;
  const bv = b.cents ?? -1n;
  return av === bv ? 0 : av > bv ? -1 : 1;
}

/** `$3,120.42` — floored to the cent (the read already is). */
export function formatCents(cents: bigint): string {
  const whole = cents / 100n;
  const minor = (cents % 100n).toString().padStart(2, '0');
  return `$${groupDecimalDigits(whole.toString())}.${minor}`;
}

function splitDollars(cents: bigint): { amount: string; cents: string } {
  const full = formatCents(cents);
  const dot = full.lastIndexOf('.');
  return { amount: full.slice(0, dot), cents: full.slice(dot) };
}

/** `$3,120 · 25%`; whole dollars, floored, so a subtotal never overstates. */
function subtotal(lines: readonly Line[], shareOf: bigint | null): string {
  if (lines.length > 0 && lines.every((entry) => entry.cents === null))
    return copy.homeBook.notPriced;
  const part = sum(lines);
  const dollars = `$${groupDecimalDigits((part / 100n).toString())}`;
  if (shareOf === null) return dollars;
  const percent = (part * 100n) / shareOf;
  return `${dollars} · ${percent}%`;
}

function quantity(line: HoldingLine): string | null {
  const atomic = BigInt(line.atomic);
  const scale = 10n ** BigInt(line.decimals);
  const whole = atomic / scale;
  const fraction = (atomic % scale)
    .toString()
    .padStart(line.decimals, '0')
    .replace(/0+$/, '');
  const decimal = fraction ? `${whole}.${fraction}` : whole.toString();
  return formatCompactTokenAmount(decimal)?.compact ?? null;
}

function cashRow(lines: readonly Line[]): BookRow {
  const symbols = lines.map((entry) => entry.line.symbol);
  const unpriced = lines.some((entry) => entry.cents === null);
  return {
    key: 'cash',
    glyph: '$',
    mark: symbols.length === 1 && symbols[0] === 'USDC' ? 'usdc' : 'none',
    symbol: symbols.length === 1 ? symbols[0] : null,
    mint: lines.length === 1 ? lines[0].line.mint : null,
    name: symbols.join(' · '),
    sub: lines.length === 1 ? quantity(lines[0].line) : null,
    value: unpriced ? null : formatCents(sum(lines)),
    opens: null,
  };
}

function majorRow(entry: Line): BookRow {
  const asset = getMajorAsset(entry.line.mint);
  const symbol = asset?.symbol ?? entry.line.symbol;
  const look = MAJOR_MARKS[symbol] ?? {
    glyph: symbol.slice(0, 1),
    mark: 'none' as const,
  };
  const amount = quantity(entry.line);
  return {
    key: entry.line.mint,
    glyph: look.glyph,
    mark: look.mark,
    symbol,
    mint: entry.line.mint,
    name: asset?.displayName ?? symbol,
    sub: amount ? `${amount} ${symbol}` : symbol,
    value: entry.cents === null ? null : formatCents(entry.cents),
    opens: { kind: 'major', mint: entry.line.mint },
  };
}

function sleeveRow(lines: readonly Line[]): BookRow {
  const unpriced = lines.filter((entry) => entry.cents === null).length;
  const pricedAny = unpriced < lines.length;
  return {
    key: 'sleeve',
    glyph: 'S',
    mark: 'none',
    name: copy.homeBook.assets(lines.length),
    sub: walletTotalCaveat(unpriced),
    value: pricedAny ? formatCents(sum(lines)) : null,
    opens: { kind: 'sleeve' },
  };
}

function staleNote(asOfMs: number | null, nowMs: number): string | null {
  if (asOfMs === null) return null;
  const t = copy.homeBook;
  const minutes = Math.floor(Math.max(0, nowMs - asOfMs) / 60_000);
  const age =
    minutes < 1
      ? t.ageUnderMinute
      : minutes < 60
        ? t.ageMinutes(minutes)
        : t.ageHours(Math.floor(minutes / 60));
  return t.asOf(age);
}

export function resolveBookName(stored: string | null): string {
  const name = stored?.trim();
  return name ? name : copy.homeBook.defaultName;
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .map((word) => Array.from(word.replace(/[^\p{L}\p{N}]/gu, ''))[0])
    .filter((letter): letter is string => Boolean(letter))
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/** The nav disc: up to two initials. A name with no letters uses the default name. */
export function bookInitials(name: string): string {
  return initialsOf(name) || initialsOf(copy.homeBook.defaultName);
}

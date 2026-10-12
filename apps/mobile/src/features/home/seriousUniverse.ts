import type { HoldingLine } from '@/src/features/balances/computeFiatTotal';
import type { BuyPickerRow } from '@/src/features/home/buy/buyPickerPresentation';
import { MAX_MAJOR_ROWS } from '@/src/features/home/book/homeBookPresenter';
import type { BookName, HomeBookModel } from '@/src/ui/ethena/homeBookModel';

/** Stated cap on names carried for Majors: the same bound as held majors. */
export const MAX_SERIOUS_NAMES = MAX_MAJOR_ROWS;

export type SeriousName = {
  mint: string;
  name: string;
  symbol: string;
};

/** Names the serious-universe route already geo-gated. Malformed rows drop. */
export function parseSeriousUniverse(body: unknown): SeriousName[] {
  if (body == null || typeof body !== 'object' || Array.isArray(body)) {
    return [];
  }
  const names = (body as { names?: unknown }).names;
  if (!Array.isArray(names)) return [];
  const parsed: SeriousName[] = [];
  for (const value of names) {
    if (value == null || typeof value !== 'object' || Array.isArray(value)) {
      continue;
    }
    const row = value as Record<string, unknown>;
    if (
      typeof row.mint !== 'string' ||
      typeof row.name !== 'string' ||
      typeof row.symbol !== 'string'
    ) {
      continue;
    }
    const name = row.name.trim();
    const symbol = row.symbol.trim();
    if (name.length === 0 || symbol.length === 0) continue;
    parsed.push({ mint: row.mint, name, symbol });
  }
  return parsed;
}

/**
 * One majors-table row as the Buy picker draws it (`presentBuyPicker`): the
 * table's display name and symbol, and the Today card's price and 24h.
 */
export type MajorsTableRow = Pick<
  BuyPickerRow,
  'mint' | 'name' | 'symbol' | 'price' | 'change'
>;

export function withSeriousMajorNames(
  model: HomeBookModel,
  names: readonly SeriousName[],
  holdings: readonly Pick<HoldingLine, 'mint' | 'symbol' | 'atomic'>[] | undefined,
  table: readonly MajorsTableRow[],
): HomeBookModel {
  if (model.sections == null || names.length === 0) return model;
  const served = new Set(names.map((name) => name.mint));
  const heldLines = (holdings ?? []).filter((line) => {
    try {
      return BigInt(line.atomic) > 0n;
    } catch {
      return false;
    }
  });
  let changed = false;
  const sections = model.sections.map((section) => {
    if (section.key !== 'majors') return section;
    const held = new Set([
      ...section.rows.flatMap((row) => [row.key, row.mint].filter(Boolean)),
      ...heldLines.map((line) => line.mint),
    ]);
    const symbols = new Set([
      ...section.rows.map((row) => row.symbol),
      ...heldLines.map((line) => line.symbol),
    ]);
    const extra = table
      .filter((row) => {
        if (!served.has(row.mint)) return false;
        if (held.has(row.mint) || symbols.has(row.symbol)) return false;
        symbols.add(row.symbol);
        return true;
      })
      .slice(0, Math.max(0, MAX_SERIOUS_NAMES - section.rows.length))
      .map(bookName);
    if (extra.length === 0) return section;
    changed = true;
    return { ...section, names: extra };
  });
  if (!changed) return model;
  return { ...model, sections };
}

function bookName(row: MajorsTableRow): BookName {
  return {
    key: row.mint,
    mint: row.mint,
    name: row.name,
    symbol: row.symbol,
    price: row.price,
    change: row.change,
  };
}

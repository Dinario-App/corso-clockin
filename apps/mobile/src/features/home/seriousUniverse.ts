import type { HoldingLine } from '@/src/features/balances/computeFiatTotal';
import { getMajorAsset } from '@/src/features/balances/majors';
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

export function withSeriousMajorNames(
  model: HomeBookModel,
  names: readonly SeriousName[],
  holdings: readonly Pick<HoldingLine, 'mint' | 'symbol' | 'atomic'>[] = [],
): HomeBookModel {
  if (model.sections == null || names.length === 0) return model;
  const heldLines = holdings.filter((line) => {
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
    const extra = names
      .filter((name) => {
        if (held.has(name.mint) || symbols.has(name.symbol)) return false;
        symbols.add(name.symbol);
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

export const A17_RENAMED_MINT = '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs';

/**
 * Applied AFTER dedupe and the cap, so the rename never changes which names
 * survive: the symbol dedupe still sees the payload's own symbols, as on main.
 */
function bookName(name: SeriousName): BookName {
  const renamed =
    name.mint === A17_RENAMED_MINT ? getMajorAsset(name.mint) : undefined;
  return {
    key: name.mint,
    mint: name.mint,
    name: renamed?.displayName ?? name.name,
    symbol: renamed?.symbol ?? name.symbol,
  };
}

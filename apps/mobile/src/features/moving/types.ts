export const MOVING_ROW_COUNT = 10;

/**
 * Which number the third column holds. A closed set: the client renders the
 * kinds it knows and treats anything else as unavailable, because a number
 * whose meaning the client cannot name is a number it must not label.
 */
export const MOVING_NUMBER_KINDS = ['change24hPct'] as const;

export type MovingNumberKind = (typeof MOVING_NUMBER_KINDS)[number];

export type MovingRow = {
  symbol: string;
  mint: string;
  /** Decimal string. Money never crosses a wire as a float. */
  priceUsd: string;
  numberKind: MovingNumberKind;
  /** Signed decimal string, sign always written. `+2.41`, `-0.87`. */
  numberValue: string;
};

export type MovingSnapshot = {
  status: 'ready';
  asOfMs: number;
  rows: MovingRow[];
};

/**
 * Symbols arrive from a vendor and render only as React Native text. Punctuation
 * and visible Unicode are legitimate token identity (`D&J`, emoji) and are
 * preserved byte-for-byte; React Native escapes text rather than interpreting
 * it as markup. Whitespace, invisible controls, and paragraph-length values are
 * malformed row data and are rejected.
 */
export const MAX_MOVING_SYMBOL_LENGTH = 24;
const MOVING_SYMBOL_FORBIDDEN =
  /[\s\u0000-\u001F\u007F-\u009F\u200B-\u200F\u2028-\u202E\u2060-\u206F\uFEFF]/u;

export function isMovingSymbol(symbol: string): boolean {
  const length = Array.from(symbol).length;
  return (
    length > 0 &&
    length <= MAX_MOVING_SYMBOL_LENGTH &&
    !MOVING_SYMBOL_FORBIDDEN.test(symbol)
  );
}

/** A mint is both the row identity and the dynamic Asset-route parameter. */
export const MOVING_MINT_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/** Bounded so a hostile payload cannot render a paragraph into a row. */
const MAX_NUMERIC_TEXT_LENGTH = 24;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function readDecimal(value: unknown, pattern: RegExp): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_NUMERIC_TEXT_LENGTH) {
    return null;
  }
  return pattern.test(trimmed) ? trimmed : null;
}

const UNSIGNED_DECIMAL = /^\d+(\.\d+)?$/;
const SIGNED_DECIMAL = /^[+-]\d+(\.\d+)?$/;

export function parseMovingRow(value: unknown): MovingRow | null {
  if (!isPlainObject(value)) return null;

  const symbol = typeof value.symbol === 'string' ? value.symbol : '';
  if (!isMovingSymbol(symbol)) return null;

  const mint = typeof value.mint === 'string' ? value.mint.trim() : '';
  if (!MOVING_MINT_PATTERN.test(mint)) return null;

  const priceUsd = readDecimal(value.priceUsd, UNSIGNED_DECIMAL);
  if (priceUsd == null) return null;

  const numberKind = value.numberKind;
  if (
    typeof numberKind !== 'string' ||
    !(MOVING_NUMBER_KINDS as readonly string[]).includes(numberKind)
  ) {
    return null;
  }

  const numberValue = readDecimal(value.numberValue, SIGNED_DECIMAL);
  if (numberValue == null) return null;

  return {
    symbol,
    mint,
    priceUsd,
    numberKind: numberKind as MovingNumberKind,
    numberValue,
  };
}

export function parseMovingSnapshot(raw: unknown): MovingSnapshot | null {
  if (!isPlainObject(raw)) return null;
  if (raw.schemaVersion !== 1) return null;
  if (raw.status !== 'ready') return null;
  if (typeof raw.asOfMs !== 'number' || !Number.isFinite(raw.asOfMs)) return null;
  if (raw.asOfMs < 0) return null;
  if (!Array.isArray(raw.rows)) return null;
  if (raw.rows.length > MOVING_ROW_COUNT) return null;

  const rows: MovingRow[] = [];
  const seenMints = new Set<string>();
  const seenSymbols = new Set<string>();
  for (const entry of raw.rows) {
    const row = parseMovingRow(entry);
    if (row == null) continue;
    const symbolKey = row.symbol.toUpperCase();
    if (seenMints.has(row.mint) || seenSymbols.has(symbolKey)) continue;
    seenMints.add(row.mint);
    seenSymbols.add(symbolKey);
    rows.push(row);
  }

  if (rows.length === 0) return null;
  return { status: 'ready', asOfMs: raw.asOfMs, rows };
}

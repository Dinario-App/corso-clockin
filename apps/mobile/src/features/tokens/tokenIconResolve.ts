import fixture from './tokenIconFixture.json';
import {
  normalizeTokenMarkDisplayLabel,
  normalizeTokenMarkTicker,
} from '@/src/ui/primitives/tokenMarkPresentation';

/** Disc shows the locked two-letter monogram. */
export const TOKEN_ICON_MONOGRAM = 0;
/** Disc shows a fixture image. */
export const TOKEN_ICON_IMAGE = 1;
/** Raster bytes Image can decode (png, jpeg, webp, gif). */
export const TOKEN_ICON_RASTER = 0;
/** SVG bytes. Image does not decode these; SvgUri does. */
export const TOKEN_ICON_SVG = 1;

export type TokenIconResolution =
  | {
      kind: typeof TOKEN_ICON_MONOGRAM;
      label: string;
    }
  | {
      kind: typeof TOKEN_ICON_IMAGE;
      uri: string;
      format: typeof TOKEN_ICON_RASTER | typeof TOKEN_ICON_SVG;
      label: string;
    };

type Admitted = {
  mint: string;
  symbolKey: string;
  symbol: string;
  uri: string;
  format: typeof TOKEN_ICON_RASTER | typeof TOKEN_ICON_SVG;
};

type Index = {
  byMint: ReadonlyMap<string, Admitted>;
  bySymbol: ReadonlyMap<string, Admitted>;
};

type RawRow = {
  mint?: unknown;
  symbol?: unknown;
  icon?: unknown;
  format?: unknown;
};

/**
 * A fixture icon is usable only when it is an https URL with no credentials.
 * The format tag selects the decoder. Anything else is not an image source.
 */
export function admitTokenIcon(
  icon: unknown,
  format: unknown,
): {
  uri: string;
  format: typeof TOKEN_ICON_RASTER | typeof TOKEN_ICON_SVG;
} | null {
  if (typeof icon !== 'string' || typeof format !== 'string') return null;
  let url: URL;
  try {
    url = new URL(icon);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  if (url.username !== '' || url.password !== '') return null;
  if (url.hostname.length === 0) return null;
  const decoded =
    format === 'svg'
      ? TOKEN_ICON_SVG
      : format === 'raster'
        ? TOKEN_ICON_RASTER
        : null;
  if (decoded === null) return null;
  return { uri: icon, format: decoded };
}

function admitRow(raw: RawRow): Admitted | null {
  if (typeof raw.mint !== 'string' || raw.mint.length === 0) return null;
  if (typeof raw.symbol !== 'string' || raw.symbol.length === 0) return null;
  const icon = admitTokenIcon(raw.icon, raw.format);
  if (icon === null) return null;
  return {
    mint: raw.mint,
    symbol: raw.symbol,
    symbolKey: raw.symbol.toUpperCase(),
    uri: icon.uri,
    format: icon.format,
  };
}

/**
 * One row per mint and one row per uppercased symbol. A repeated key drops
 * every row that shares it, so a collision cannot pick a logo.
 */
export function indexTokenIcons(rows: readonly RawRow[]): Index {
  const byMint = new Map<string, Admitted>();
  const bySymbol = new Map<string, Admitted>();
  const mintClash = new Set<string>();
  const symbolClash = new Set<string>();
  for (const raw of rows) {
    const row = admitRow(raw);
    if (row === null) continue;
    if (mintClash.has(row.mint)) continue;
    if (byMint.has(row.mint)) {
      byMint.delete(row.mint);
      mintClash.add(row.mint);
    } else {
      byMint.set(row.mint, row);
    }
  }
  for (const row of byMint.values()) {
    if (symbolClash.has(row.symbolKey)) continue;
    if (bySymbol.has(row.symbolKey)) {
      bySymbol.delete(row.symbolKey);
      symbolClash.add(row.symbolKey);
    } else {
      bySymbol.set(row.symbolKey, row);
    }
  }
  return { byMint, bySymbol };
}

const LIVE = indexTokenIcons(fixture.rows);

function asImage(row: Admitted): TokenIconResolution {
  return {
    kind: TOKEN_ICON_IMAGE,
    uri: row.uri,
    format: row.format,
    label: normalizeTokenMarkDisplayLabel(row.symbol),
  };
}

function asMonogram(symbol: string | null): TokenIconResolution {
  if (symbol === null) normalizeTokenMarkTicker(symbol);
  return {
    kind: TOKEN_ICON_MONOGRAM,
    label: normalizeTokenMarkDisplayLabel(symbol as string),
  };
}

/**
 * Mint wins when it is present. A mint that is not in the fixture does not
 * fall through to the symbol, so a lookalike ticker cannot wear another
 * asset's logo. With no mint, a symbol is used only when the uppercased
 * symbol is unique in the fixture.
 */
export function resolveTokenIcon(
  input: { mint?: string | null; symbol?: string | null },
  index: Index = LIVE,
): TokenIconResolution {
  const mint =
    typeof input.mint === 'string' && input.mint.length > 0 ? input.mint : null;
  const symbol =
    typeof input.symbol === 'string' && input.symbol.length > 0
      ? input.symbol
      : null;
  if (mint !== null) {
    const row = index.byMint.get(mint);
    if (row) return asImage(row);
    return asMonogram(symbol);
  }
  if (symbol !== null) {
    const row = index.bySymbol.get(symbol.toUpperCase());
    if (row) return asImage(row);
  }
  return asMonogram(symbol);
}

/** Hosts of admitted fixture icons. Derived from the fixture, not a second list. */
export function tokenIconHosts(index: Index = LIVE): readonly string[] {
  const hosts = new Set<string>();
  for (const row of index.byMint.values()) {
    hosts.add(new URL(row.uri).hostname);
  }
  return [...hosts].sort();
}

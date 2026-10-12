import fixture from './tokenIconFixture.json';
import {
  normalizeTokenMarkDisplayLabel,
  normalizeTokenMarkTicker,
} from '@/src/ui/primitives/tokenMarkPresentation';
import { readWealthV1BuildFlag } from '@/src/features/wealth/wealthEnv';
import { MAJOR_ASSETS, type MajorAsset } from '@/src/features/balances/majors';

/** Disc shows the locked two-letter monogram. */
export const TOKEN_ICON_MONOGRAM = 0;
/** Disc shows a fixture image. */
export const TOKEN_ICON_IMAGE = 1;
/** Raster bytes Image can decode (png, jpeg, webp, gif). */
export const TOKEN_ICON_RASTER = 0;
/** SVG bytes. Image does not decode these; SvgUri does. */
export const TOKEN_ICON_SVG = 1;
/** A file in the app bundle; `uri` is `bundled:<key>` (`bundledTokenIcons.ts`). */
export const TOKEN_ICON_BUNDLED = 2;

type TokenIconFormat =
  | typeof TOKEN_ICON_RASTER
  | typeof TOKEN_ICON_SVG
  | typeof TOKEN_ICON_BUNDLED;

function bundledKeyOf(asset: MajorAsset) {
  if (asset.symbol === 'cbBTC') return 'cbbtc' as const;
  if (asset.symbol === 'ZEC') return 'zec' as const;
  return null;
}

export type BundledTokenIconKey = NonNullable<ReturnType<typeof bundledKeyOf>>;

export const BUNDLED_TOKEN_ICONS: Readonly<Record<string, BundledTokenIconKey>> =
  Object.fromEntries(
    MAJOR_ASSETS.flatMap((asset) => {
      const key = bundledKeyOf(asset);
      return key === null ? [] : [[asset.mint, key]];
    }),
  );

const BUNDLED_PREFIX = 'bundled:';

function bundledFor(mint: string): string | null {
  const key = BUNDLED_TOKEN_ICONS[mint];
  return key === undefined ? null : `${BUNDLED_PREFIX}${key}`;
}

/** The bundle key of a `bundled:<key>` uri, or null for any other uri. */
export function bundledTokenIconKey(uri: string): BundledTokenIconKey | null {
  if (!uri.startsWith(BUNDLED_PREFIX)) return null;
  const key = uri.slice(BUNDLED_PREFIX.length);
  return (Object.values(BUNDLED_TOKEN_ICONS) as string[]).includes(key)
    ? (key as BundledTokenIconKey)
    : null;
}

export type TokenIconResolution =
  | {
      kind: typeof TOKEN_ICON_MONOGRAM;
      label: string;
    }
  | {
      kind: typeof TOKEN_ICON_IMAGE;
      uri: string;
      format: TokenIconFormat;
      label: string;
    };

type Admitted = {
  mint: string;
  symbolKey: string;
  symbol: string;
  uri: string;
  format: TokenIconFormat;
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

function admitRow(raw: RawRow, withBundled: boolean): Admitted | null {
  if (typeof raw.mint !== 'string' || raw.mint.length === 0) return null;
  if (typeof raw.symbol !== 'string' || raw.symbol.length === 0) return null;
  const bundled = withBundled ? bundledFor(raw.mint) : null;
  const icon: { uri: string; format: TokenIconFormat } | null =
    bundled === null
      ? admitTokenIcon(raw.icon, raw.format)
      : { uri: bundled, format: TOKEN_ICON_BUNDLED };
  if (icon === null) return null;
  return {
    mint: raw.mint,
    symbol: raw.symbol,
    symbolKey: raw.symbol.toUpperCase(),
    uri: icon.uri,
    format: icon.format,
  };
}

export function indexTokenIcons(
  rows: readonly RawRow[],
  options: { bundled?: boolean } = {},
): Index {
  const withBundled = options.bundled === true;
  const byMint = new Map<string, Admitted>();
  const bySymbol = new Map<string, Admitted>();
  const mintClash = new Set<string>();
  const symbolClash = new Set<string>();
  for (const raw of rows) {
    const row = admitRow(raw, withBundled);
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
const LIVE_WEALTH = indexTokenIcons(fixture.rows, { bundled: true });

function liveIndex(): Index {
  return readWealthV1BuildFlag() ? LIVE_WEALTH : LIVE;
}

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
  index: Index = liveIndex(),
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

/**
 * Hosts of admitted fixture icons. Derived from the fixture, not a second list.
 * A bundled icon has no host.
 */
export function tokenIconHosts(index: Index = liveIndex()): readonly string[] {
  const hosts = new Set<string>();
  for (const row of index.byMint.values()) {
    if (row.format === TOKEN_ICON_BUNDLED) continue;
    hosts.add(new URL(row.uri).hostname);
  }
  return [...hosts].sort();
}

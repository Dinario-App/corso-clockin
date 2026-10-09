import fixture from './backpack-collateral.fixture.json';

export const COLLATERAL_ELIGIBLE_BADGE = 'collateral-eligible';

export const COLLATERAL_SOURCE = 'Backpack public GET /api/v1/collateral';

const DISPLAY_NAME_ABSENT_REASON =
  'public GET /api/v1/collateral row has no display name field';

const MINT_ABSENT_REASON =
  'public GET /api/v1/collateral row has no mint or id field';

const NAME_KEY = /name|title|description/i;
const MINT_KEY = /mint|^id$|tokenid|contract/i;

export type CollateralMetadataRow = {
  symbol: string;
  displayName: string | null;
  displayNameAbsentReason: string | null;
  badge: typeof COLLATERAL_ELIGIBLE_BADGE;
  source: typeof COLLATERAL_SOURCE;
  mint: string | null;
  mintAbsentReason: string | null;
};

type RawRow = Record<string, unknown>;

function stringField(raw: RawRow, pattern: RegExp): string | null {
  for (const [key, value] of Object.entries(raw)) {
    if (key === 'symbol') continue;
    if (typeof value !== 'string' || value.length === 0) continue;
    if (pattern.test(key)) return value;
  }
  return null;
}

export function collateralMetadataFromRow(
  raw: RawRow,
): CollateralMetadataRow | null {
  const symbol = raw.symbol;
  if (typeof symbol !== 'string' || !symbol.endsWith('.US')) return null;
  const displayName = stringField(raw, NAME_KEY);
  const mint = stringField(raw, MINT_KEY);
  return {
    symbol,
    displayName,
    displayNameAbsentReason:
      displayName == null ? DISPLAY_NAME_ABSENT_REASON : null,
    badge: COLLATERAL_ELIGIBLE_BADGE,
    source: COLLATERAL_SOURCE,
    mint,
    mintAbsentReason: mint == null ? MINT_ABSENT_REASON : null,
  };
}

export function collateralUsRows(body: unknown): CollateralMetadataRow[] {
  if (!Array.isArray(body)) return [];
  const rows: CollateralMetadataRow[] = [];
  for (const item of body) {
    if (item == null || typeof item !== 'object') continue;
    const row = collateralMetadataFromRow(item as RawRow);
    if (row) rows.push(row);
  }
  rows.sort((a, b) => (a.symbol < b.symbol ? -1 : a.symbol > b.symbol ? 1 : 0));
  return rows;
}

/** The committed snapshot, not a live fetch at render time. */
export function collateralPack(): readonly CollateralMetadataRow[] {
  return collateralUsRows(fixture.body);
}

export const COLLATERAL_FETCHED_AT: string = fixture.fetchedAt;

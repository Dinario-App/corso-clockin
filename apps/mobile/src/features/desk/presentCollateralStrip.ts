import {
  collateralPack,
  type CollateralMetadataRow,
} from '@/src/features/desk/collateralPack';
import { readDeskBuildFlag } from '@/src/features/desk/deskEnv';
import {
  showBackpackShelf,
  type ShelfSignals,
} from '@/src/features/desk/showBackpackShelf';

export type CollateralStripRow = {
  symbol: string;
  label: string;
  badge: string;
};

export type CollateralStripModel = {
  rows: readonly CollateralStripRow[];
};

const STRIP_ROW_KEYS = ['badge', 'label', 'symbol'] as const;

export function presentCollateralStrip(
  rows: readonly CollateralMetadataRow[],
): CollateralStripModel {
  return {
    rows: rows.map((row) => {
      const presented: CollateralStripRow = {
        symbol: row.symbol,
        label: row.displayName ?? row.symbol,
        badge: row.badge,
      };
      return presented;
    }),
  };
}

function collateralStripMount(
  flagOn: boolean,
  shelfShown: boolean,
  rows: readonly CollateralMetadataRow[],
): CollateralStripModel | null {
  if (!flagOn || !shelfShown) return null;
  return presentCollateralStrip(rows);
}

export function collateralStripRowKeys(): readonly string[] {
  return STRIP_ROW_KEYS;
}

export function mountedCollateralStrip(input?: {
  shelfShown?: boolean;
  signals?: ShelfSignals;
}): CollateralStripModel | null {
  const liveShelf = showBackpackShelf(input?.signals);
  const shelfShown = input?.shelfShown ?? liveShelf;
  return collateralStripMount(
    readDeskBuildFlag(),
    shelfShown,
    collateralPack(),
  );
}

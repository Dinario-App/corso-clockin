import type { TextStyle, ViewStyle } from 'react-native';
import { copy } from '@/constants/copy';
import { formatMovingPrice } from '@/src/features/moving/formatMovingPrice';
import {
  MOVING_ROW_COUNT,
  type MovingRow,
  type MovingSnapshot,
} from '@/src/features/moving/types';
import {
  MOVING_LABEL_LINE_HEIGHT,
  MOVING_NUMBER_COLUMN_WIDTH,
  MOVING_ROW_HEIGHT,
  movingSlotHeight,
} from '@/src/features/moving/movingSlot';
import { colors, spacing, typography } from '@/src/ui/tokens';
import { resolveMovingContext } from '@/src/features/home/asOfPresentation';

export const MOVING_ROW_MIN_HEIGHT = MOVING_ROW_HEIGHT;

/** Exactly three rendered content fields; tone/accessibility are metadata. */
export type MovingRowView = {
  /** React key. Not rendered. */
  key: string;
  /** Exact mint for the existing dynamic Asset route. Not rendered. */
  mint: string;
  /** Field 1 — the symbol. Not the long name, not a logo, not an avatar. */
  symbol: string;
  /** Field 2 — fiat price. */
  priceText: string;
  /** Field 3 — the one number, signed. */
  numberText: string;
  /** Semantic price direction; the component resolves it through palette tokens. */
  numberTone: 'priceUp' | 'priceDown';
  /** Composed so a screen reader does not read "plus two point four" alone. */
  accessibilityLabel: string;
};

export type MovingStripView = {
  header: string;
  /** The provider-backed number window and snapshot observation time. */
  context: string | null;
  rows: MovingRowView[];
};

export const movingStripStyles: {
  section: ViewStyle;
  headerRow: ViewStyle;
  label: TextStyle;
  context: TextStyle;
  viewportFrame: ViewStyle;
  clipBox: ViewStyle;
  row: ViewStyle;
  symbol: TextStyle;
  price: TextStyle;
  number: TextStyle;
} = {
  section: {
    marginTop: spacing.lg,
    height: movingSlotHeight(MOVING_ROW_COUNT),
    // Shrinks before the composer does on a short device. The strip is chrome
    // on the money path's edge; Ask is the product.
    flexShrink: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  label: {
    color: colors.ink,
    fontSize: typography.caption,
    fontFamily: typography.face('400'),
    fontWeight: '400',
    // ⚠️ Pinned, not inherited. If this came from font metrics the reserved
    // height and the rendered height would agree only while Inter was loaded,
    // and a late font swap lands squarely in defect 1's window.
    lineHeight: MOVING_LABEL_LINE_HEIGHT,
  },
  context: {
    color: colors.inkTertiary,
    fontSize: typography.caption,
    fontFamily: typography.face('400'),
    lineHeight: MOVING_LABEL_LINE_HEIGHT,
  },
  viewportFrame: {
    flex: 1,
    overflow: 'hidden',
  },
  clipBox: {
    overflow: 'hidden',
  },
  row: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  /** Ink at 100 — the row's subject. Frame: Inter Medium 15. */
  symbol: {
    color: colors.ink,
    fontSize: 15,
    fontFamily: typography.face('500'),
    fontWeight: '500',
    flexShrink: 0,
  },
  /** Ink at 72 — the value. Frame: Inter Regular 14, right-aligned. */
  price: {
    color: colors.inkSecondary,
    fontSize: 14,
    fontFamily: typography.face('400'),
    fontWeight: '400',
    fontVariant: [...typography.fontVariantTabular],
    flex: 1,
    textAlign: 'right',
  },
  number: {
    fontSize: 14,
    fontFamily: typography.face('500'),
    fontWeight: '500',
    fontVariant: [...typography.fontVariantTabular],
    width: MOVING_NUMBER_COLUMN_WIDTH,
    textAlign: 'right',
  },
};

function resolveRow(row: MovingRow): MovingRowView | null {
  const priceText = formatMovingPrice(row.priceUsd);
  if (priceText == null) return null;
  // The server always writes the sign. A number that arrived without one is a
  // number whose direction is unstated, and unstated direction is exactly what
  // the monochrome treatment cannot carry.
  if (!/^[+-]/.test(row.numberValue)) return null;
  const numberText = `${row.numberValue}%`;
  return {
    key: row.mint,
    mint: row.mint,
    symbol: row.symbol,
    priceText,
    numberText,
    numberTone: row.numberValue.startsWith('+') ? 'priceUp' : 'priceDown',
    accessibilityLabel: copy.moving.rowLabel(row.symbol, priceText, numberText),
  };
}

/**
 * The whole strip, or null.
 *
 * Each row still has to be independently honest. An unformattable price or
 * unsigned movement claim removes that row only; it cannot erase valid sibling
 * observations and it cannot be replaced with a placeholder or estimate.
 */
export function resolveMovingStripView(
  snapshot: MovingSnapshot | null,
): MovingStripView | null {
  if (snapshot == null) return null;
  if (snapshot.status !== 'ready') return null;
  if (
    snapshot.rows.length === 0 ||
    snapshot.rows.length > MOVING_ROW_COUNT
  ) return null;

  const rows: MovingRowView[] = [];
  for (const row of snapshot.rows) {
    const view = resolveRow(row);
    if (view == null) continue;
    rows.push(view);
  }

  if (rows.length === 0) return null;
  return {
    header: copy.moving.label,
    context: resolveMovingContext(snapshot.asOfMs),
    rows,
  };
}

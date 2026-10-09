import { StyleSheet, View } from 'react-native';
import { CorsoText } from '@/src/theme/CorsoText';
import { Material } from '@/src/ui/glass/Material';
import { colors, kitWeight, typography } from '@/src/ui/tokens';
import {
  MARKET_ROW_BODY_SIZE,
  MARKET_ROW_CARD_PAD,
  MARKET_ROW_CARD_RADIUS,
  MARKET_ROW_COLUMN_GAP,
  MARKET_ROW_LABEL_SIZE,
  MARKET_ROW_ROW_GAP,
  MARKET_ROW_TITLE_SIZE,
  resolveMarketRowCellStyle,
  resolveMarketRowPresentation,
  type MarketRowSource,
} from './marketRowPresentation';

export type MarketRowProps = {
  source: MarketRowSource | null | undefined;
  /** Wall clock for the date form. Omitted, the provenance stays `HH:MM`. */
  nowMs?: number;
  testID?: string;
};

export function MarketRow({ source, nowMs, testID }: MarketRowProps) {
  const row = resolveMarketRowPresentation(source, nowMs);
  if (!row) return null;
  return (
    <Material
      weight="card"
      hug
      radius={MARKET_ROW_CARD_RADIUS}
      style={styles.card}
      contentStyle={styles.content}
      testID={testID}
    >
      <View accessible accessibilityLabel={row.accessibilityLabel}>
        <CorsoText style={styles.title}>{row.title}</CorsoText>
        <View style={styles.grid}>
          {row.cells.map((cell) => (
            <View
              key={cell.key}
              style={resolveMarketRowCellStyle()}
              accessible
              accessibilityRole="text"
              accessibilityLabel={
                cell.provenance
                  ? `${cell.label} ${cell.value}, ${cell.provenance}`
                  : `${cell.label} ${cell.value}`
              }
            >
              <CorsoText style={styles.label}>{cell.label}</CorsoText>
              <CorsoText style={styles.value}>{cell.value}</CorsoText>
              {cell.provenance ? (
                <CorsoText style={styles.provenance}>
                  {cell.provenance}
                </CorsoText>
              ) : null}
            </View>
          ))}
        </View>
      </View>
    </Material>
  );
}

const styles = StyleSheet.create({
  card: { alignSelf: 'stretch' },
  content: {
    padding: MARKET_ROW_CARD_PAD,
    gap: MARKET_ROW_ROW_GAP,
  },
  title: {
    fontSize: MARKET_ROW_TITLE_SIZE,
    lineHeight: 20,
    fontFamily: typography.face(kitWeight.medium),
    fontWeight: kitWeight.medium,
    color: colors.inkTertiary,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: MARKET_ROW_COLUMN_GAP,
    rowGap: MARKET_ROW_ROW_GAP,
  },
  label: {
    fontSize: MARKET_ROW_LABEL_SIZE,
    lineHeight: 16,
    fontFamily: typography.face(kitWeight.regular),
    fontWeight: kitWeight.regular,
    color: colors.inkTertiary,
  },
  value: {
    fontSize: MARKET_ROW_BODY_SIZE,
    lineHeight: 22,
    fontFamily: typography.face(kitWeight.medium),
    fontWeight: kitWeight.medium,
    color: colors.ink,
    fontVariant: [...typography.fontVariantTabular],
  },
  provenance: {
    fontSize: MARKET_ROW_LABEL_SIZE,
    lineHeight: 16,
    fontFamily: typography.face(kitWeight.regular),
    fontWeight: kitWeight.regular,
    color: colors.inkTertiary,
  },
});

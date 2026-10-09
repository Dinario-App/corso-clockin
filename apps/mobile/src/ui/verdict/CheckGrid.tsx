import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { CorsoText } from '@/src/theme/CorsoText';
import { colors, typography } from '@/src/ui/tokens';
import type {
  ReadRingCell,
  ReadRingMark,
} from '@/src/features/tokenVitals/readRingCatalog';
import { canonWeight } from './verdictCardPresentation';
import {
  CHECK_GRID as GRID,
  isHollowMark,
  resolveCheckGridRows,
  resolveMarkColor,
} from './readRingPresentation';

export function CheckGrid({
  cells,
  testID,
}: {
  cells: readonly ReadRingCell[];
  testID?: string;
}) {
  const rows = resolveCheckGridRows(cells);
  return (
    <View style={styles.grid} testID={testID}>
      {rows.map((row, rowIndex) => (
        <View
          // The row's identity is its first real cell, so keys survive a re-fold.
          key={row.find((cell) => cell !== null)?.id ?? `row-${rowIndex}`}
          style={styles.row}
        >
          {row.map((cell, column) =>
            cell === null ? (
              /**
               * A short last row keeps its empty column, so a lone cell stays
               * one column wide instead of growing across the card.
               */
              // biome-ignore lint/suspicious/noArrayIndexKey: the slot has no id
              <View key={`empty-${column}`} style={styles.cell} />
            ) : (
              <View
                key={cell.id}
                style={[
                  styles.cell,
                  rowIndex === rows.length - 1 ? null : styles.divider,
                ]}
                accessible
                accessibilityLabel={`${cell.label}, ${[cell.value, ...cell.extra.map((line) => line.text)].join(', ')}`}
                testID={`check-cell-${cell.id}`}
              >
                <View style={styles.labelRow}>
                  <View style={styles.markSlot}>
                    <CheckMark mark={cell.mark} />
                  </View>
                  <CorsoText style={styles.label} numberOfLines={1}>
                    {cell.label}
                  </CorsoText>
                </View>
                <CorsoText
                  style={[
                    styles.value,
                    cell.mark === 'not_read' || cell.mark === 'unknown'
                      ? styles.valueMuted
                      : null,
                  ]}
                  numberOfLines={1}
                >
                  {cell.value}
                </CorsoText>
                {cell.extra.map((line) => (
                  <View key={line.key} style={styles.extraRow}>
                    <View style={styles.markSlot}>
                      <CheckMark mark={line.mark} small />
                    </View>
                    <CorsoText style={styles.extra} numberOfLines={1}>
                      {line.text}
                    </CorsoText>
                  </View>
                ))}
              </View>
            ),
          )}
        </View>
      ))}
    </View>
  );
}

const MARK_PATH: Readonly<Record<'octagon' | 'triangle', string>> =
  Object.freeze({
    octagon: 'M4 .5h4l3.5 3.5v4L8 11.5H4L.5 8V4z',
    triangle: 'M6 1.6L11 10.2H1L6 1.6z',
  });

function CheckMark({ mark, small }: { mark: ReadRingMark; small?: boolean }) {
  const color = resolveMarkColor(mark);
  const size = small ? 9 : GRID.markSlot;
  if (mark === 'danger' || mark === 'warn') {
    return (
      <Svg width={size} height={size} viewBox="0 0 12 12">
        {mark === 'danger' ? (
          <Path d={MARK_PATH.octagon} fill={color} />
        ) : (
          <Path
            d={MARK_PATH.triangle}
            fill="none"
            stroke={color}
            strokeWidth={1.4}
            strokeLinejoin="round"
          />
        )}
      </Svg>
    );
  }
  if (isHollowMark(mark)) {
    const ring = small ? 8 : 9;
    return (
      <Svg width={ring} height={ring} viewBox="0 0 9 9">
        <Circle
          cx={4.5}
          cy={4.5}
          r={3.7}
          fill="none"
          stroke={color}
          strokeWidth={1.3}
        />
      </Svg>
    );
  }
  const dot = small ? 7 : 8;
  return (
    <View
      style={{
        width: dot,
        height: dot,
        borderRadius: dot / 2,
        backgroundColor: color,
      }}
    />
  );
}

const styles = StyleSheet.create({
  grid: {
    marginTop: GRID.rowPaddingVertical,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    columnGap: GRID.columnGap,
  },
  cell: {
    /**
     * Two columns, each half the inner width less the gap — the width
     * `resolveCheckGridCellWidth` states (140.5 dp at 369 dp). It is `flex: 1`
     * past the gap rather than a percentage, because a percentage has to be
     * kept under the gap by hand and that is what collapsed the grid.
     */
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    paddingVertical: GRID.rowPaddingVertical,
    gap: GRID.lineGap,
    minWidth: 0,
  },
  divider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: GRID.markGap },
  markSlot: {
    width: GRID.markSlot,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  label: {
    flexShrink: 1,
    fontSize: GRID.labelSize,
    lineHeight: GRID.labelLineHeight,
    fontFamily: typography.face('400'),
    fontWeight: canonWeight('400'),
    color: colors.inkTertiary,
  },
  value: {
    paddingLeft: GRID.valueIndent,
    fontSize: GRID.valueSize,
    lineHeight: GRID.valueLineHeight,
    fontFamily: typography.face(GRID.valueWeight),
    fontWeight: canonWeight(GRID.valueWeight),
    color: colors.ink,
  },
  /** "Not read" and "Unknown" are absences: grey2, never the value's white. */
  valueMuted: { color: colors.inkTertiary },
  extraRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.markGap,
  },
  extra: {
    flexShrink: 1,
    fontSize: GRID.extraSize,
    lineHeight: GRID.extraLineHeight,
    fontFamily: typography.face('400'),
    fontWeight: canonWeight('400'),
    color: colors.inkSecondary,
  },
});

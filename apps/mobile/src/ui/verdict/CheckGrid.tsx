import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { CorsoText } from '@/src/theme/CorsoText';
import { ethenaInk, HAIR } from '@/constants/theme.ethena';
import { colors, typography } from '@/src/ui/tokens';
import type {
  ReadRingCell,
  ReadRingMark,
} from '@/src/features/tokenVitals/readRingCatalog';
import { canonWeight } from './verdictCardPresentation';
import {
  CHECK_GRID as GRID,
  isCheckFactList,
  isHollowMark,
  resolveCheckGridRows,
  resolveCheckLabelLines,
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
                  <View style={[styles.markSlot, styles.markSlotFirstLine]}>
                    <CheckMark mark={cell.mark} />
                  </View>
                  <View style={styles.labelLines}>
                    {resolveCheckLabelLines(cell.id, cell.label).map((line) => (
                      <CorsoText
                        key={line}
                        style={styles.label}
                        numberOfLines={1}
                      >
                        {line}
                      </CorsoText>
                    ))}
                  </View>
                </View>
                {checkFacts(cell)}
              </View>
            ),
          )}
        </View>
      ))}
    </View>
  );
}

function checkFacts(cell: ReadRingCell): ReactNode {
  const factList = isCheckFactList(cell.id);
  const factLineScale = factList ? GRID.factLineMaxFontScale : undefined;
  const facts = [
    <CorsoText
      key="value"
      style={[
        styles.value,
        factList ? styles.valueFactLine : null,
        cell.mark === 'not_read' || cell.mark === 'unknown'
          ? styles.valueMuted
          : null,
      ]}
      numberOfLines={1}
      maxFontSizeMultiplier={factLineScale}
    >
      {cell.value}
    </CorsoText>,
    ...cell.extra.map((line) => (
      <View key={line.key} style={styles.extraRow}>
        <View style={styles.markSlot}>
          <CheckMark mark={line.mark} small />
        </View>
        <CorsoText
          style={styles.extra}
          numberOfLines={1}
          maxFontSizeMultiplier={factLineScale}
        >
          {line.text}
        </CorsoText>
      </View>
    )),
  ];
  return factList ? <View style={styles.factList}>{facts}</View> : facts;
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
    borderTopColor: HAIR,
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
    borderBottomColor: HAIR,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: GRID.markGap,
  },
  markSlotFirstLine: { height: GRID.labelLineHeight },
  labelLines: { flexShrink: 1 },
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
    color: ethenaInk.tertiary,
  },
  value: {
    paddingLeft: GRID.valueIndent,
    fontSize: GRID.valueSize,
    lineHeight: GRID.valueLineHeight,
    fontFamily: typography.face(GRID.valueWeight),
    fontWeight: canonWeight(GRID.valueWeight),
    color: colors.ink,
  },
  valueFactLine: {
    fontSize: GRID.extraSize,
    lineHeight: GRID.extraLineHeight,
  },
  /** Check 7's facts stack with no gap; the label keeps its 3 dp above them. */
  factList: { gap: 0 },
  /** "Not read" and "Unknown" are absences: grey2, never the value's white. */
  valueMuted: { color: ethenaInk.tertiary },
  /**
   * The second line hangs off the LABEL's mark column, not the value's indent:
   * it is a sibling fact of the cell, and at 369 dp the deeper indent clipped
   * "Top holder 99.9%" (`readRingPresentation.test.ts`, TB8).
   */
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
    color: ethenaInk.secondary,
  },
});

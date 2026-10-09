import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { ethena } from '@/constants/theme.ethena';
import { ETHENA_TYPE } from '@/constants/theme.ethenaType';
import type { TokenDetailStatGrid } from '@/src/features/tokenDetail/tokenDetailChartPresentation';
import { CorsoText } from '@/src/theme/CorsoText';
import { EthenaTray } from '@/src/ui/ethena/EthenaPrimitives';
import { CorsoIcon } from '@/src/ui/icons/CorsoIcon';
import { MIN_TAP_TARGET_PT } from '@/src/ui/primitives/tapTargetPresentation';

export function MajorDetailStatGrid({
  grid,
  structure,
}: {
  grid: TokenDetailStatGrid;
  /** A `StatCell`-faced *Structure* disclosure, or nothing. */
  structure?: ReactNode;
}) {
  return (
    <EthenaTray testID="major-detail-stats">
      <View style={GRID_BODY}>
        <View>
          <View style={GRID_ROW}>
            <StatCell label={grid.low.label} value={grid.low.value} />
            <StatCell label={grid.high.label} value={grid.high.value} />
          </View>
          {grid.coverage.map((line) => (
            <CorsoText key={line} style={CAVEAT}>
              {line}
            </CorsoText>
          ))}
        </View>
        <View style={GRID_ROW}>
          {grid.stamp ? (
            <View style={HALF}>
              <CorsoText style={STAMP}>{grid.stamp}</CorsoText>
            </View>
          ) : null}
          {structure}
        </View>
      </View>
    </EthenaTray>
  );
}

/**
 * One cell: an eyebrow label over a tabular value. With `onPress` it is a
 * disclosure face, and the chevron turns down while it is open.
 */
export function StatCell({
  label,
  value,
  onPress,
  open = false,
  accessibilityLabel,
  testID,
}: {
  label: string;
  value: string | null;
  onPress?: () => void;
  open?: boolean;
  accessibilityLabel?: string;
  testID?: string;
}) {
  const body = (
    <>
      <CorsoText style={LABEL} numberOfLines={1}>
        {label}
      </CorsoText>
      <View style={VALUE_LINE}>
        {value ? (
          <CorsoText style={VALUE} numberOfLines={1}>
            {value}
          </CorsoText>
        ) : null}
        {onPress ? (
          <CorsoIcon
            name={open ? 'chevron-down' : 'chevron-right'}
            size={CHEVRON}
            color={ethena.ink.tertiary}
          />
        ) : null}
      </View>
    </>
  );
  if (onPress == null) {
    return (
      <View style={CELL} testID={testID}>
        {body}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ expanded: open }}
      style={[CELL, { minHeight: MIN_TAP_TARGET_PT }]}
      testID={testID}
    >
      {body}
    </Pressable>
  );
}

const TABULAR: ['tabular-nums'] = ['tabular-nums'];
/** The share tray's vertical rhythm (`MajorDetailFace`, `paddingVertical: 14`). */
const GRID_BODY = { paddingVertical: 14, gap: 12 } as const;
const GRID_ROW = { flexDirection: 'row', flexWrap: 'wrap', rowGap: 12 } as const;
const CELL = { flex: 1, minWidth: 0, gap: 4 } as const;
export const HALF = { flexBasis: '50%', flexGrow: 0 } as const;
export const FULL = { flexBasis: '100%' } as const;
const LABEL = { ...ETHENA_TYPE.eyebrow, color: ethena.ink.tertiary };
const VALUE_LINE = { flexDirection: 'row', alignItems: 'center', gap: 4 } as const;
const VALUE = {
  ...ETHENA_TYPE.rowValue,
  color: ethena.ink.primary,
  flexShrink: 1,
  fontVariant: TABULAR,
};
const STAMP = {
  ...ETHENA_TYPE.rowSub,
  color: ethena.ink.tertiary,
  fontVariant: TABULAR,
};
/** Attached to Low and High: no gap of its own beyond the eyebrow rhythm. */
const CAVEAT = { ...ETHENA_TYPE.rowSub, color: ethena.ink.tertiary, marginTop: 4 };
const CHEVRON = 14;

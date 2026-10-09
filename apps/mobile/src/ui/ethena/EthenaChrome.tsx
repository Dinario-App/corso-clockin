import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { CorsoText } from '@/src/theme/CorsoText';
import { TOKEN_MARKS, ethena, ethenaMaterial } from '@/constants/theme.ethena';
import { ethenaGeometry } from '@/constants/theme.ethenaGeometry';
import { ETHENA_TYPE } from '@/constants/theme.ethenaType';
import { EthenaDirection } from '@/src/ui/ethena/EthenaPrimitives';
import { resolveDeltaInk } from '@/src/ui/ethena/deltaInk';

export function EthenaStatusBar() {
  return (
    <View
      style={{
        height: 44,
        paddingLeft: 22,
        paddingRight: ethenaGeometry.gutter,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <CorsoText style={{ ...ETHENA_TYPE.status, color: ethena.ink.primary }}>
        9:41
      </CorsoText>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}>
        {[5, 7, 9, 11].map((height) => (
          <View
            key={height}
            style={{
              width: 3,
              height,
              borderRadius: 1,
              backgroundColor: ethena.ink.primary,
            }}
          />
        ))}
        <View
          style={{
            marginLeft: 5,
            width: 24,
            height: 12,
            borderRadius: 3,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.4)',
            padding: 1.5,
          }}
        >
          <View
            style={{
              flex: 1,
              marginRight: 4.5,
              backgroundColor: '#FFFFFF',
              borderRadius: 1,
            }}
          />
        </View>
      </View>
    </View>
  );
}

export function EthenaNav({
  left,
  middle,
  right,
}: {
  left?: ReactNode;
  middle?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <View
      style={{
        height: 44,
        paddingHorizontal: ethenaGeometry.gutter,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 9,
          flexShrink: 1,
          minWidth: 0,
        }}
      >
        {left}
      </View>
      <View>{middle}</View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 18,
          flexShrink: 0,
        }}
      >
        {right}
      </View>
    </View>
  );
}

export function EthenaBack({ onPress }: { onPress?: () => void }) {
  return (
    <Pressable
      testID="ethena-back"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Back"
    >
      <CorsoText style={{ ...ETHENA_TYPE.back, color: ethena.ink.primary }}>
        ‹
      </CorsoText>
    </Pressable>
  );
}

export function EthenaCoin({
  glyph,
  mark = 'none',
  size = 36,
}: {
  glyph: string;
  mark?: keyof typeof TOKEN_MARKS;
  size?: number;
}) {
  const paint = TOKEN_MARKS[mark] ?? TOKEN_MARKS.none;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: paint.bg,
        borderWidth: mark === 'none' ? 1 : 0,
        borderColor: mark === 'none' ? ethenaMaterial.rim : undefined,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <CorsoText
        style={{
          ...ETHENA_TYPE.coin,
          fontSize: Math.round(size * 0.39),
          color: paint.fg,
        }}
      >
        {glyph}
      </CorsoText>
    </View>
  );
}

export function EthenaSectionHead({
  label,
  right,
  rightAccessibilityLabel,
  separates = false,
  testID,
}: {
  label: string;
  right?: string;
  rightAccessibilityLabel?: string;
  separates?: boolean;
  testID?: string;
}) {
  return (
    <View
      testID={testID}
      style={{
        paddingHorizontal: ethenaGeometry.gutter,
        paddingTop: 4,
        paddingBottom: 8,
        flexDirection: 'row',
        flexWrap: 'wrap',
        columnGap: 12,
        justifyContent: 'space-between',
      }}
    >
      <CorsoText
        style={{
          ...(separates ? ETHENA_TYPE.sectionSeparating : ETHENA_TYPE.section),
          color: ethena.ink.secondary,
        }}
      >
        {label}
      </CorsoText>
      {right ? (
        <CorsoText
          style={{
            ...(separates
              ? ETHENA_TYPE.sectionSeparating
              : ETHENA_TYPE.sectionTrailing),
            color: ethena.ink.tertiary,
          }}
          accessibilityLabel={rightAccessibilityLabel}
        >
          {right}
        </CorsoText>
      ) : null}
    </View>
  );
}

export function EthenaKeyValue({
  label,
  value,
  total = false,
  first = false,
  last = false,
  trailing,
}: {
  label: string;
  value: string;
  total?: boolean;
  first?: boolean;
  last?: boolean;
  trailing?: ReactNode;
}) {
  return (
    <View
      style={{
        paddingTop: first ? 0 : 13,
        paddingBottom: last ? 0 : 13,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        <CorsoText
          style={{
            ...(total ? ETHENA_TYPE.keyValueTotal : ETHENA_TYPE.keyValue),
            color: total ? ethena.ink.primary : ethena.ink.secondary,
          }}
        >
          {label}
        </CorsoText>
        {trailing}
      </View>
      <CorsoText
        style={{
          ...(total ? ETHENA_TYPE.keyValueTotal : ETHENA_TYPE.keyValue),
          color: ethena.ink.primary,
        }}
      >
        {value}
      </CorsoText>
    </View>
  );
}

export function EthenaHero({
  eyebrow,
  amount,
  cents,
  deltaDirection,
  deltaValue,
  deltaSuffix,
  align = 'center',
  paddingTop = 10,
  amountAccessibilityLabel,
  testID,
}: {
  eyebrow?: string;
  amount: string;
  cents?: string;
  amountAccessibilityLabel?: string;
  deltaDirection?: 'up' | 'down';
  deltaValue?: string;
  deltaSuffix?: string;
  align?: 'center' | 'left';
  paddingTop?: number;
  testID?: string;
}) {
  return (
    <View
      testID={testID}
      style={{
        paddingHorizontal: ethenaGeometry.gutter,
        paddingTop,
        alignItems: align === 'center' ? 'center' : 'flex-start',
      }}
    >
      {eyebrow ? (
        <CorsoText
          style={{ ...ETHENA_TYPE.eyebrow, color: ethena.ink.tertiary }}
        >
          {eyebrow}
        </CorsoText>
      ) : null}
      <CorsoText
        numberOfLines={1}
        adjustsFontSizeToFit
        accessibilityLabel={amountAccessibilityLabel}
        style={{
          ...ETHENA_TYPE.amount,
          marginTop: 4,
          color: ethena.ink.primary,
        }}
      >
        {amount}
        {cents ? (
          <CorsoText
            style={{ ...ETHENA_TYPE.amountCents, color: ethena.ink.secondary }}
          >
            {cents}
          </CorsoText>
        ) : null}
      </CorsoText>
      {deltaValue ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 5,
            marginTop: 6,
          }}
        >
          {deltaDirection ? (
            <EthenaDirection
              testID={`${testID ?? 'ethena-hero'}-direction`}
              direction={deltaDirection}
            />
          ) : null}
          <CorsoText
            style={{ ...ETHENA_TYPE.sub, color: resolveDeltaInk(deltaDirection) }}
          >
            {deltaValue}
            {deltaSuffix ? ` · ${deltaSuffix}` : ''}
          </CorsoText>
        </View>
      ) : null}
    </View>
  );
}

export function EthenaHomeIndicator() {
  return (
    <View style={{ alignItems: 'center', paddingBottom: 8, paddingTop: 8 }}>
      <View
        style={{
          width: 134,
          height: 5,
          borderRadius: 3,
          backgroundColor: 'rgba(255,255,255,0.28)',
        }}
      />
    </View>
  );
}

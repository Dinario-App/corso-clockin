import { useEffect, useId, useRef, useState } from 'react';
import { Animated, Easing, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { ethena } from '@/constants/theme.ethena';
import { ethenaGeometry } from '@/constants/theme.ethenaGeometry';
import { ETHENA_TYPE } from '@/constants/theme.ethenaType';
import { useReadFailState } from '@/src/features/connectivity/useConnectivity';
import { useMajorDeskReads } from '@/src/features/tokenDesk/useMajorDeskReads';
import { MajorWhyLineSlot } from '@/src/features/why/WhyViews';
import { resolveTransitionMotion } from '@/src/motion/resolveMotion';
import { useAccessibilityPreference } from '@/src/motion/useAccessibilityPreference';
import { CorsoText } from '@/src/theme/CorsoText';
import { resolveDeltaInk } from '@/src/ui/ethena/deltaInk';
import { EthenaTray } from '@/src/ui/ethena/EthenaPrimitives';
import { resolveEthenaMaterial } from '@/src/ui/ethena/materialLaw';
import { CorsoGlass } from '@/src/ui/glass/CorsoGlass';
import { TokenMark } from '@/src/ui/primitives/TokenMark';
import { LIVE_DESK_MINT, useLiveDeskRead } from './liveDeskRead';
import {
  liveDeskLinePaths,
  presentLiveDeskCard,
  type LiveDeskCardModel,
} from './liveDeskPresentation';

export const LIVE_DESK_LINE_HEIGHT = 56;
const CARD_RADIUS = 22;
/**
 * MOTION.md, Welcome first paint: the card fades up 12 dp, ease-out. The
 * timing is the ladder's arrival (`resolveTransitionMotion('sheetPresent')`,
 * `enter` 300 ms, the nearest step to the frame's 400); Reduce Motion takes
 * the ladder's 120 ms cross-fade and no rise.
 */
const ENTER_RISE = 12;
const PULSE = 10;

export function LiveDeskCard({
  plane,
  testID = 'live-desk-card',
}: {
  plane: 'float' | 'ground';
  testID?: string;
}) {
  const read = useLiveDeskRead();
  const { vitals, mood } = useMajorDeskReads(LIVE_DESK_MINT);
  const failState = useReadFailState();
  const model = presentLiveDeskCard({
    read,
    vitals,
    mood,
    nowMs: Date.now(),
    failState,
  });
  const { reduceMotion } = useAccessibilityPreference();
  const arrival = resolveTransitionMotion({
    transition: 'sheetPresent',
    reduceMotion,
  });
  const rises = !reduceMotion;
  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!model.shown) return;
    Animated.timing(enter, {
      toValue: 1,
      duration: arrival.durationMs,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [enter, model.shown, arrival.durationMs]);

  if (!model.shown) return null;

  const body = <LiveDeskBody model={model} />;
  const motion = {
    opacity: enter,
    transform: !rises
      ? []
      : [
          {
            translateY: enter.interpolate({
              inputRange: [0, 1],
              outputRange: [ENTER_RISE, 0],
            }),
          },
        ],
  };

  if (plane === 'float') {
    const material = resolveEthenaMaterial('float');
    return (
      <Animated.View style={motion}>
        <CorsoGlass
          testID={testID}
          material={material.material}
          tint={material.tint ?? undefined}
          radius={CARD_RADIUS}
          style={{ padding: ethenaGeometry.pad }}
        >
          {body}
        </CorsoGlass>
      </Animated.View>
    );
  }
  return (
    <Animated.View
      style={[{ marginHorizontal: ethenaGeometry.gutter }, motion]}
    >
      <EthenaTray
        testID={testID}
        style={{ paddingVertical: ethenaGeometry.pad }}
      >
        {body}
      </EthenaTray>
    </Animated.View>
  );
}

function LiveDeskBody({ model }: { model: LiveDeskCardModel }) {
  return (
    <View style={{ gap: 12 }}>
      <View
        testID="live-desk-head"
        accessible
        accessibilityLabel={model.headAccessibilityLabel}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
      >
        <TokenMark
          ticker={model.symbol}
          mint={LIVE_DESK_MINT}
          size={36}
          accessibilityLabel={model.name}
        />
        <CorsoText
          style={{ ...ETHENA_TYPE.rowName, flex: 1, color: ethena.ink.primary }}
          numberOfLines={1}
        >
          {model.name}
        </CorsoText>
        <View style={{ alignItems: 'flex-end', flexShrink: 1 }}>
          <CorsoText
            testID="live-desk-price"
            style={{
              ...ETHENA_TYPE.rowValue,
              color: model.priceQuiet
                ? ethena.ink.secondary
                : ethena.ink.primary,
            }}
            numberOfLines={1}
          >
            {model.priceText}
          </CorsoText>
          {model.deltaLine ? (
            <CorsoText
              testID="live-desk-delta"
              style={{
                ...ETHENA_TYPE.rowDelta,
                color: resolveDeltaInk(model.deltaDirection),
              }}
              numberOfLines={1}
            >
              {model.deltaLine}
            </CorsoText>
          ) : null}
          {model.staleLine ? (
            <CorsoText
              testID="live-desk-stale"
              style={{ ...ETHENA_TYPE.rowDelta, color: ethena.ink.secondary }}
              numberOfLines={2}
            >
              {model.staleLine}
            </CorsoText>
          ) : null}
        </View>
      </View>
      <LiveDeskLineView line={model.line} />
      <LiveDeskReads reads={model.reads} />
      <MajorWhyLineSlot mint={LIVE_DESK_MINT} />
    </View>
  );
}

function LiveDeskLineView({ line }: { line: LiveDeskCardModel['line'] }) {
  const [width, setWidth] = useState(0);
  // Per-instance gradient id: `react-native-svg` keys `url(#id)` globally,
  // and Welcome's card can still be mounted under Home's.
  const fillId = `liveDeskFill${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const onLayout = (e: LayoutChangeEvent) =>
    setWidth(Math.round(e.nativeEvent.layout.width));
  const paths =
    line.state === 'ready'
      ? liveDeskLinePaths(line.points, width - PULSE / 2, LIVE_DESK_LINE_HEIGHT)
      : null;
  return (
    <View
      testID="live-desk-line"
      onLayout={onLayout}
      // The line is the head's figures drawn; it is not a second stop.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        height: LIVE_DESK_LINE_HEIGHT,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      {line.state !== 'ready' ? (
        <CorsoText
          testID={`live-desk-line-${line.state}`}
          style={{ ...ETHENA_TYPE.rowSub, color: ethena.ink.secondary }}
        >
          {line.label}
        </CorsoText>
      ) : paths ? (
        <>
          <Svg
            width={width}
            height={LIVE_DESK_LINE_HEIGHT}
            style={{ position: 'absolute', left: 0, top: 0 }}
          >
            <Defs>
              <LinearGradient id={fillId} x1="0" x2="0" y1="0" y2="1">
                <Stop
                  offset="0"
                  stopColor={ethena.ink.primary}
                  stopOpacity={0.14}
                />
                <Stop
                  offset="1"
                  stopColor={ethena.ink.primary}
                  stopOpacity={0}
                />
              </LinearGradient>
            </Defs>
            <Path d={paths.area} fill={`url(#${fillId})`} />
            <Path
              d={paths.stroke}
              fill="none"
              stroke={ethena.ink.primary}
              strokeWidth={1.4}
              strokeLinejoin="round"
            />
          </Svg>
          <View
            testID="live-desk-pulse"
            style={{
              position: 'absolute',
              left: paths.last.x - PULSE / 2,
              top: paths.last.y - PULSE / 2,
              width: PULSE,
              height: PULSE,
              borderRadius: PULSE / 2,
              backgroundColor: ethena.ink.primary,
            }}
          />
        </>
      ) : null}
    </View>
  );
}

function LiveDeskReads({ reads }: { reads: LiveDeskCardModel['reads'] }) {
  return (
    <View
      testID="live-desk-reads"
      style={{
        gap: 10,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: ethena.hair,
      }}
    >
      {reads.cells.length > 0 ? (
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {reads.cells.map((cell) => (
            <View
              key={cell.key}
              testID={`live-desk-read-${cell.key}`}
              accessible
              accessibilityLabel={cell.accessibilityLabel}
              style={{ flex: 1, minWidth: 0, gap: 2 }}
            >
              <CorsoText
                style={{ ...ETHENA_TYPE.rowSub, color: ethena.ink.secondary }}
                numberOfLines={2}
              >
                {cell.label}
              </CorsoText>
              <CorsoText
                style={{
                  ...ETHENA_TYPE.keyValue,
                  color:
                    cell.state === 'ready'
                      ? ethena.ink.primary
                      : ethena.ink.secondary,
                }}
                numberOfLines={2}
              >
                {cell.value}
              </CorsoText>
              {cell.stamp ? (
                <CorsoText
                  style={{
                    ...ETHENA_TYPE.keyValueInfo,
                    color: ethena.ink.secondary,
                  }}
                  numberOfLines={1}
                >
                  {cell.stamp}
                </CorsoText>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}
      <View
        testID="live-desk-read-mood"
        accessible
        accessibilityLabel={reads.mood.accessibilityLabel}
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'baseline',
          columnGap: 8,
        }}
      >
        <CorsoText
          style={{
            ...ETHENA_TYPE.keyValue,
            color:
              reads.mood.state === 'ready'
                ? ethena.ink.primary
                : ethena.ink.secondary,
          }}
          numberOfLines={2}
        >
          {reads.mood.value}
        </CorsoText>
        {reads.mood.stamp ? (
          <CorsoText
            style={{ ...ETHENA_TYPE.keyValueInfo, color: ethena.ink.secondary }}
            numberOfLines={1}
          >
            {reads.mood.stamp}
          </CorsoText>
        ) : null}
      </View>
    </View>
  );
}

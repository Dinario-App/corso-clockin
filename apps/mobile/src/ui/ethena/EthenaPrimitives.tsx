import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  Pressable,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CorsoText } from '@/src/theme/CorsoText';
import {
  ETHENA_GROUND_STOPS,
  ETHENA_HIGHLIGHT,
  ethena,
  ethenaGroundColorAt,
  ethenaMaterial,
  type EthenaGradientLayer,
} from '@/constants/theme.ethena';
import { ethenaGeometry } from '@/constants/theme.ethenaGeometry';
import { ETHENA_TYPE } from '@/constants/theme.ethenaType';
import {
  resolveEthenaMaterial,
  type EthenaPlane,
} from '@/src/ui/ethena/materialLaw';
import { useEthenaMaterial } from '@/src/ui/ethena/useEthenaMaterial';
import { resolveIcyDisc } from '@/src/ui/glass/corsoGlassRecipe';
import { colors } from '@/constants/theme';
import {
  LitGroundContext,
  type LitGround,
} from '@/src/ui/primitives/litGround';
import {
  CorsoGlass,
  CorsoGlassFill,
  corsoGlassDrop,
} from '@/src/ui/glass/CorsoGlass';
import {
  resolveInkDirectionGlyph,
  type DirectionInk,
} from '@/src/ui/ethena/directionGlyph';
import { resolveDeltaInk } from '@/src/ui/ethena/deltaInk';

/* ─── The ground ──────────────────────────────────────────────────────────── */

type GradientColors = readonly [string, string, ...string[]];
type GradientLocations = readonly [number, number, ...number[]];

const GROUND_COLORS = ETHENA_GROUND_STOPS.map(
  ([, value]) => value,
) as unknown as GradientColors;
const GROUND_LOCATIONS = ETHENA_GROUND_STOPS.map(
  ([offset]) => offset,
) as unknown as GradientLocations;

const HIGHLIGHT_REACH_X = 0.3;
const HIGHLIGHT_REACH_DP = 0.34 * 260;
const HIGHLIGHT_START = { x: 1, y: 0 };

/**
 * One top-lit region decaying to void by 256dp, then void for the remaining
 * 544dp of the 800dp frame. See `theme.ethena.ts` for which column this is and
 * which one it deliberately is not.
 */
export function EthenaGround({ children }: { children?: ReactNode }) {
  const { height } = useWindowDimensions();
  const reachY = height > 0 ? Math.min(1, HIGHLIGHT_REACH_DP / height) : 0.34;
  // A scroll fade over this ground paints the ground itself, so it needs the
  // ground's view to measure against and the ground's colour at a point: the
  // two gradients drawn below, as data, read by `ethenaGroundColorAt`
  // (`ScrollEdgeFade`, `litGround.ts`). A ref and a provider: no handler, and
  // no prop of the ground's hosts changes.
  const host = useRef<View>(null);
  const [attached, setAttached] = useState(false);
  useLayoutEffect(() => setAttached(true), []);
  const layers = useMemo<EthenaGradientLayer[]>(
    () => [
      { colors: GROUND_COLORS, locations: GROUND_LOCATIONS },
      {
        colors: [ETHENA_HIGHLIGHT.color, ETHENA_HIGHLIGHT.edge],
        start: HIGHLIGHT_START,
        end: { x: HIGHLIGHT_REACH_X, y: reachY },
      },
    ],
    [reachY],
  );
  const lit = useMemo<LitGround>(
    () => ({
      dissolveColor: ETHENA_GROUND_STOPS[0]![1],
      hostRef: host,
      attached,
      colorAt: (x, y, width, height, alpha) =>
        ethenaGroundColorAt(layers, width, height, x, y, alpha),
    }),
    [layers, attached],
  );
  return (
    <LitGroundContext.Provider value={lit}>
      <View ref={host} style={{ flex: 1, backgroundColor: ethena.void }}>
        <LinearGradient
          testID="ethena-ground"
          pointerEvents="none"
          colors={GROUND_COLORS}
          locations={GROUND_LOCATIONS}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
        {/* The brushed top-right highlight. A light SOURCE, not a second colour —
            held at .07 because over a ground this quiet anything heavier reads as
            a second surface rather than as the room the screen is lit in. */}
        <LinearGradient
          testID="ethena-highlight"
          pointerEvents="none"
          colors={[ETHENA_HIGHLIGHT.color, ETHENA_HIGHLIGHT.edge]}
          start={HIGHLIGHT_START}
          end={{ x: HIGHLIGHT_REACH_X, y: reachY }}
          style={{ position: 'absolute', top: 0, right: 0, left: 0, bottom: 0 }}
        />
        {children}
      </View>
    </LitGroundContext.Provider>
  );
}

/* ─── A tray — the ground plane ───────────────────────────────────────────── */

export function EthenaTray({
  testID,
  style,
  children,
}: {
  testID: string;
  style?: ViewStyle;
  children?: ReactNode;
}) {
  const material = useEthenaMaterial('ground');
  return (
    <View
      testID={testID}
      style={[
        {
          backgroundColor: material.fill as string,
          borderRadius: ethenaGeometry.radiusBox,
          borderWidth: material.borderWidth,
          borderColor: material.borderColor ?? undefined,
          paddingHorizontal: ethenaGeometry.pad,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/* ─── A pill — float or CTA, and the geometry says they are peers ─────────── */

export const ETHENA_COMMIT_DISABLED_OPACITY = 0.4;

export function EthenaPill({
  testID,
  label,
  plane,
  onPress,
  style,
  disabled = false,
  accessibilityLabel,
}: {
  testID: string;
  label: string;
  plane: Extract<EthenaPlane, 'cta' | 'floatAction' | 'ground'>;
  onPress?: () => void;
  style?: ViewStyle;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  const material = resolveEthenaMaterial(plane);
  const { fontScale } = useWindowDimensions();
  const scale = Number.isFinite(fontScale) && fontScale > 0 ? fontScale : 1;
  const radius = ethenaGeometry.pillHeight / 2;
  const dimmedCommit = disabled && plane === 'cta';
  const inert =
    disabled && !dimmedCommit
      ? { fill: colors.primaryDisabled, label: colors.primaryDisabledLabel }
      : null;
  const frame: ViewStyle = {
    flex: 1,
    minHeight: ethenaGeometry.pillHeight,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: ethenaGeometry.pillHeight / 2,
    alignItems: 'center',
    justifyContent: 'center',
  };
  // The paint clips itself to the radius (CorsoGlassFill). The floor has to
  // clear the scaled label or the glyphs are cut. `frame` stays the peer
  // geometry.
  const fitted: ViewStyle = {
    ...frame,
    minHeight: Math.max(
      ethenaGeometry.pillHeight,
      Math.ceil(24 + ETHENA_TYPE.pill.fontSize * scale * 1.35),
    ),
    ...(inert
      ? { backgroundColor: inert.fill }
      : { boxShadow: corsoGlassDrop(material.material) }),
    ...(dimmedCommit ? { opacity: ETHENA_COMMIT_DISABLED_OPACITY } : null),
  };

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      style={[fitted, style]}
    >
      {inert ? null : (
        <CorsoGlassFill
          material={material.material}
          tint={material.tint ?? undefined}
          radius={radius}
        />
      )}
      <CorsoText
        style={{
          ...(plane === 'cta' ? ETHENA_TYPE.pillCommit : ETHENA_TYPE.pill),
          color: inert ? inert.label : material.label,
          textAlign: 'center',
        }}
      >
        {label}
      </CorsoText>
    </Pressable>
  );
}

/* ─── The one control that summons a float ────────────────────────────────── */

export function EthenaSummonDisc({
  testID,
  label,
  glyph,
  onPress,
  size = ethenaGeometry.pillHeight,
}: {
  testID: string;
  label: string;
  glyph: string;
  onPress?: () => void;
  size?: number;
}) {
  const material = resolveEthenaMaterial('summons');
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{ alignItems: 'center', gap: 8 }}
    >
      <CorsoGlass
        material={material.material}
        tint={material.tint ?? undefined}
        radius={size / 2}
        style={{
          width: size,
          height: size,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <CorsoText
          style={{ ...ETHENA_TYPE.quickGlyph, color: ethena.ink.primary }}
        >
          {glyph}
        </CorsoText>
      </CorsoGlass>
      <CorsoText
        style={{ ...ETHENA_TYPE.quickLabel, color: ethena.ink.secondary }}
      >
        {label}
      </CorsoText>
    </Pressable>
  );
}

/* ─── A quick-action disc — the quick actions that are NOT the summoner ───── */

export function EthenaQuickDisc({
  testID,
  label,
  glyph,
  onPress,
  size = ethenaGeometry.pillHeight,
  plane = 'ground',
  disabled = false,
}: {
  testID: string;
  label: string;
  glyph: string;
  onPress?: () => void;
  size?: number;
  /**
   * `'ground'` is a flat tray disc. `'cta'` is icy-cta in its disc form, for a
   * forward verb only (`FORWARD_CTA_VERBS`; the manifest in `ethenaScreens.ts`
   * is checked against that list).
   */
  plane?: Extract<EthenaPlane, 'cta' | 'ground'>;
  /**
   * Blocks the press and dims the disc to the disabled commit's 40%. The
   * label under the disc keeps its ink.
   */
  disabled?: boolean;
}) {
  const material = useEthenaMaterial(plane);
  // The icy disc's pressed veil. Held in state, not a style function: the veil
  // is a layer inside the paint, which a Pressable style cannot reach.
  const [pressed, setPressed] = useState(false);
  const dim: ViewStyle | null = disabled
    ? { opacity: ETHENA_COMMIT_DISABLED_OPACITY }
    : null;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={{ alignItems: 'center', gap: 8 }}
    >
      {plane === 'cta' ? (
        <View
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: corsoGlassDrop(material.material),
            ...dim,
          }}
        >
          <CorsoGlassFill
            material={material.material}
            radius={size / 2}
            form="disc"
            pressed={pressed && !disabled}
          />
          <CorsoText
            style={{
              ...ETHENA_TYPE.quickGlyphForward,
              color: resolveIcyDisc().label,
            }}
          >
            {glyph}
          </CorsoText>
        </View>
      ) : (
        <View
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: material.fill as string,
            borderWidth: material.borderWidth,
            borderColor: material.borderColor ?? undefined,
            alignItems: 'center',
            justifyContent: 'center',
            ...dim,
          }}
        >
          <CorsoText
            style={{ ...ETHENA_TYPE.quickGlyph, color: ethena.ink.primary }}
          >
            {glyph}
          </CorsoText>
        </View>
      )}
      <CorsoText
        style={{ ...ETHENA_TYPE.quickLabel, color: ethena.ink.secondary }}
      >
        {label}
      </CorsoText>
    </Pressable>
  );
}

/* ─── Direction — the ONLY way this layer may say up or down ──────────────── */

export function EthenaDirection({
  testID,
  direction,
  ink,
}: {
  testID: string;
  direction: 'up' | 'down';
  ink?: DirectionInk;
}) {
  if (ink) {
    const sized = resolveInkDirectionGlyph(direction, ink);
    return (
      <CorsoText testID={testID} style={sized.style}>
        {sized.glyph}
      </CorsoText>
    );
  }
  return (
    <CorsoText
      testID={testID}
      style={{
        fontSize: 10,
        lineHeight: 10,
        color: resolveDeltaInk(direction),
      }}
    >
      {direction === 'up' ? '▲' : '▼'}
    </CorsoText>
  );
}

/* ─── The floating dock ───────────────────────────────────────────────────── */

const DOCK_PADDING = 6;

export function EthenaDock({
  testID,
  items,
  activeIndex,
  onSelect,
}: {
  testID: string;
  items: readonly { label: string; glyph: string }[];
  activeIndex: number;
  onSelect?: (at: number) => void;
}) {
  const material = resolveEthenaMaterial('float');
  return (
    <CorsoGlass
      testID={testID}
      material={material.material}
      tint={material.tint ?? undefined}
      radius={ethenaGeometry.dockHeight / 2}
      style={{
        position: 'absolute',
        left: 14,
        right: 14,
        bottom: 22,
        height: ethenaGeometry.dockHeight,
        padding: DOCK_PADDING,
        flexDirection: 'row',
        alignItems: 'center',
      }}
    >
      {items.map((item, at) => (
        <Pressable
          key={item.label}
          testID={`${testID}-${item.label.toLowerCase()}`}
          onPress={() => onSelect?.(at)}
          style={{
            flex: 1,
            height: ethenaGeometry.dockHeight - DOCK_PADDING * 2,
            borderRadius: (ethenaGeometry.dockHeight - DOCK_PADDING * 2) / 2,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1,
            // The selected tab is a chip ON the float. It is NOT icy: a tab
            // commits nothing, and icy is the paint of a press that moves money.
            backgroundColor: at === activeIndex ? ethenaMaterial.v2 : undefined,
          }}
        >
          <CorsoText
            style={{
              ...ETHENA_TYPE.dockGlyph,
              color:
                at === activeIndex ? ethena.ink.primary : ethena.ink.secondary,
            }}
          >
            {item.glyph}
          </CorsoText>
          <CorsoText
            style={{
              ...ETHENA_TYPE.dockLabel,
              color:
                at === activeIndex ? ethena.ink.primary : ethena.ink.secondary,
            }}
          >
            {item.label}
          </CorsoText>
        </Pressable>
      ))}
    </CorsoGlass>
  );
}

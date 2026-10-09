import {
  createContext,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type Context,
  type ReactNode,
} from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient as GroundGradient } from 'expo-linear-gradient';
import * as SafeArea from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { LitGroundContext, type LitGround } from './litGround';
import {
  isUsableLitGroundFadeGeometry,
  resolveLitGroundFadeBands,
  sameLitGroundFadeGeometry,
  type LitGroundFadeGeometry,
} from './litGroundFadePresentation';
import {
  isScrollLinkedFadeDepth,
  resolveHorizontalEdgeFadePresentation,
  resolveScrollEdgeFadePresentation,
  type ScrollEdgeFadePresentation,
  type ScrollLinkedFadeDepth,
} from './scrollEdgeFadePresentation';

export type ScrollEdgeFadeProps = {
  top?: number | ScrollLinkedFadeDepth;
  /** Fade depth into the dock; default 30. `0` removes it. */
  bottom?: number;
  /**
   * The chrome the list scrolls *under*, in points: a docked composer, its
   * quick-action row, the floating tab bar. Default `0`.
   *
   * The bottom mask is drawn as `bottom` + `bottomCover`: it ramps to full
   * canvas across `bottom` and then HOLDS that canvas for `bottomCover`, so the
   * dissolve happens at the dock's top edge and nothing bleeds out unmasked
   * below it. A scroller whose bottom edge really is the screen's edge — every
   * screen with no dock — leaves this alone.
   */
  bottomCover?: number;
  /** The canvas colour the content dissolves into. */
  color?: string;
  testID?: string;
};

/**
 * Scroll-edge fades for a vertical scroller. Place it as the LAST child of the
 * `View` that wraps the `ScrollView` (the wrapper must be `position: relative`
 * / `flex: 1`); it pins itself to the wrapper's top and bottom edges and never
 * intercepts touches.
 */
export function ScrollEdgeFade({
  top,
  bottom,
  bottomCover,
  color,
  testID,
}: ScrollEdgeFadeProps) {
  const linked = isScrollLinkedFadeDepth(top) ? top : null;
  const fade = resolveScrollEdgeFadePresentation({
    top: isScrollLinkedFadeDepth(top) ? top.max : top,
    bottom,
    bottomCover,
    color,
  });
  const key = useId().replace(/[^a-zA-Z0-9]/g, '');
  const topId = `scrollFadeTop${key}`;
  const bottomId = `scrollFadeBottom${key}`;
  /*
   * One colour, edge to transparent: the whole fade on a flat ground, and what
   * a fade on a lit ground falls back to until it has been measured.
   */
  const flatTop =
    fade.top > 0 ? (
      <Svg
        width="100%"
        height={fade.top}
        style={[styles.edge, { top: 0 }]}
        pointerEvents="none"
      >
        <Defs>
          <LinearGradient id={topId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={fade.color} stopOpacity={1} />
            <Stop offset="1" stopColor={fade.color} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill={`url(#${topId})`}
        />
      </Svg>
    ) : null;
  const flatBottom =
    fade.bottomTotal > 0 ? (
      <Svg
        width="100%"
        height={fade.bottomTotal}
        style={[styles.edge, { bottom: 0 }]}
        pointerEvents="none"
      >
        <Defs>
          <LinearGradient id={bottomId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={fade.color} stopOpacity={0} />
            {/* Full canvas at the dock's top edge … */}
            <Stop
              offset={fade.bottomStop}
              stopColor={fade.color}
              stopOpacity={1}
            />
            {/* … and held there for the whole dock. */}
            <Stop offset="1" stopColor={fade.color} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill={`url(#${bottomId})`}
        />
      </Svg>
    ) : null;
  /*
   * A fade that names a lit ground's own dissolve colour, mounted inside that
   * ground, paints the ground instead of the colour. Every other fade (any
   * other colour, or no lit ground above it) draws `flat`, as it always has.
   */
  const ground = useContext(LitGroundContext);
  if (ground !== null && sameColor(fade.color, ground.dissolveColor)) {
    return (
      <LitGroundFade
        ground={ground}
        fade={fade}
        linked={linked}
        flatTop={flatTop}
        flatBottom={flatBottom}
        testID={testID}
      />
    );
  }
  return (
    <View {...OVERLAY} testID={testID}>
      {linked === null ? (
        flatTop
      ) : (
        <ScrollLinkedBand depth={linked} height={fade.top}>
          {flatTop}
        </ScrollLinkedBand>
      )}
      {flatBottom}
    </View>
  );
}

/** The fade's own box: pinned to the scroller's wrapper, never a touch target. */
const OVERLAY = {
  style: StyleSheet.absoluteFill,
  pointerEvents: 'none',
  accessible: false,
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
} as const;

const sameColor = (a: string, b: string): boolean =>
  a.trim().toLowerCase() === b.trim().toLowerCase();

const NoInsets = createContext<unknown>(null);
const InsetsContext: Context<unknown> =
  (SafeArea as { SafeAreaInsetsContext?: Context<unknown> })
    .SafeAreaInsetsContext ?? NoInsets;

/** When a lit fade asks the layout again after its ground changes. */
const REMEASURE_AFTER_MS = [0, 50, 250, 1000] as const;

type Measurable = {
  measureLayout?: (
    relativeTo: unknown,
    onSuccess: (x: number, y: number, width: number, height: number) => void,
    onFail?: () => void,
  ) => void;
};

/**
 * A top band whose depth follows a scroller. It is laid out `height` deep and
 * scaled, from its top edge, to the depth the scroller has reached: the ramp
 * inside still runs from full at the edge to nothing at the foot, at whatever
 * depth. The scale is set natively when the depth changes (`setNativeProps`),
 * so a scroll event renders nothing.
 */
function ScrollLinkedBand({
  depth,
  height,
  children,
}: {
  depth: ScrollLinkedFadeDepth;
  height: number;
  children: ReactNode;
}) {
  const band = useRef<View>(null);
  useLayoutEffect(() => {
    const apply = (next: number) => {
      const host = band.current as NativeProps | null;
      host?.setNativeProps?.({ style: { transform: scaleTo(next, height) } });
    };
    apply(depth.current);
    return depth.subscribe(apply);
  }, [depth, height]);
  return (
    <View
      ref={band}
      pointerEvents="none"
      style={[
        styles.linked,
        { height, transform: scaleTo(depth.current, height) },
      ]}
    >
      {children}
    </View>
  );
}

/**
 * A lit band's colours are the ground's at each row, so scaling a band squeezes
 * colours meant for `height` dp of ground into fewer: by its foot a band scaled
 * to depth d shows the ground from up to `height - d` dp lower down. Drawn
 * 44 dp deep and scaled to 1, that is over a level of tint. So a growing lit
 * band is drawn at the next multiple of this step above its depth, never more
 * than a step too deep, which keeps the tint under a third of a level. The
 * fade re-draws when its depth crosses a step: at most three times while it
 * grows to 44 dp, and never once it is there.
 */
const LINKED_BAND_STEP = 11;

const drawnDepthFor = (depth: number, max: number): number =>
  Math.min(
    max,
    LINKED_BAND_STEP * Math.max(1, Math.ceil(depth / LINKED_BAND_STEP)),
  );

type NativeProps = {
  setNativeProps?: (props: { style: { transform: { scaleY: number }[] } }) => void;
};

const scaleTo = (depth: number, drawn: number): { scaleY: number }[] => [
  { scaleY: drawn > 0 ? Math.max(0, Math.min(1, depth / drawn)) : 0 },
];

function LitGroundFade({
  ground,
  fade,
  linked,
  flatTop,
  flatBottom,
  testID,
}: {
  ground: LitGround;
  fade: ScrollEdgeFadePresentation;
  linked: ScrollLinkedFadeDepth | null;
  flatTop: ReactNode;
  flatBottom: ReactNode;
  testID?: string;
}) {
  const box = useRef<View>(null);
  const [geometry, setGeometry] = useState<LitGroundFadeGeometry | null>(null);
  const measured = useRef<LitGroundFadeGeometry | null>(null);
  useContext(InsetsContext);
  const measure = () => {
    const self = box.current as Measurable | null;
    const host = ground.hostRef.current;
    if (
      self === null ||
      host === null ||
      typeof self.measureLayout !== 'function' ||
      typeof host.measure !== 'function'
    ) {
      return;
    }
    // Compared before setting: an unchanged answer must not schedule a render
    // (this runs after every render, and a set inside a layout effect cannot
    // bail out early).
    const settle = (next: LitGroundFadeGeometry | null) => {
      if (sameLitGroundFadeGeometry(measured.current, next)) return;
      measured.current = next;
      setGeometry(next);
    };
    host.measure((_x, _y, groundWidth, groundHeight) => {
      self.measureLayout?.(
        host,
        (x, y, width, height) => {
          const next = { x, y, width, height, groundWidth, groundHeight };
          settle(isUsableLitGroundFadeGeometry(next) ? next : null);
        },
        () => settle(null),
      );
    });
  };
  // No dependency list: layout can move the fade without changing any prop.
  useLayoutEffect(measure);
  /*
   * And again shortly after the ground changes (mount, a new window size): a
   * `SafeAreaView` above the fade takes its inset in a native layout pass that
   * follows the first commit and renders nothing here. A stale answer misplaces
   * the colours by that inset, a level or two, until the next render.
   */
  useEffect(() => {
    const self = box.current as Measurable | null;
    if (self === null || typeof self.measureLayout !== 'function') {
      return undefined;
    }
    const timers = REMEASURE_AFTER_MS.map((ms) => setTimeout(measure, ms));
    return () => timers.forEach(clearTimeout);
    // `measure` reads refs and this render's ground; the ground is the key.
  }, [ground]);
  /*
   * How deep a scroll-linked top band is DRAWN (see `LINKED_BAND_STEP`). State,
   * but of this fade alone, and it changes only when the depth crosses a step.
   */
  const [drawnTop, setDrawnTop] = useState(() =>
    linked === null ? fade.top : drawnDepthFor(linked.current, fade.top),
  );
  const drawn = useRef(drawnTop);
  useLayoutEffect(() => {
    // Compared before setting, so a scroll event that crosses no step
    // schedules nothing at all.
    const draw = (next: number) => {
      if (drawn.current === next) return;
      drawn.current = next;
      setDrawnTop(next);
    };
    if (linked === null) {
      draw(fade.top);
      return undefined;
    }
    draw(drawnDepthFor(linked.current, fade.top));
    return linked.subscribe((depth) =>
      draw(drawnDepthFor(depth, fade.top)),
    );
  }, [linked, fade.top]);
  const { bottom, bottomCover, bottomTotal } = fade;
  const top = drawnTop;
  const bands = useMemo(
    () =>
      geometry === null
        ? null
        : resolveLitGroundFadeBands(
            { top, bottom, bottomCover, bottomTotal },
            geometry,
            ground.colorAt,
          ),
    [top, bottom, bottomCover, bottomTotal, geometry, ground.colorAt],
  );
  const paint = (edge: 'top' | 'bottom', flat: ReactNode): ReactNode => {
    const band = bands?.find((candidate) => candidate.edge === edge);
    if (bands === null) return flat;
    if (band === undefined) return null;
    return band.columns.map((column) => (
      <GroundGradient
        key={column.key}
        pointerEvents="none"
        colors={column.colors}
        locations={column.locations}
        style={[styles.column, { left: column.left, width: column.width }]}
      />
    ));
  };
  const topBand = bands?.find((band) => band.edge === 'top');
  const bottomBand = bands?.find((band) => band.edge === 'bottom');
  const topNode = paint('top', flatTop);
  return (
    <View ref={box} {...OVERLAY} testID={testID}>
      {linked !== null ? (
        <ScrollLinkedBand
          depth={linked}
          // The flat ramp it falls back to is always drawn at full depth.
          height={bands === null ? fade.top : top}
        >
          {topNode}
        </ScrollLinkedBand>
      ) : topBand ? (
        <View
          pointerEvents="none"
          style={[styles.band, { top: topBand.top, height: topBand.height }]}
        >
          {topNode}
        </View>
      ) : (
        topNode
      )}
      {bottomBand ? (
        <View
          pointerEvents="none"
          style={[
            styles.band,
            { top: bottomBand.top, height: bottomBand.height },
          ]}
        >
          {paint('bottom', flatBottom)}
        </View>
      ) : (
        paint('bottom', flatBottom)
      )}
    </View>
  );
}

export type HorizontalEdgeFadeProps = {
  stop?: number;
  /** The canvas colour the row dissolves into. */
  color?: string;
  testID?: string;
};

export function HorizontalEdgeFade({
  stop,
  color,
  testID,
}: HorizontalEdgeFadeProps) {
  const fade = resolveHorizontalEdgeFadePresentation({ stop, color });
  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID={testID}
    >
      <Svg width="100%" height="100%" pointerEvents="none">
        <Defs>
          <LinearGradient id="rowFadeRight" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={fade.color} stopOpacity={0} />
            <Stop offset={fade.offset} stopColor={fade.color} stopOpacity={0} />
            <Stop offset="1" stopColor={fade.color} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="url(#rowFadeRight)"
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  edge: { position: 'absolute', left: 0, right: 0 },
  band: { position: 'absolute', left: 0, right: 0 },
  linked: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    transformOrigin: 'top',
  },
  column: { position: 'absolute', top: 0, bottom: 0 },
});

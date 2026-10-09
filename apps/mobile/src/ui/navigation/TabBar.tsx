import { useEffect, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTabTrigger } from 'expo-router/ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAccessibilityPreference } from '@/src/motion/useAccessibilityPreference.js';
import { Material } from '@/src/ui/glass/Material';
import {
  BlurTargetContext,
  type MaterialBlurTargetRef,
  useMaterialBlurTarget,
} from '@/src/ui/glass/blurTargetContext';
import { CorsoGlass } from '@/src/ui/glass/CorsoGlass';
import { CorsoIcon } from '@/src/ui/icons/CorsoIcon';
import { resolveEthenaMaterial } from '@/src/ui/ethena/materialLaw';
import { colors, radii, typography } from '@/src/ui/tokens';
import {
  TAB_ACTIVE_CAPSULE_INSET,
  TAB_BAR_HEIGHT,
  TAB_BAR_INSET,
  TAB_BAR_LABEL_SIZE,
  TAB_BAR_MOTION_MS,
  TAB_BAR_RADIUS,
  LAUNCH_DOCK_ITEMS,
  resolveTabBarPresentation,
  resolveTabRoots,
  resolveTabItemPresentation,
  type DockItem,
  type TabRoot,
} from './tabBarPresentation';
import { readLaunchDockBuildFlag } from '@/src/features/navigation/launchDockEnv';
import {
  readTabBarVisibility,
  subscribeTabBarVisibility,
} from './tabBarVisibility';

const ICON_SIZE = 20;
const SUMMON_RING_SIZE = 48;

function TabItem({ root }: { root: TabRoot }) {
  const { trigger, triggerProps } = useTabTrigger({
    name: root.name,
    href: root.href,
  });
  const item = resolveTabItemPresentation({
    focused: trigger?.isFocused === true,
  });
  return (
    <Pressable
      onPress={triggerProps.onPress}
      onLongPress={triggerProps.onLongPress}
      accessibilityRole="tab"
      accessibilityLabel={root.label}
      accessibilityState={item.accessibilityState}
      style={[
        styles.item,
        item.capsuleColor === null
          ? null
          : { backgroundColor: item.capsuleColor },
      ]}
      testID={`tab-${root.name}`}
    >
      <CorsoIcon name={root.glyph} size={ICON_SIZE} color={item.color} />
      <Text style={[styles.label, { color: item.color }]}>{root.label}</Text>
    </Pressable>
  );
}

function DockSummonRing({
  item,
}: {
  item: Extract<DockItem, { kind: 'summon' }>;
}) {
  const material = resolveEthenaMaterial('summons');
  return (
    <View style={styles.summonSlot}>
      <Pressable
        onPress={() => router.push(item.href)}
        accessibilityRole="button"
        accessibilityLabel={item.label}
        hitSlop={6}
        testID={`tab-${item.key}`}
      >
        <CorsoGlass
          material={material.material}
          tint={material.tint ?? undefined}
          radius={SUMMON_RING_SIZE / 2}
          style={styles.summonRing}
        >
          <Text style={styles.summonGlyph}>{item.glyph}</Text>
        </CorsoGlass>
      </Pressable>
    </View>
  );
}

export function TabBar({
  children,
  blurTarget,
}: {
  children?: ReactNode;
  blurTarget?: MaterialBlurTargetRef;
}) {
  const targetAbove = useMaterialBlurTarget();
  const insets = useSafeAreaInsets();
  const { reduceMotion } = useAccessibilityPreference();
  const visibility = useSyncExternalStore(
    subscribeTabBarVisibility,
    readTabBarVisibility,
    readTabBarVisibility,
  );
  const bar = resolveTabBarPresentation({
    hidden: visibility.hidden,
    safeAreaBottom: insets.bottom,
    reduceMotion,
  });
  const translateY = useRef(new Animated.Value(bar.translateY)).current;
  const opacity = useRef(new Animated.Value(bar.opacity)).current;

  useEffect(() => {
    if (!bar.animate) {
      translateY.setValue(bar.translateY);
      opacity.setValue(bar.opacity);
      return;
    }
    const motion = Animated.parallel([
      Animated.timing(translateY, {
        toValue: bar.translateY,
        duration: TAB_BAR_MOTION_MS,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: bar.opacity,
        duration: TAB_BAR_MOTION_MS,
        useNativeDriver: true,
      }),
    ]);
    motion.start();
    return () => motion.stop();
  }, [bar.animate, bar.opacity, bar.translateY, opacity, translateY]);

  return (
    <Animated.View
      pointerEvents={visibility.hidden ? 'none' : 'box-none'}
      accessibilityElementsHidden={visibility.hidden}
      importantForAccessibility={
        visibility.hidden ? 'no-hide-descendants' : 'auto'
      }
      style={[
        styles.dock,
        { bottom: bar.bottom, opacity, transform: [{ translateY }] },
      ]}
      testID="tab-bar"
    >
      <BlurTargetContext.Provider value={blurTarget ?? targetAbove}>
        <Material
          weight="float"
          radius={TAB_BAR_RADIUS}
          contentStyle={styles.row}
          hug
          testID="tab-bar-glass"
        >
          {/*
            `children` are the literal `<TabTrigger name href />` elements the
            layout places inside `<TabList asChild>`: the headless router parses
            them statically to register the four roots. They render zero-size
            here; `useTabTrigger` inside TabItem drives the visible press.
          */}
          <View style={styles.registry} pointerEvents="none">
            {children}
          </View>
          {readLaunchDockBuildFlag()
            ? LAUNCH_DOCK_ITEMS.map((item) =>
                item.kind === 'summon' ? (
                  <DockSummonRing key={item.key} item={item} />
                ) : (
                  <TabItem key={item.key} root={item.root} />
                ),
              )
            : resolveTabRoots({}).map((root) => (
                <TabItem key={root.name} root={root} />
              ))}
        </Material>
      </BlurTargetContext.Provider>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  dock: {
    position: 'absolute',
    left: TAB_BAR_INSET,
    right: TAB_BAR_INSET,
  },
  row: {
    height: TAB_BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 6,
  },
  registry: {
    position: 'absolute',
    width: 0,
    height: 0,
    overflow: 'hidden',
  },
  item: {
    flex: 1,
    height: TAB_BAR_HEIGHT - 2 * TAB_ACTIVE_CAPSULE_INSET,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  summonSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summonRing: {
    width: SUMMON_RING_SIZE,
    height: SUMMON_RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summonGlyph: {
    fontSize: 18,
    color: colors.ink,
  },
  label: {
    fontSize: TAB_BAR_LABEL_SIZE,
    fontFamily: typography.face('600'),
    fontWeight: '600',
    letterSpacing: 0.1,
  },
});

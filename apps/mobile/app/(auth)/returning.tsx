import { useCallback, useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import {
  Animated,
  BackHandler,
  Easing,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { copy } from '@/constants/copy';
import { ethena } from '@/constants/theme.ethena';
import { ethenaGeometry } from '@/constants/theme.ethenaGeometry';
import { ETHENA_TYPE } from '@/constants/theme.ethenaType';
import { LOCKED_GROUND_PARI_BOX } from '@/src/features/lock/lockedGroundPresentation';
import {
  markReturningDinarioNoteSeen,
  placeReturningNoteMark,
  resolveReturningNoteHeadlineTop,
  resolveReturningNoteLayout,
} from '@/src/features/session/returningDinarioNote';
import { useAccessibilityPreference } from '@/src/motion/useAccessibilityPreference';
import { CorsoText } from '@/src/theme/CorsoText';
import { PariMark } from '@/src/ui/brand/PariMark';
import { ScrollEdgeFade } from '@/src/ui/primitives/ScrollEdgeFade';
import { useScrollLinkedFadeTop } from '@/src/ui/primitives/useScrollLinkedFadeTop';
import { IcyCta } from '@/src/ui/quiet/QuietButtons';
import { QuietMarkCanvas } from '@/src/ui/quiet/QuietMarkCanvas';
import {
  QUIET_GUTTER,
  QUIET_INK,
  QUIET_MUTE,
  resolveQuietFrameTransform,
} from '@/src/ui/quiet/quietMarkPresentation';

/** The gesture inset the CTA stands 16 above when the phone reports less. */
const GESTURE_INSET = 24;

export default function ReturningDinarioNoteScreen() {
  const window = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { reduceMotion } = useAccessibilityPreference();
  const frame = resolveQuietFrameTransform(window);
  const mark = placeReturningNoteMark(frame);
  const headlineTop = resolveReturningNoteHeadlineTop(frame);
  const words = copy.welcome.returningDinario;
  const scrollFade = useScrollLinkedFadeTop();

  const [layout, setLayout] = useState<'measuring' | 'regular' | 'compact'>(
    'measuring',
  );
  const viewportHeight = useRef(0);
  const wordsHeight = useRef(0);
  const decide = useCallback(() => {
    if (viewportHeight.current <= 0 || wordsHeight.current <= 0) return;
    setLayout((current) =>
      current === 'measuring'
        ? resolveReturningNoteLayout({
            wordsBottom: headlineTop + wordsHeight.current,
            ctaTop: viewportHeight.current,
          })
        : current,
    );
  }, [headlineTop]);
  const onViewport = (event: LayoutChangeEvent) => {
    viewportHeight.current = event.nativeEvent.layout.height;
    decide();
  };
  const onWords = (event: LayoutChangeEvent) => {
    wordsHeight.current = event.nativeEvent.layout.height;
    decide();
  };

  const leaving = useRef(false);
  const leave = useCallback(async () => {
    if (leaving.current) return;
    leaving.current = true;
    // Written before navigation, so a kill mid-transition never shows it again.
    try {
      await markReturningDinarioNoteSeen(AsyncStorage);
    } catch {
      // The note never traps the user; at worst it shows once more.
    }
    router.replace('/(auth)/welcome');
  }, []);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      void leave();
      return true;
    });
    return () => sub.remove();
  }, [leave]);

  const compact = layout === 'compact';
  const markLift = useRef(new Animated.Value(0)).current;
  const wordsIn = useRef(new Animated.Value(0)).current;
  const ctaIn = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (layout === 'measuring') return;
    if (reduceMotion) {
      const fade = { toValue: 1, duration: 200, useNativeDriver: true };
      Animated.parallel([
        Animated.timing(markLift, fade),
        Animated.timing(wordsIn, fade),
        Animated.timing(ctaIn, fade),
      ]).start();
      return;
    }
    const ease = Easing.out(Easing.cubic);
    Animated.parallel([
      Animated.timing(markLift, {
        toValue: 1,
        duration: 480,
        easing: ease,
        useNativeDriver: true,
      }),
      Animated.timing(wordsIn, {
        toValue: 1,
        duration: 360,
        delay: 120,
        easing: ease,
        useNativeDriver: true,
      }),
      Animated.timing(ctaIn, {
        toValue: 1,
        duration: 360,
        delay: 240,
        easing: ease,
        useNativeDriver: true,
      }),
    ]).start();
  }, [layout, reduceMotion, markLift, wordsIn, ctaIn]);

  // The launch frame draws the mark at the splash centre and size; the lift
  // starts there. Reduce Motion skips the lift and fades in place.
  const fromScale = LOCKED_GROUND_PARI_BOX / mark.size;
  const fromX = window.width / 2 - (mark.left + mark.size / 2);
  const fromY = window.height / 2 - (mark.top + mark.size / 2);
  const markMotion = reduceMotion
    ? { opacity: markLift }
    : {
        transform: [
          {
            translateX: markLift.interpolate({
              inputRange: [0, 1],
              outputRange: [fromX, 0],
            }),
          },
          {
            translateY: markLift.interpolate({
              inputRange: [0, 1],
              outputRange: [fromY, 0],
            }),
          },
          {
            scale: markLift.interpolate({
              inputRange: [0, 1],
              outputRange: [fromScale, 1],
            }),
          },
        ],
      };
  const rise = (value: Animated.Value) =>
    reduceMotion
      ? { opacity: value }
      : {
          opacity: value,
          transform: [
            {
              translateY: value.interpolate({
                inputRange: [0, 1],
                outputRange: [8, 0],
              }),
            },
          ],
        };

  return (
    <View style={styles.root} testID="returning-note">
      <StatusBar style="light" />
      <QuietMarkCanvas variant="note" />
      {compact ? null : (
        <Animated.View
          style={[
            styles.mark,
            { left: mark.left, top: mark.top },
            layout === 'measuring' ? styles.hidden : markMotion,
          ]}
        >
          <PariMark
            testID="returning-note-mark"
            size={mark.size}
            accessible
            accessibilityRole="image"
            accessibilityLabel={copy.welcome.wordmark}
          />
        </Animated.View>
      )}
      <View style={styles.viewport} onLayout={onViewport}>
        <ScrollView
          {...scrollFade.scroller}
          contentContainerStyle={{
            paddingTop: compact ? insets.top + 24 : headlineTop,
            paddingHorizontal: compact ? ethenaGeometry.gutter : QUIET_GUTTER,
            paddingBottom: 24,
          }}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <Animated.View
            testID="returning-note-words"
            onLayout={onWords}
            style={layout === 'measuring' ? styles.hidden : rise(wordsIn)}
          >
            <CorsoText
              accessibilityRole="header"
              maxFontSizeMultiplier={1.3}
              textBreakStrategy="balanced"
              style={styles.headline}
            >
              {words.headline}
            </CorsoText>
            <View style={styles.body}>
              {words.body.map((line) => (
                <CorsoText key={line} style={styles.paragraph}>
                  {line}
                </CorsoText>
              ))}
            </View>
          </Animated.View>
        </ScrollView>
        <ScrollEdgeFade top={scrollFade.top} color={ethena.void} />
      </View>
      <Animated.View
        style={[
          styles.cta,
          { paddingBottom: Math.max(insets.bottom, GESTURE_INSET) + 16 },
          layout === 'measuring' ? styles.hidden : rise(ctaIn),
        ]}
      >
        <IcyCta
          testID="returning-note-continue"
          size="door"
          label={words.cta}
          onPress={() => {
            void leave();
          }}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: ethena.void },
  mark: { position: 'absolute' },
  hidden: { opacity: 0 },
  viewport: { flex: 1 },
  /** The title rung, centred, capped at 1.3x so it holds 2 lines at 2.0. */
  headline: {
    ...ETHENA_TYPE.title,
    color: QUIET_INK,
    textAlign: 'center',
  },
  /** 12 under the headline; one paragraph per fact, 8 apart. */
  body: { marginTop: 12, gap: 8 },
  paragraph: {
    ...ETHENA_TYPE.sub,
    fontWeight: '500',
    color: QUIET_MUTE,
    textAlign: 'center',
  },
  /** Welcome's provider-button column: 16 gutters, the same thumb zone. */
  cta: { paddingHorizontal: ethenaGeometry.gutter },
});

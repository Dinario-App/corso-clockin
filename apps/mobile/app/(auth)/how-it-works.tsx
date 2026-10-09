import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  PanResponder,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import Reanimated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { copy } from '@/constants/copy';
import { CorsoText } from '@/src/theme/CorsoText';
import { useCorsoSession } from '@/src/features/session/SessionContext';
import { parseByoAiFlags } from '@/src/features/aiConnect/flags';
import { goBackOr } from '@/src/features/navigation/goBackOr';
import { BACK_FALLBACK } from '@/src/features/navigation/guardedBack';
import { markHowItWorksSeen } from '@/src/features/howItWorks/howItWorksPreference';
import {
  HOW_IT_WORKS_ASK,
  HOW_IT_WORKS_VERDICT,
  resolveHowItWorksPickerMenu,
} from '@/src/features/howItWorks/howItWorksFixtures';
import {
  HOW_IT_WORKS_REPLAY_PARAM,
  parseHowItWorksReplay,
  resolveHowItWorksBeats,
  resolveHowItWorksExit,
  resolveHowItWorksMotion,
  resolveHowItWorksPage,
  resolveHowItWorksPageFadeBottom,
  shouldMarkHowItWorksSeen,
  stepHowItWorksPage,
  type HowItWorksFlagInput,
  type HowItWorksLeave,
} from '@/src/features/howItWorks/howItWorksPresentation';
import {
  HowItWorksScene,
  useHowItWorksCues,
  useHowItWorksFade,
} from '@/src/features/howItWorks/HowItWorksScenes';
import { resolveHowItWorksBeatTimeline } from '@/src/features/howItWorks/howItWorksTimeline';
import {
  HOW_IT_WORKS_GROUND_FADE,
  HowItWorksGround,
} from '@/src/features/howItWorks/HowItWorksFrame';
import {
  createHowItWorksVisit,
  planHowItWorksLeaveEvents,
  reportHowItWorksCompleted,
  reportHowItWorksSkipped,
  reportHowItWorksViewed,
} from '@/src/lib/aiConnectAnalytics';
import {
  feeBpsOrNullFromStatus,
  resolveFeeBpsStatus,
  resolveBotsEnabled,
  resolveByoAiFlags,
} from '@/src/lib/apiConfig';
import { useAccessibilityPreference } from '@/src/motion/useAccessibilityPreference';
import { CANON_TYPE_SIZES, canonTracking } from '@/src/ui/cards/canonType';
import { PrimaryCTA } from '@/src/ui/controls/PrimaryCTA';
import { SecondaryCTA } from '@/src/ui/controls/SecondaryCTA';
import { TextButton } from '@/src/ui/controls/TextButton';
import { ScrollEdgeFade } from '@/src/ui/primitives/ScrollEdgeFade';
import { colors, kitType, spacing, typography } from '@/src/ui/tokens';

export default function HowItWorksScreen() {
  const { session, needsLockSetup, phase } = useCorsoSession();
  const { reduceMotion } = useAccessibilityPreference();
  const params = useLocalSearchParams<{
    [HOW_IT_WORKS_REPLAY_PARAM]?: string;
  }>();
  const replay = parseHowItWorksReplay(params[HOW_IT_WORKS_REPLAY_PARAM]);
  const { width } = useWindowDimensions();
  const [flags, setFlags] = useState<HowItWorksFlagInput | null>(null);
  const [feeBps, setFeeBps] = useState<number | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const countRef = useRef(1);
  const visitRef = useRef(createHowItWorksVisit());

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      resolveBotsEnabled().catch(() => false),
      resolveByoAiFlags().catch(() => parseByoAiFlags(undefined)),
    ]).then(([botsEnabled, byo]) => {
      if (cancelled) return;
      setFlags({
        botsEnabled,
        byoAiEnabled: byo.byoAiEnabled,
        chatgptEnabled: byo.chatgptEnabled,
        grokEnabled: byo.grokEnabled,
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void resolveFeeBpsStatus()
      .then((status) => {
        if (!cancelled) setFeeBps(feeBpsOrNullFromStatus(status));
      })
      .catch(() => {
        if (!cancelled) setFeeBps(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const beats = useMemo(
    () => (flags ? resolveHowItWorksBeats(flags) : []),
    [flags],
  );
  const page = useMemo(
    () =>
      beats.length > 0
        ? resolveHowItWorksPage({ index: pageIndex, beats })
        : null,
    [beats, pageIndex],
  );
  countRef.current = page?.dotCount ?? 1;
  const picker = useMemo(
    () =>
      resolveHowItWorksPickerMenu({
        chatgptEnabled: flags?.chatgptEnabled ?? false,
        grokEnabled: flags?.grokEnabled ?? false,
      }),
    [flags?.chatgptEnabled, flags?.grokEnabled],
  );

  const beatId = page?.beat.id ?? null;
  const isLast = page?.isLast ?? false;
  const introVisible =
    phase !== 'booting' &&
    flags != null &&
    page != null &&
    session != null &&
    !needsLockSetup;

  useEffect(() => {
    if (!introVisible || beatId == null) return;
    try {
      if (visitRef.current.noteViewed(beatId, replay)) {
        const beat = beatId;
        reportHowItWorksViewed({ beat });
      }
    } catch {
      // Fire-and-forget: analytics must never alter paging.
    }
  }, [introVisible, beatId, replay]);

  const timeline = useMemo(
    () =>
      beatId === null
        ? null
        : resolveHowItWorksBeatTimeline({
            beat: beatId,
            isLast,
            reduceMotion,
            typedLength: HOW_IT_WORKS_ASK.length,
            evidenceCount: HOW_IT_WORKS_VERDICT.evidence.length,
          }),
    // A new page is a new timeline, even when it shows the same beat again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [beatId, isLast, reduceMotion, page?.index],
  );
  const cues = useHowItWorksCues(timeline);
  const headlineStyle = useHowItWorksFade(cues.channels.headline);
  const bodyStyle = useHowItWorksFade(cues.channels.body);
  const sceneStyle = useHowItWorksFade(cues.channels.scene);
  const ctaStyle = useHowItWorksFade(cues.channels.cta);

  const motion = resolveHowItWorksMotion({
    reduceMotion,
    isLastBeat: isLast,
    ctaCueArmed: cues.ctaArmed,
  });

  /* The page slide: the new page comes in from the side it was paged toward. */
  const slide = useSharedValue(0);
  const shownIndex = useRef<number | null>(null);
  useEffect(() => {
    if (page == null) return;
    const from = shownIndex.current;
    shownIndex.current = page.index;
    const direction = from === null ? 0 : Math.sign(page.index - from);
    if (direction === 0 || motion.pageDurationMs === 0) {
      slide.value = 0;
      return;
    }
    slide.value = direction * width;
    slide.value = withTiming(0, {
      duration: motion.pageDurationMs,
      easing: Easing.out(Easing.cubic),
    });
  }, [page?.index, motion.pageDurationMs, width, slide]);
  const slideStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: slide.value }],
  }));

  const go = (delta: number) => {
    if (!page) return;
    setPageIndex((current) =>
      stepHowItWorksPage(current, page.dotCount, delta),
    );
  };

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dx) > 12 &&
        Math.abs(gesture.dx) > Math.abs(gesture.dy),
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx < -40) {
          setPageIndex((current) =>
            stepHowItWorksPage(current, countRef.current, 1),
          );
        } else if (gesture.dx > 40) {
          setPageIndex((current) =>
            stepHowItWorksPage(current, countRef.current, -1),
          );
        }
      },
    }),
  ).current;

  async function leave(choice: HowItWorksLeave) {
    try {
      const plan = planHowItWorksLeaveEvents({
        replay,
        choice,
        isLast,
        beat: beatId,
      });
      if (plan.skippedBeat) {
        const beat = plan.skippedBeat;
        reportHowItWorksSkipped({ beat });
      }
      if (plan.completed) {
        reportHowItWorksCompleted();
      }
    } catch {
      // Fire-and-forget: analytics must never block skip or finish.
    }
    if (shouldMarkHowItWorksSeen(replay)) {
      try {
        await markHowItWorksSeen(AsyncStorage);
      } catch {
        /* non-fatal — do not brick the first Home */
      }
    }
    const exit = resolveHowItWorksExit({ choice, replay });
    if (exit.kind === 'back') {
      goBackOr(BACK_FALLBACK.shell);
      return;
    }
    router.replace(exit.href);
  }

  if (phase === 'booting' || flags == null || page == null) {
    return (
      <HowItWorksGround>
        <View style={styles.boot}>
          <ActivityIndicator color={colors.ink} />
        </View>
      </HowItWorksGround>
    );
  }

  if (!session) {
    return <Redirect href="/(auth)/welcome" />;
  }

  if (needsLockSetup) {
    return <Redirect href="/(auth)/lock-setup" />;
  }

  const words = copy.howItWorks;
  const ctaDisabled = !motion.ctaArmed;

  return (
    <HowItWorksGround>
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <View style={styles.body} {...pan.panHandlers}>
        <View style={styles.header}>
          {page.showSkip ? (
            <TextButton
              label={words.skip}
              tone="muted"
              size="inline"
              onPress={() => {
                void leave('skip');
              }}
              labelStyle={styles.skip}
              accessibilityLabel={words.skip}
            />
          ) : null}
        </View>

        <Reanimated.View style={[styles.page, slideStyle]}>
          {/*
            One scroller holds the headline, the body and the scene, in that
            order, so the scene starts under the body line whatever its height.
            A scene that fits still rests on the dots (the content grows to the
            page); one that does not scrolls instead of climbing over the
            headline. Keyed by page so each page opens at its top, in a new
            scroller with its own measurements.
          */}
          <HowItWorksPageScroller key={page.index}>
            <View
              accessible
              accessibilityRole="summary"
              accessibilityLabel={`${page.beat.headline} ${page.beat.body}`}
              accessibilityLiveRegion="polite"
            >
              <Reanimated.View style={headlineStyle}>
                <CorsoText style={styles.headline} accessibilityRole="header">
                  {page.beat.headline}
                </CorsoText>
              </Reanimated.View>
              <Reanimated.View style={bodyStyle}>
                <CorsoText style={styles.copy}>{page.beat.body}</CorsoText>
              </Reanimated.View>
            </View>

            <Reanimated.View
              style={[styles.scene, sceneStyle]}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <CorsoText style={styles.example}>{words.example}</CorsoText>
              <HowItWorksScene
                beat={page.beat.id}
                cues={cues}
                reduceMotion={reduceMotion}
                picker={picker}
                feeBps={feeBps}
              />
            </Reanimated.View>
          </HowItWorksPageScroller>
        </Reanimated.View>

        <View
          style={styles.dots}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={copy.a11y.pageA11y(page.index + 1, page.dotCount)}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(event) => {
            if (event.nativeEvent.actionName === 'increment') go(1);
            if (event.nativeEvent.actionName === 'decrement') go(-1);
          }}
        >
          {Array.from({ length: page.dotCount }, (_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                index === page.index ? styles.dotCurrent : styles.dotRest,
              ]}
            />
          ))}
        </View>

        <View style={styles.footer}>
          {page.showNext ? (
            <PrimaryCTA
              label={words.next}
              onPress={() => go(1)}
              style={styles.cta}
            />
          ) : null}
          {page.showConnectAi ? (
            <Reanimated.View
              style={ctaStyle}
              pointerEvents={ctaDisabled ? 'none' : 'auto'}
            >
              <SecondaryCTA
                label={words.connectAi}
                disabled={ctaDisabled}
                onPress={() => {
                  void leave('connect-ai');
                }}
                style={styles.cta}
              />
            </Reanimated.View>
          ) : null}
          {page.showStartAsking ? (
            <Reanimated.View
              style={ctaStyle}
              pointerEvents={ctaDisabled ? 'none' : 'auto'}
            >
              <PrimaryCTA
                label={words.startAsking}
                disabled={ctaDisabled}
                onPress={() => {
                  void leave('start-asking');
                }}
                style={styles.cta}
              />
            </Reanimated.View>
          ) : null}
        </View>
      </View>
    </SafeAreaView>
    </HowItWorksGround>
  );
}

function HowItWorksPageScroller({ children }: { children: ReactNode }) {
  const [measured, setMeasured] = useState({
    contentHeight: 0,
    viewportHeight: 0,
    scrollY: 0,
  });
  return (
    <>
      <ScrollView
        style={styles.pageScroll}
        contentContainerStyle={styles.pageContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
        scrollEventThrottle={16}
        onLayout={(event) => {
          const viewportHeight = event.nativeEvent.layout.height;
          setMeasured((prev) =>
            prev.viewportHeight === viewportHeight
              ? prev
              : { ...prev, viewportHeight },
          );
        }}
        onContentSizeChange={(_, contentHeight) => {
          setMeasured((prev) =>
            prev.contentHeight === contentHeight
              ? prev
              : { ...prev, contentHeight },
          );
        }}
        onScroll={(event) => {
          const scrollY = event.nativeEvent.contentOffset.y;
          setMeasured((prev) =>
            prev.scrollY === scrollY ? prev : { ...prev, scrollY },
          );
        }}
      >
        {children}
      </ScrollView>
      <ScrollEdgeFade
        top={0}
        bottom={resolveHowItWorksPageFadeBottom(measured)}
        color={HOW_IT_WORKS_GROUND_FADE}
      />
    </>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** Clear: `HowItWorksGround` behind it is the desk's ground. */
  safe: { flex: 1 },
  body: {
    flex: 1,
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.sm,
    paddingBottom: 34,
  },
  header: {
    alignItems: 'flex-end',
    minHeight: 44,
  },
  skip: {
    color: colors.inkSecondary,
    fontSize: kitType.body,
    fontFamily: typography.face('500'),
    fontWeight: '500',
  },
  page: { flex: 1 },
  pageScroll: { flex: 1 },
  pageContent: { flexGrow: 1 },
  headline: {
    marginTop: spacing.md,
    fontSize: CANON_TYPE_SIZES.askTitle,
    lineHeight: 30,
    fontFamily: typography.face('600'),
    fontWeight: '600',
    letterSpacing: canonTracking(CANON_TYPE_SIZES.askTitle, -0.024),
    color: colors.ink,
  },
  copy: {
    marginTop: 10,
    fontSize: kitType.body,
    lineHeight: 24,
    fontFamily: typography.face('400'),
    fontWeight: '400',
    color: colors.inkSecondary,
  },
  example: {
    marginBottom: spacing.sm,
    fontSize: kitType.caption,
    lineHeight: Math.round(kitType.caption * 1.4),
    fontFamily: typography.face('400'),
    fontWeight: '400',
    color: colors.inkTertiary,
  },
  scene: {
    flexGrow: 1,
    flexShrink: 0,
    justifyContent: 'flex-end',
    marginTop: spacing.md,
    paddingBottom: 10,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.smd,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  dotCurrent: { backgroundColor: colors.ink },
  dotRest: { backgroundColor: colors.inkQuaternary },
  footer: {
    gap: spacing.smd,
  },
  cta: { marginBottom: 0 },
});

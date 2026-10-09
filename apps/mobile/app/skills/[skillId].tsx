import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { goBackOr } from '@/src/features/navigation/goBackOr';
import { BACK_FALLBACK } from '@/src/features/navigation/guardedBack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { copy } from '@/constants/copy';
import { CorsoText } from '@/src/theme/CorsoText';
import { useFiatTotal } from '@/src/features/balances/useFiatTotal';
import { useCorsoSession } from '@/src/features/session/SessionContext';
import {
  addSkill,
  isSkillAdded,
} from '@/src/features/skills/directory/addedSkillsStore';
import {
  NATIVE_TEST_TOKEN,
  tokenChoicesFromHoldings,
  type SkillTokenChoice,
} from '@/src/features/skills/directory/configureDraft';
import {
  SIMULATE_WINDOW_DAYS,
  simulateSkill,
  type SimulateOutcome,
} from '@/src/features/skills/directory/simulateClient';
import { useSkillsDirectoryConfig } from '@/src/features/skills/directory/skillsDirectoryGuard';
import {
  buildSkillPreview,
  describeSimulateFailure,
  selectTestReadout,
} from '@/src/features/skills/directory/skillsDirectoryPresentation';
import {
  getSkillTemplate,
  isSafetyCrossSkill,
  isSkillTemplateId,
  isSkillTestable,
} from '@/src/features/skills/directory/skillTemplate';
import {
  CANON_TYPE_SIZES,
  canonTracking,
  canonWeight,
} from '@/src/ui/cards/canonType';
import { ONGLASS, ONGLASS_HI } from '@/src/ui/glass/materialTokens';
import { GlassPill } from '@/src/ui/controls/GlassPill';
import { PrimaryCTA } from '@/src/ui/controls/PrimaryCTA';
import { TextButton } from '@/src/ui/controls/TextButton';
import { ScreenHeader } from '@/src/ui/navigation/ScreenHeader';
import { colors, radii, spacing, typography } from '@/src/ui/tokens';
import { SettingsCard } from '@/src/ui/cards/SettingsCard';
import { ScrollEdgeFade } from '@/src/ui/primitives/ScrollEdgeFade';

type TestState =
  | { status: 'idle' }
  | { status: 'testing' }
  | { status: 'done'; outcome: SimulateOutcome };

export default function SkillPreviewScreen() {
  const raw = useLocalSearchParams<{ skillId?: string }>();
  const skillId = isSkillTemplateId(raw.skillId) ? raw.skillId : null;
  const template = skillId ? getSkillTemplate(skillId) : null;
  const preview = useMemo(
    () => (template ? buildSkillPreview(template) : null),
    [template],
  );
  const gate = useSkillsDirectoryConfig();
  const { session } = useCorsoSession();
  const fiat = useFiatTotal(session?.address);
  const [testToken, setTestToken] = useState<SkillTokenChoice | null>(null);
  const [test, setTest] = useState<TestState>({ status: 'idle' });
  const [added, setAdded] = useState(() =>
    skillId ? isSkillAdded(skillId) : false,
  );
  const abortRef = useRef<AbortController | null>(null);

  // What the user holds is the only list a token can be named from. SOL is
  // the chain's native unit and is always offered; nothing else is suggested.
  const choices = useMemo(() => {
    const held = fiat.holdings
      ? tokenChoicesFromHoldings(fiat.holdings.lines)
      : [];
    return held.some((choice) => choice.mint === NATIVE_TEST_TOKEN.mint)
      ? held
      : [NATIVE_TEST_TOKEN, ...held];
  }, [fiat.holdings]);

  useEffect(() => () => abortRef.current?.abort(), []);

  async function runTest() {
    if (!template || !isSkillTestable(template.id)) return;
    if (!testToken || test.status === 'testing') return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setTest({ status: 'testing' });
    const request = isSafetyCrossSkill(template)
      ? {
          skillId: template.id,
          mint: testToken.mint,
          slots: {
            safety: template.slots.safety.default,
            // The dry run measures the transition from a CLEAN baseline: it
            // answers "would this rule exit on today's read?", which is only a
            // transition if the rule was set while the token still read clean.
            baselineVerdict: 'green' as const,
            minOutBps: template.slots.minOutBps.default,
            perDayMaxFires: template.slots.perDayMaxFires.default,
          },
        }
      : {
          skillId: template.id,
          mint: testToken.mint,
          windowDays: SIMULATE_WINDOW_DAYS,
          ...(template.kind === 'execute'
            ? {
                slots: {
                  pct: template.slots.pct.default,
                  minOutBps: template.slots.minOutBps.default,
                  perDayMaxFires: template.slots.perDayMaxFires.default,
                },
              }
            : {}),
        };
    const outcome = await simulateSkill({
      skillsEnabled: gate.enabled,
      signal: controller.signal,
      request,
    });
    if (controller.signal.aborted) return;
    setTest({ status: 'done', outcome });
  }

  function onAdd() {
    if (!template || template.kind !== 'analytics') return;
    addSkill(template.id);
    setAdded(true);
    if (template.id === 'heads_up')
      router.push(`/skills/configure/${template.id}`);
  }

  // Bound to the template family: an analytics skill never paints an execute
  // result (and vice versa). A mismatched-but-ok outcome paints as a closed
  // schema failure rather than leaking the other family's fields.
  const readout =
    test.status === 'done' && template
      ? selectTestReadout(template, test.outcome)
      : null;
  const failure =
    test.status === 'done' && !readout
      ? describeSimulateFailure(
          test.outcome.ok ? { ok: false, code: 'schema' } : test.outcome,
        )
      : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader
        onBack={() => goBackOr(BACK_FALLBACK.skillsList)}
        backAccessibilityLabel={copy.skills.back}
        title={preview?.name ?? copy.skills.title}
      />
      {!preview || !template || (gate.status === 'ready' && !gate.enabled) ? (
        <View style={styles.body}>
          <CorsoText style={styles.muted}>{copy.skills.empty}</CorsoText>
        </View>
      ) : (
        <View style={styles.scrollWrap}>
          <ScrollView contentContainerStyle={styles.body}>
            <View style={styles.pills}>
              <CorsoText style={styles.kindText}>{preview.kindLabel}</CorsoText>
              <CorsoText style={styles.kindText}>
                {preview.categoryLabel}
              </CorsoText>
            </View>

            <CorsoText style={styles.heading}>{preview.whatHeading}</CorsoText>
            <CorsoText style={styles.para}>{preview.what}</CorsoText>

            <CorsoText style={styles.heading}>{preview.neverHeading}</CorsoText>
            {preview.softwarePolicyNote ? (
              <CorsoText style={styles.para}>{preview.softwarePolicyNote}</CorsoText>
            ) : null}
            {preview.never.map((line) => (
              <View key={line} style={styles.neverRow}>
                <View style={styles.neverDot} />
                <CorsoText style={styles.never}>{line}</CorsoText>
              </View>
            ))}

            <CorsoText style={styles.heading}>{preview.testHeading}</CorsoText>
            {!preview.testable ? (
              <CorsoText style={styles.muted} testID="skill-test-unavailable">
                {preview.testUnavailable}
              </CorsoText>
            ) : (
              <>
                <CorsoText style={styles.para}>{preview.testOn}</CorsoText>
                <View style={styles.choices} accessibilityRole="radiogroup">
                  {choices.map((choice) => {
                    const selected = testToken?.mint === choice.mint;
                    return (
                      <Pressable
                        key={choice.mint}
                        onPress={() => {
                          setTestToken(choice);
                          setTest({ status: 'idle' });
                        }}
                        accessibilityRole="radio"
                        accessibilityState={{ selected, checked: selected }}
                        accessibilityLabel={copy.skills.preview.testOnA11y(
                          choice.symbol,
                        )}
                        style={styles.choiceHit}
                      >
                        <View
                          style={[
                            styles.choice,
                            selected ? styles.choiceSelected : null,
                          ]}
                        >
                          <CorsoText
                            style={
                              selected
                                ? styles.choiceTextSelected
                                : styles.choiceText
                            }
                          >
                            {choice.symbol}
                          </CorsoText>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
                {!testToken ? (
                  <CorsoText style={styles.muted}>
                    {copy.skills.preview.pickToTest}
                  </CorsoText>
                ) : null}
                <GlassPill
                  label={
                    test.status === 'testing'
                      ? copy.skills.preview.testing
                      : preview.testCta
                  }
                  disabled={
                    !testToken ||
                    test.status === 'testing' ||
                    gate.status !== 'ready'
                  }
                  onPress={() => {
                    void runTest();
                  }}
                  testID="skill-test"
                />
              </>
            )}

            {readout ? (
              <SettingsCard
                radius={radii.pane}
                style={styles.readout}
                contentStyle={styles.readoutContent}
                testID="skill-test-result"
              >
                <View style={styles.readoutTop}>
                  <View
                    style={[
                      styles.dot,
                      readout.tone === 'danger' ? styles.dotDanger : null,
                    ]}
                  />
                  <CorsoText style={styles.readoutTitle}>
                    {readout.title}
                  </CorsoText>
                </View>
                {readout.lines.map((line) => (
                  <CorsoText key={line} style={styles.readoutLine}>
                    {line}
                  </CorsoText>
                ))}
                {readout.notes.map((line) => (
                  <CorsoText key={line} style={styles.readoutNote}>
                    {line}
                  </CorsoText>
                ))}
              </SettingsCard>
            ) : null}
            {failure ? (
              <SettingsCard
                radius={radii.pane}
                style={styles.readout}
                contentStyle={styles.readoutContent}
              >
                <CorsoText style={styles.readoutNote}>{failure.text}</CorsoText>
                {failure.retry ? (
                  <TextButton
                    label={copy.skills.test.retry}
                    tone="action"
                    size="inline"
                    onPress={() => {
                      void runTest();
                    }}
                    style={styles.retry}
                  />
                ) : null}
              </SettingsCard>
            ) : null}

            {added &&
            template.kind === 'analytics' &&
            template.id !== 'heads_up' ? (
              <SettingsCard
                radius={radii.pane}
                style={styles.readout}
                contentStyle={styles.readoutContent}
              >
                <CorsoText style={styles.readoutLine}>
                  {copy.skills.preview.added}
                </CorsoText>
                {preview.addedBody ? (
                  <CorsoText style={styles.readoutNote}>
                    {preview.addedBody}
                  </CorsoText>
                ) : null}
              </SettingsCard>
            ) : preview.addCta ? (
              <PrimaryCTA
                label={preview.addCta}
                onPress={onAdd}
                disabled={gate.status !== 'ready'}
                style={styles.add}
                testID="skill-add"
              />
            ) : null}
          </ScrollView>
          <ScrollEdgeFade color={colors.canvas} />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  scrollWrap: { flex: 1, position: 'relative' },
  body: {
    paddingHorizontal: spacing.gutter,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  pills: { flexDirection: 'row', gap: spacing.smd, marginTop: spacing.xs },
  kindText: {
    color: colors.inkTertiary,
    fontSize: CANON_TYPE_SIZES.micro,
    fontFamily: typography.face('500'),
    fontWeight: canonWeight('500'),
  },
  heading: {
    color: colors.inkTertiary,
    fontSize: 15,
    fontFamily: typography.face('500'),
    fontWeight: '500',
    marginTop: spacing.md,
  },
  para: {
    color: colors.inkSecondary,
    fontSize: CANON_TYPE_SIZES.body,
    lineHeight: 18,
    fontFamily: typography.face('500'),
    fontWeight: canonWeight('500'),
  },
  neverRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm + 2,
  },
  /** Bullet on the static "never does this" list — decoration, so never amber. */
  neverDot: {
    width: 5,
    height: 5,
    borderRadius: radii.pill,
    backgroundColor: colors.inkQuaternary,
    marginTop: 7,
  },
  never: {
    flex: 1,
    color: colors.ink,
    fontSize: CANON_TYPE_SIZES.body,
    lineHeight: 18,
    fontFamily: typography.face('600'),
    fontWeight: canonWeight('600'),
  },
  muted: {
    color: colors.inkTertiary,
    fontSize: CANON_TYPE_SIZES.micro,
    lineHeight: 16,
    fontFamily: typography.face('500'),
    fontWeight: canonWeight('500'),
  },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  choiceHit: { minHeight: 44, justifyContent: 'center' },
  choice: {
    borderRadius: radii.pill,
    backgroundColor: ONGLASS,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  choiceSelected: { backgroundColor: ONGLASS_HI },
  choiceText: {
    color: colors.inkTertiary,
    fontSize: CANON_TYPE_SIZES.body,
    fontFamily: typography.face('500'),
    fontWeight: canonWeight('500'),
  },
  choiceTextSelected: {
    color: colors.ink,
    fontSize: CANON_TYPE_SIZES.body,
    fontFamily: typography.face('600'),
    fontWeight: canonWeight('600'),
  },
  /** Outer box only — the material, radius and clipping are the card's. */
  readout: {
    marginTop: spacing.sm,
  },
  readoutContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: 15,
    gap: spacing.xs,
  },
  readoutTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.ink,
  },
  dotDanger: { backgroundColor: colors.riskDanger },
  readoutTitle: {
    color: colors.ink,
    fontSize: CANON_TYPE_SIZES.cardTitle,
    letterSpacing: canonTracking(CANON_TYPE_SIZES.cardTitle, -0.01),
    fontFamily: typography.face('600'),
    fontWeight: canonWeight('600'),
  },
  readoutLine: {
    color: colors.inkSecondary,
    fontSize: CANON_TYPE_SIZES.body,
    lineHeight: 18,
    fontFamily: typography.face('500'),
    fontWeight: canonWeight('500'),
  },
  readoutNote: {
    color: colors.inkTertiary,
    fontSize: CANON_TYPE_SIZES.micro,
    lineHeight: 16,
    fontFamily: typography.face('500'),
    fontWeight: canonWeight('500'),
  },
  /** The retry door is `TextButton` — the app's one inline text control. */
  retry: { alignSelf: 'flex-start' },
  add: { marginTop: spacing.md },
});

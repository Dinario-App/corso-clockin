import { HeadsUpOwnedWatches } from '@/src/features/skills/directory/HeadsUpOwnedWatches';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { goBackOr } from '@/src/features/navigation/goBackOr';
import { BACK_FALLBACK } from '@/src/features/navigation/guardedBack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { copy } from '@/constants/copy';
import { CorsoText } from '@/src/theme/CorsoText';
import { useFiatTotal } from '@/src/features/balances/useFiatTotal';
import { useHeadsUpProofSigner } from '@/src/features/skills/directory/useHeadsUpProofSigner';
import { StepUpSheet } from '@/src/features/security/StepUpSheet';
import {
  initialConfigureSlots,
  tokenChoicesFromHoldings,
  type ConfigureSlotsInput,
} from '@/src/features/skills/directory/configureDraft';
import { useSkillsDirectoryConfig } from '@/src/features/skills/directory/skillsDirectoryGuard';
import {
  getSkillTemplate,
  isSkillTemplateId,
} from '@/src/features/skills/directory/skillTemplate';
import {
  CANON_TYPE_SIZES,
  canonNumerals,
  canonTracking,
  canonWeight,
} from '@/src/ui/cards/canonType';
import { ONGLASS, ONGLASS_HI } from '@/src/ui/glass/materialTokens';
import { PrimaryCTA } from '@/src/ui/controls/PrimaryCTA';
import { ScreenHeader } from '@/src/ui/navigation/ScreenHeader';
import { colors, radii, spacing, typography } from '@/src/ui/tokens';
import { ScrollEdgeFade } from '@/src/ui/primitives/ScrollEdgeFade';
import {
  addHeadsUpWatch,
  HEADS_UP_TIMEFRAMES,
  type AddHeadsUpWatchOutcome,
  type HeadsUpTimeframe,
} from '@/src/features/skills/directory/headsUpWatchClient';

export default function SkillConfigureScreen() {
  const raw = useLocalSearchParams<{ skillId?: string }>();
  const skillId = isSkillTemplateId(raw.skillId) ? raw.skillId : null;
  const template = skillId ? getSkillTemplate(skillId) : null;
  const headsUp = template?.id === 'heads_up' ? template : null;
  const gate = useSkillsDirectoryConfig();
  const proofSigner = useHeadsUpProofSigner();
  const { session, locked } = proofSigner;
  const fiat = useFiatTotal(session?.address);
  const [slots, setSlots] = useState<ConfigureSlotsInput>(() =>
    initialConfigureSlots(getSkillTemplate('the_verdict')),
  );
  const [watchTimeframe, setWatchTimeframe] = useState<HeadsUpTimeframe>('1H');
  const [watchOutcome, setWatchOutcome] = useState<
    AddHeadsUpWatchOutcome | 'adding' | null
  >(null);
  const watchAbortRef = useRef<AbortController | null>(null);
  const ownerRef = useRef(session?.address ?? null);
  ownerRef.current = session?.address ?? null;
  useEffect(() => () => watchAbortRef.current?.abort(), []);
  useEffect(() => { watchAbortRef.current?.abort(); setWatchOutcome(null); }, [session?.address, locked]);

  const choices = useMemo(
    () => (fiat.holdings ? tokenChoicesFromHoldings(fiat.holdings.lines) : []),
    [fiat.holdings],
  );
  async function onWatch() {
    const walletAddress = session?.address;
    const token = slots.token;
    if (!headsUp || !walletAddress || !token || locked || watchOutcome === 'adding')
      return;
    watchAbortRef.current?.abort();
    const controller = new AbortController();
    watchAbortRef.current = controller;
    setWatchOutcome('adding');
    const outcome = await addHeadsUpWatch({
      skillsEnabled: gate.enabled,
      walletAddress,
      mint: token.mint,
      timeframe: watchTimeframe,
      signMessage: proofSigner.signMessage,
      assertCurrent: proofSigner.assertCurrent,
      signal: controller.signal,
    });
    if (controller.signal.aborted || ownerRef.current !== walletAddress) return;
    setWatchOutcome(outcome);
  }

  const c = copy.skills.configure;

  if (headsUp) {
    const watchMessage =
      watchOutcome === 'adding'
        ? c.watching
        : watchOutcome?.ok
          ? c.watched
          : watchOutcome?.code === 'exists'
            ? c.watchExists
            : watchOutcome
              ? c.watchUnavailable
              : null;
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScreenHeader
          onBack={() => goBackOr(BACK_FALLBACK.skillsList)}
          backAccessibilityLabel={copy.skills.back}
          title={c.title}
        />
        {gate.status === 'ready' && !gate.enabled ? (
          <View style={styles.body}>
            <CorsoText style={styles.muted}>{copy.skills.empty}</CorsoText>
          </View>
        ) : (
          <View style={styles.scrollWrap}>
          <ScrollView contentContainerStyle={styles.body}>
            <CorsoText style={styles.name}>
              {copy.skills.template.heads_up.name}
            </CorsoText>
            <CorsoText style={styles.lead}>{c.watchLead}</CorsoText>
            <View style={styles.field}>
              <CorsoText style={styles.label}>{c.token}</CorsoText>
              <View style={styles.choices} accessibilityRole="radiogroup">
                {choices.map((choice) => {
                  const selected = slots.token?.mint === choice.mint;
                  return (
                    <Pressable
                      key={choice.mint}
                      onPress={() => {
                        setSlots((current) => ({ ...current, token: choice }));
                        setWatchOutcome(null);
                      }}
                      accessibilityRole="radio"
                      accessibilityState={{ selected, checked: selected }}
                      accessibilityLabel={choice.symbol}
                      style={styles.choiceHit}
                      testID={`heads-up-token-${choice.symbol}`}
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
              <CorsoText style={styles.hint}>{c.tokenHint}</CorsoText>
            </View>
            <View style={styles.field}>
              <CorsoText style={styles.label}>{c.timeframe}</CorsoText>
              <View style={styles.choices} accessibilityRole="radiogroup">
                {HEADS_UP_TIMEFRAMES.map((timeframe) => {
                  const selected = timeframe === watchTimeframe;
                  return (
                    <Pressable
                      key={timeframe}
                      onPress={() => {
                        setWatchTimeframe(timeframe);
                        setWatchOutcome(null);
                      }}
                      accessibilityRole="radio"
                      accessibilityState={{ selected, checked: selected }}
                      accessibilityLabel={timeframe}
                      style={styles.choiceHit}
                      testID={`heads-up-timeframe-${timeframe}`}
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
                          {timeframe}
                        </CorsoText>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <PrimaryCTA
              label={watchOutcome === 'adding' ? c.watching : c.watchCta}
              onPress={() => void onWatch()}
              disabled={
                gate.status !== 'ready' ||
                !slots.token ||
                !session?.address ||
                locked ||
                watchOutcome === 'adding' ||
                watchOutcome?.ok === true
              }
              style={styles.cta}
              testID="heads-up-add-watch"
            />
            {watchMessage ? (
              <CorsoText style={styles.note}>{watchMessage}</CorsoText>
            ) : null}
            <HeadsUpOwnedWatches onRemoved={() => setWatchOutcome(null)} addedWatchId={watchOutcome && watchOutcome !== 'adding' && watchOutcome.ok ? watchOutcome.watchId : null} />
          </ScrollView>
          <ScrollEdgeFade color={colors.canvas} />
          </View>
        )}
        <StepUpSheet {...proofSigner.stepUpSheet} />
      </SafeAreaView>
    );
  }

  return <Redirect href="/skills" />;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  scrollWrap: { flex: 1, position: 'relative' },
  body: {
    paddingHorizontal: spacing.gutter,
    paddingBottom: spacing.xl,
    gap: spacing.smd,
  },
  name: {
    color: colors.ink,
    fontSize: CANON_TYPE_SIZES.askTitle,
    lineHeight: Math.round(CANON_TYPE_SIZES.askTitle * 1.16),
    letterSpacing: canonTracking(CANON_TYPE_SIZES.askTitle, -0.024),
    fontFamily: typography.face('600'),
    fontWeight: canonWeight('600'),
    marginTop: spacing.sm,
  },
  lead: {
    color: colors.inkTertiary,
    fontSize: CANON_TYPE_SIZES.body,
    lineHeight: Math.round(CANON_TYPE_SIZES.body * 1.45),
    fontFamily: typography.face('500'),
    fontWeight: canonWeight('500'),
  },
  muted: {
    color: colors.inkTertiary,
    fontSize: CANON_TYPE_SIZES.body,
    fontFamily: typography.face('500'),
    fontWeight: canonWeight('500'),
  },
  field: { gap: spacing.xs },
  label: {
    color: colors.inkTertiary,
    fontSize: 15,
    fontFamily: typography.face('500'),
    fontWeight: '500',
    marginTop: spacing.sm,
  },
  hint: {
    color: colors.inkTertiary,
    fontSize: CANON_TYPE_SIZES.micro,
    lineHeight: 16,
    fontFamily: typography.face('500'),
    fontWeight: canonWeight('500'),
  },
  error: {
    color: colors.destructive,
    fontSize: CANON_TYPE_SIZES.micro,
    lineHeight: 16,
    fontFamily: typography.face('500'),
    fontWeight: canonWeight('500'),
  },
  /** The well the material draws; the height is the 44pt tap floor. */
  inputWell: { minHeight: 44, justifyContent: 'center' },
  input: {
    minHeight: 44,
    color: colors.ink,
    paddingHorizontal: spacing.md,
    fontSize: CANON_TYPE_SIZES.control,
    fontFamily: typography.face('500'),
    fontWeight: canonWeight('500'),
    fontVariant: canonNumerals(),
  },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  choiceHit: { minHeight: 44, justifyContent: 'center' },
  choice: {
    borderRadius: radii.pill,
    backgroundColor: ONGLASS,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  /** `.pc[aria-pressed="true"]` — `--onglass-hi` + full ink, never a louder edge. */
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
  envelope: {
    marginTop: spacing.sm,
  },
  /** `.paper{padding:13px 16px}` — the envelope pane. */
  envelopeContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: 13,
    gap: spacing.sm,
  },
  envelopeHeading: {
    color: colors.ink,
    fontSize: CANON_TYPE_SIZES.cardTitle,
    letterSpacing: canonTracking(CANON_TYPE_SIZES.cardTitle, -0.01),
    fontFamily: typography.face('600'),
    fontWeight: canonWeight('600'),
  },
  row: { gap: 1 },
  rowLabel: {
    color: colors.inkTertiary,
    fontSize: CANON_TYPE_SIZES.sub,
    fontFamily: typography.face('500'),
    fontWeight: canonWeight('500'),
  },
  rowValue: {
    color: colors.ink,
    fontSize: CANON_TYPE_SIZES.rowLabel,
    letterSpacing: canonTracking(CANON_TYPE_SIZES.rowLabel, -0.01),
    fontFamily: typography.face('500'),
    fontWeight: canonWeight('500'),
  },
  /**
   * Handed-off confirmation / arming-closed notice — neither is token-safety
   * danger, so the note is quiet ink, never amber.
   */
  note: {
    color: colors.inkTertiary,
    fontSize: CANON_TYPE_SIZES.micro,
    lineHeight: 16,
    fontFamily: typography.face('500'),
    fontWeight: canonWeight('500'),
    marginTop: spacing.xs,
  },
  cta: { marginTop: spacing.sm },
});

import { useEffect, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type TextStyle,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { copy } from '@/constants/copy';
import { paperCopy } from '@/constants/copy/paper';
import { AccountScreenHeader } from '@/src/features/account/ui/AccountScreenHeader';
import { goBackOr } from '@/src/features/navigation/goBackOr';
import { BACK_FALLBACK } from '@/src/features/navigation/guardedBack';
import {
  isPaperSide,
  PAPER_RULE_KINDS,
  runPaperSimulation,
  type PaperOutcome,
} from '@/src/features/paper/paperClient';
import {
  buildPaperRequest,
  defaultPaperForm,
  PAPER_PARAM_DEFAULT,
  paramKey,
  type PaperForm,
  type PaperFormField,
} from '@/src/features/paper/paperForm';
import { resolvePaperResultView } from '@/src/features/paper/paperPresentation';
import { CorsoText } from '@/src/theme/CorsoText';
import { CANON_TYPE_SIZES, canonWeight } from '@/src/ui/cards/canonType';
import { SettingsCard } from '@/src/ui/cards/SettingsCard';
import { PrimaryCTA } from '@/src/ui/controls/PrimaryCTA';
import { Material } from '@/src/ui/glass/Material';
import { ScrollEdgeFade } from '@/src/ui/primitives/ScrollEdgeFade';
import { ONGLASS, ONGLASS_HI } from '@/src/ui/glass/materialTokens';
import { colors, radii, spacing, typography } from '@/src/ui/tokens';

export default function PaperScreen() {
  const params = useLocalSearchParams<{ mint?: string }>();
  const [form, setForm] = useState<PaperForm>(() =>
    defaultPaperForm(params.mint ?? null),
  );
  const [invalid, setInvalid] = useState<PaperFormField[]>([]);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<PaperOutcome | null>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => () => abort.current?.abort(), []);

  const side = isPaperSide(form.ruleKind);
  const key = paramKey(form.ruleKind);

  function invalidate() {
    abort.current?.abort();
    setBusy(false);
    setOutcome(null);
  }

  function set(field: PaperFormField, value: string) {
    invalidate();
    setForm((current) => ({ ...current, [field]: value }));
    setInvalid((current) => current.filter((entry) => entry !== field));
  }

  async function run() {
    const built = buildPaperRequest(form);
    if (!built.ok) {
      setInvalid(built.fields);
      return;
    }
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setBusy(true);
    setOutcome(null);
    const result = await runPaperSimulation({
      request: built.request,
      signal: controller.signal,
    });
    if (controller.signal.aborted) return;
    setOutcome(result);
    setBusy(false);
  }

  const view = outcome?.ok ? resolvePaperResultView(outcome.result) : null;
  // A result that names no model is not painted as if it did; it is a failed run.
  const failure =
    outcome?.ok && !view
      ? paperCopy.outcome.failed
      : outcome && !outcome.ok
        ? outcome.code === 'disabled' ||
          outcome.code === 'unavailable' ||
          outcome.code === 'no_data' ||
          outcome.code === 'no_depth' ||
          outcome.code === 'unsupported_network'
          ? paperCopy.outcome[outcome.code]
          : paperCopy.outcome.failed
        : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <AccountScreenHeader
        title={paperCopy.title}
        onBack={() => goBackOr(BACK_FALLBACK.accountTab)}
        backAccessibilityLabel={copy.v1.back}
        testID="paper-header"
      />
      <View style={styles.scroller}>
        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
        >
          <CorsoText style={styles.intro}>{paperCopy.intro}</CorsoText>

          <CorsoText style={styles.heading}>{paperCopy.heading.rule}</CorsoText>
          <View style={styles.chips} accessibilityRole="radiogroup">
            {PAPER_RULE_KINDS.map((kind) => {
              const on = form.ruleKind === kind;
              return (
                <Pressable
                  key={kind}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  onPress={() => {
                    invalidate();
                    setForm((current) => ({
                      ...current,
                      ruleKind: kind,
                      param: PAPER_PARAM_DEFAULT[kind],
                    }));
                  }}
                  style={[styles.chip, on ? styles.chipOn : null]}
                  testID={`paper-rule-${kind}`}
                >
                  <CorsoText
                    style={[styles.chipText, on ? styles.chipTextOn : null]}
                  >
                    {paperCopy.rules[kind]}
                  </CorsoText>
                </Pressable>
              );
            })}
          </View>

          <SettingsCard contentStyle={styles.pane} testID="paper-form">
            <Field
              label={paperCopy.param[key]}
              hint={paperCopy.paramHint[key]}
              value={form.param}
              error={invalid.includes('param')}
              onChange={(value) => set('param', value)}
              testID="paper-param"
            />
            <Field
              label={paperCopy.sizeUsd}
              value={form.sizeUsd}
              error={invalid.includes('sizeUsd')}
              onChange={(value) => set('sizeUsd', value)}
              testID="paper-size"
            />
            <Field
              label={paperCopy.startingUsd}
              hint={paperCopy.startingHint[side]}
              value={form.startingUsd}
              error={invalid.includes('startingUsd')}
              onChange={(value) => set('startingUsd', value)}
              testID="paper-starting"
            />
            <Field
              label={paperCopy.perDayMaxFires}
              value={form.perDayMaxFires}
              error={invalid.includes('perDayMaxFires')}
              onChange={(value) => set('perDayMaxFires', value)}
              testID="paper-fires"
            />
            <Field
              label={paperCopy.perDayMaxUsd}
              value={form.perDayMaxUsd}
              error={invalid.includes('perDayMaxUsd')}
              onChange={(value) => set('perDayMaxUsd', value)}
              testID="paper-daily"
            />
            <Field
              label={paperCopy.minOutBps}
              hint={paperCopy.minOutBpsHint}
              value={form.minOutBps}
              error={invalid.includes('minOutBps')}
              onChange={(value) => set('minOutBps', value)}
              testID="paper-slippage"
              last
            />
          </SettingsCard>

          <CorsoText style={styles.heading}>
            {paperCopy.heading.token}
          </CorsoText>
          <SettingsCard contentStyle={styles.pane}>
            <TextInput
              value={form.mint}
              onChangeText={(value) => set('mint', value)}
              autoCapitalize="none"
              autoCorrect={false}
              style={[
                styles.mint,
                MONO,
                invalid.includes('mint') ? styles.inputError : null,
              ]}
              accessibilityLabel={paperCopy.tokenLabel}
              testID="paper-mint"
            />
            <CorsoText
              style={invalid.includes('mint') ? styles.error : styles.hint}
            >
              {invalid.includes('mint')
                ? paperCopy.tokenInvalid
                : paperCopy.tokenHint}
            </CorsoText>
          </SettingsCard>

          <CorsoText style={styles.heading}>
            {paperCopy.heading.window}
          </CorsoText>
          <View style={styles.chips} accessibilityRole="radiogroup">
            {([7, 30] as const).map((days) => {
              const on = form.windowDays === days;
              return (
                <Pressable
                  key={days}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  onPress={() => {
                    invalidate();
                    setForm((current) => ({ ...current, windowDays: days }));
                  }}
                  style={[styles.chip, on ? styles.chipOn : null]}
                  testID={`paper-window-${days}`}
                >
                  <CorsoText
                    style={[styles.chipText, on ? styles.chipTextOn : null]}
                  >
                    {paperCopy.windows[days]}
                  </CorsoText>
                </Pressable>
              );
            })}
          </View>

          <PrimaryCTA
            label={busy ? paperCopy.running : paperCopy.run}
            onPress={() => {
              void run();
            }}
            busy={busy}
            style={styles.cta}
            testID="paper-run"
          />

          {invalid.length > 0 ? (
            <CorsoText style={styles.error}>{paperCopy.fieldInvalid}</CorsoText>
          ) : null}
          {failure ? (
            <CorsoText style={styles.note} testID="paper-outcome">
              {failure}
            </CorsoText>
          ) : null}

          {view ? (
            <View testID="paper-result">
              <Material
                weight="card"
                radius={radii.pane}
                contentStyle={styles.banner}
                style={styles.block}
              >
                <CorsoText style={styles.bannerTitle}>{view.banner}</CorsoText>
                <CorsoText style={styles.body2}>{view.bannerBody}</CorsoText>
              </Material>

              <CorsoText style={styles.heading}>
                {paperCopy.result.assumptionsHeading}
              </CorsoText>
              <SettingsCard contentStyle={styles.pane}>
                <CorsoText style={styles.bullet} testID="paper-model">
                  {`· ${view.model}`}
                </CorsoText>
                {view.assumptions.map((line) => (
                  <CorsoText key={line} style={styles.bullet}>
                    {`· ${line}`}
                  </CorsoText>
                ))}
                <CorsoText style={styles.subhead}>
                  {paperCopy.result.notModelledHeading}
                </CorsoText>
                <CorsoText style={styles.bullet}>{view.notModelled}</CorsoText>
                {view.thinData ? (
                  <CorsoText style={styles.warn}>{view.thinData}</CorsoText>
                ) : null}
              </SettingsCard>

              <CorsoText style={styles.heading}>
                {paperCopy.result.summaryHeading}
              </CorsoText>
              <SettingsCard contentStyle={styles.pane} testID="paper-summary">
                {view.summary.map((row) => (
                  <View key={row.label} style={styles.row}>
                    <CorsoText style={styles.label}>{row.label}</CorsoText>
                    <CorsoText style={[styles.value, NUMERALS]}>
                      {row.value}
                    </CorsoText>
                  </View>
                ))}
                {view.stopped ? (
                  <CorsoText style={styles.warn}>{view.stopped}</CorsoText>
                ) : null}
              </SettingsCard>

              <CorsoText style={styles.heading}>
                {paperCopy.result.firesHeading}
              </CorsoText>
              <SettingsCard
                contentStyle={styles.pane}
                testID="paper-fires-list"
              >
                {view.noFires ? (
                  <CorsoText style={styles.hint}>{view.noFires}</CorsoText>
                ) : null}
                {view.fires.map((fire) => (
                  <View key={fire.key} style={styles.fire}>
                    <CorsoText style={styles.label}>
                      {`${fire.side} · ${new Date(fire.atMs).toLocaleString()}`}
                    </CorsoText>
                    <CorsoText
                      style={[
                        fire.missed ? styles.warn : styles.hint,
                        NUMERALS,
                      ]}
                    >
                      {fire.detail}
                    </CorsoText>
                  </View>
                ))}
              </SettingsCard>
            </View>
          ) : null}
        </ScrollView>
        <ScrollEdgeFade color={colors.canvas} />
      </View>
    </SafeAreaView>
  );
}

function Field(props: {
  label: string;
  hint?: string;
  value: string;
  error: boolean;
  last?: boolean;
  testID: string;
  onChange: (value: string) => void;
}) {
  return (
    <View style={[styles.field, props.last ? styles.fieldLast : null]}>
      <View style={styles.row}>
        <CorsoText style={styles.label}>{props.label}</CorsoText>
        <TextInput
          value={props.value}
          onChangeText={props.onChange}
          keyboardType="decimal-pad"
          inputMode="decimal"
          style={[
            styles.input,
            NUMERALS,
            props.error ? styles.inputError : null,
          ]}
          accessibilityLabel={props.label}
          testID={props.testID}
        />
      </View>
      {props.hint ? (
        <CorsoText style={styles.hint}>{props.hint}</CorsoText>
      ) : null}
    </View>
  );
}

const MONO: TextStyle = {
  fontVariant: [...typography.fontVariantMono] as TextStyle['fontVariant'],
};
const NUMERALS: TextStyle = {
  fontVariant: [...typography.fontVariantNumerals] as TextStyle['fontVariant'],
};

const text = (
  size: number,
  weight: '500' | '600',
  color: string,
): TextStyle => ({
  color,
  fontSize: size,
  fontFamily: typography.face(weight),
  fontWeight: canonWeight(weight),
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  scroller: { flex: 1 },
  body: {
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.md,
    paddingBottom: spacing.gutter * 2,
  },
  intro: {
    ...text(CANON_TYPE_SIZES.body, '500', colors.inkSecondary),
    lineHeight: 20,
  },
  heading: {
    ...text(CANON_TYPE_SIZES.sub, '600', colors.inkTertiary),
    marginTop: spacing.gutter,
    marginBottom: spacing.sm,
  },
  subhead: {
    ...text(CANON_TYPE_SIZES.sub, '600', colors.inkTertiary),
    marginTop: spacing.smd,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    borderRadius: radii.pill,
    backgroundColor: ONGLASS,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipOn: { backgroundColor: colors.ink },
  chipText: text(CANON_TYPE_SIZES.body, '500', colors.inkSecondary),
  chipTextOn: { color: colors.canvas },
  pane: { paddingHorizontal: spacing.md, paddingVertical: spacing.smd },
  block: { marginTop: spacing.gutter },
  field: {
    paddingVertical: spacing.smd,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  fieldLast: { borderBottomWidth: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  label: {
    ...text(CANON_TYPE_SIZES.body, '500', colors.inkSecondary),
    flexShrink: 1,
  },
  value: text(CANON_TYPE_SIZES.body, '600', colors.ink),
  hint: {
    ...text(CANON_TYPE_SIZES.micro, '500', colors.inkTertiary),
    marginTop: 4,
    lineHeight: 16,
  },
  error: {
    ...text(CANON_TYPE_SIZES.micro, '500', colors.destructive),
    marginTop: 6,
  },
  warn: {
    ...text(CANON_TYPE_SIZES.micro, '500', colors.inkSecondary),
    marginTop: 6,
    lineHeight: 16,
  },
  note: {
    ...text(CANON_TYPE_SIZES.body, '500', colors.inkSecondary),
    marginTop: spacing.md,
  },
  input: {
    ...text(CANON_TYPE_SIZES.body, '500', colors.ink),
    minWidth: 110,
    minHeight: 34,
    borderRadius: radii.menuRow,
    backgroundColor: ONGLASS,
    textAlign: 'right',
    paddingHorizontal: spacing.smd,
    paddingVertical: 0,
  },
  inputError: { backgroundColor: ONGLASS_HI },
  mint: {
    ...text(CANON_TYPE_SIZES.sub, '500', colors.ink),
    minHeight: 38,
    borderRadius: radii.menuRow,
    backgroundColor: ONGLASS,
    paddingHorizontal: spacing.smd,
  },
  cta: { marginTop: spacing.gutter },
  banner: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: 4,
  },
  bannerTitle: text(CANON_TYPE_SIZES.cardTitle, '600', colors.ink),
  body2: {
    ...text(CANON_TYPE_SIZES.sub, '500', colors.inkSecondary),
    lineHeight: 17,
  },
  bullet: {
    ...text(CANON_TYPE_SIZES.sub, '500', colors.inkSecondary),
    lineHeight: 18,
    marginTop: 4,
  },
  fire: {
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
});

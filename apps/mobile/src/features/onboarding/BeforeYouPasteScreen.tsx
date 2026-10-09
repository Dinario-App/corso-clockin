import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import {
  canLeaveBeforeYouPaste,
  resolveBeforeYouPasteGate,
  toggleBeforeYouPasteCheck,
  type BeforeYouPasteCheckId,
} from '@/src/features/onboarding/beforeYouPasteGate';
import { CorsoIcon } from '@/src/ui/icons/CorsoIcon';
import { PrimaryCTA } from '@/src/ui/controls/PrimaryCTA';
import { colors, radii, spacing, typography } from '@/src/ui/tokens';
import { ScrollEdgeFade } from '@/src/ui/primitives/ScrollEdgeFade';

const TICK_MS = 250;

export function BeforeYouPasteScreen({
  onContinue,
}: {
  onContinue: () => void;
}) {
  const [checked, setChecked] = useState<BeforeYouPasteCheckId[]>([]);
  const [elapsedMs, setElapsedMs] = useState(0);
  const startedAtRef = useRef(Date.now());

  useEffect(() => {
    const startedAt = startedAtRef.current;
    const tick = setInterval(() => {
      setElapsedMs(Date.now() - startedAt);
    }, TICK_MS);
    return () => clearInterval(tick);
  }, []);

  const gate = resolveBeforeYouPasteGate({ checked, elapsedMs });

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <View style={styles.scrollWrap}>
        <ScrollView contentContainerStyle={styles.body}>
          <Text style={styles.title} accessibilityRole="header">
            {gate.title}
          </Text>
          <Text style={styles.subtitle}>{gate.body}</Text>

          <View style={styles.checks}>
            {gate.checks.map((check) => (
              <Pressable
                key={check.id}
                onPress={() =>
                  setChecked((current) =>
                    toggleBeforeYouPasteCheck(current, check.id),
                  )
                }
                accessibilityRole="checkbox"
                accessibilityState={{ checked: check.checked }}
                accessibilityLabel={check.label}
                style={styles.check}
              >
                <View
                  style={[styles.box, check.checked ? styles.boxChecked : null]}
                  accessible={false}
                >
                  {check.checked ? (
                    <CorsoIcon name="check" size={16} color={colors.canvas} />
                  ) : null}
                </View>
                <Text style={styles.checkLabel} accessible={false}>
                  {check.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
        <ScrollEdgeFade color={colors.canvas} />
      </View>

      <View style={styles.footer}>
        <PrimaryCTA
          label={gate.ctaLabel}
          disabled={gate.ctaDisabled}
          accessibilityLabel={gate.ctaLabel}
          onPress={() => {
            // Re-checked against a live clock: the render that drew this
            // button may be up to one tick stale.
            if (
              !canLeaveBeforeYouPaste({
                checked,
                elapsedMs: Date.now() - startedAtRef.current,
              })
            ) {
              return;
            }
            onContinue();
          }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  scrollWrap: { flex: 1, position: 'relative' },
  body: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl * 2,
    paddingBottom: spacing.xl,
  },
  title: {
    color: colors.ink,
    fontSize: typography.screenTitle,
    fontFamily: typography.face('600'),
    fontWeight: '600',
    letterSpacing: -0.6,
  },
  subtitle: {
    marginTop: spacing.sm,
    color: colors.inkTertiary,
    fontSize: typography.title,
  },
  checks: {
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  check: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    minHeight: 44,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
  },
  box: {
    width: 24,
    height: 24,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.glassStroke,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxChecked: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  checkLabel: {
    flex: 1,
    color: colors.inkSecondary,
    fontSize: typography.body,
    lineHeight: 22,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.sm,
  },
});

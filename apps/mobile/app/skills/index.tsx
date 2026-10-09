import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { goBackOr } from '@/src/features/navigation/goBackOr';
import { BACK_FALLBACK } from '@/src/features/navigation/guardedBack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { copy } from '@/constants/copy';
import { CorsoText } from '@/src/theme/CorsoText';
import { useSkillsDirectoryConfig } from '@/src/features/skills/directory/skillsDirectoryGuard';
import { buildSkillCards } from '@/src/features/skills/directory/skillsDirectoryPresentation';
import {
  CANON_TYPE_SIZES,
  canonTracking,
  canonWeight,
} from '@/src/ui/cards/canonType';
import { ONGLASS, ONGLASS_HI } from '@/src/ui/glass/materialTokens';
import { ScreenHeader } from '@/src/ui/navigation/ScreenHeader';
import { ScrollEdgeFade } from '@/src/ui/primitives/ScrollEdgeFade';
import { colors, radii, spacing, typography } from '@/src/ui/tokens';
import { SettingsCard } from '@/src/ui/cards/SettingsCard';

const CARDS = buildSkillCards();

export default function SkillsDirectoryScreen() {
  const gate = useSkillsDirectoryConfig();

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader
        onBack={() => goBackOr(BACK_FALLBACK.shell)}
        backAccessibilityLabel={copy.skills.back}
        title={copy.skills.title}
      />
      {gate.status === 'ready' && !gate.enabled ? (
        <View style={styles.offBody}>
          <CorsoText style={styles.muted}>{copy.skills.empty}</CorsoText>
        </View>
      ) : (
        <View style={styles.scrollWrap}>
          <ScrollView contentContainerStyle={styles.body}>
            <CorsoText style={styles.lead}>{copy.skills.lead}</CorsoText>
            <CorsoText style={styles.hint}>{copy.skills.browseHint}</CorsoText>
            {CARDS.map((card) => (
              <Pressable
                key={card.id}
                onPress={() => router.push(`/skills/${card.id}`)}
                accessibilityRole="button"
                accessibilityLabel={card.name}
                disabled={gate.status !== 'ready'}
                testID={`skill-card-${card.id}`}
              >
                {({ pressed }) => (
                  <SettingsCard
                    radius={radii.pane}
                    contentStyle={styles.cardContent}
                    state={pressed ? 'hi' : 'rest'}
                  >
                    <View style={styles.cardTop}>
                      <CorsoText style={styles.cardName}>{card.name}</CorsoText>
                      <View
                        style={[
                          styles.kindPill,
                          card.kind === 'analytics'
                            ? styles.kindPillReading
                            : null,
                        ]}
                      >
                        <CorsoText
                          style={[
                            styles.kindText,
                            card.kind === 'analytics'
                              ? styles.kindTextReading
                              : null,
                          ]}
                        >
                          {card.kindLabel}
                        </CorsoText>
                      </View>
                    </View>
                    <CorsoText style={styles.cardCategory}>
                      {card.categoryLabel}
                    </CorsoText>
                    <CorsoText style={styles.cardWhat}>{card.what}</CorsoText>
                  </SettingsCard>
                )}
              </Pressable>
            ))}
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
    gap: spacing.smd,
  },
  offBody: { padding: spacing.gutter },
  lead: {
    color: colors.ink,
    fontSize: CANON_TYPE_SIZES.askTitle,
    lineHeight: Math.round(CANON_TYPE_SIZES.askTitle * 1.16),
    letterSpacing: canonTracking(CANON_TYPE_SIZES.askTitle, -0.024),
    fontFamily: typography.face('600'),
    fontWeight: canonWeight('600'),
    marginTop: spacing.sm,
  },
  hint: {
    color: colors.inkTertiary,
    fontSize: CANON_TYPE_SIZES.body,
    lineHeight: Math.round(CANON_TYPE_SIZES.body * 1.45),
    fontFamily: typography.face('500'),
    fontWeight: canonWeight('500'),
    marginBottom: spacing.sm,
  },
  muted: {
    color: colors.inkTertiary,
    fontSize: CANON_TYPE_SIZES.body,
    fontFamily: typography.face('500'),
    fontWeight: canonWeight('500'),
  },
  /** Inner box only — the material, radius and clipping are the card's. */
  cardContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: 15,
    gap: spacing.xs,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  cardName: {
    flexShrink: 1,
    color: colors.ink,
    fontSize: CANON_TYPE_SIZES.cardTitle,
    letterSpacing: canonTracking(CANON_TYPE_SIZES.cardTitle, -0.01),
    fontFamily: typography.face('600'),
    fontWeight: canonWeight('600'),
  },
  kindPill: {
    borderRadius: radii.pill,
    backgroundColor: ONGLASS_HI,
    paddingHorizontal: 9,
    paddingVertical: 4,
    flexShrink: 0,
  },
  kindPillReading: { backgroundColor: ONGLASS },
  kindText: {
    color: colors.ink,
    fontSize: CANON_TYPE_SIZES.micro,
    fontFamily: typography.face('600'),
    fontWeight: canonWeight('600'),
  },
  kindTextReading: { color: colors.inkTertiary },
  cardCategory: {
    color: colors.inkTertiary,
    fontSize: CANON_TYPE_SIZES.sub,
    fontFamily: typography.face('500'),
    fontWeight: canonWeight('500'),
  },
  cardWhat: {
    color: colors.inkTertiary,
    fontSize: CANON_TYPE_SIZES.body,
    lineHeight: 18,
    fontFamily: typography.face('500'),
    fontWeight: canonWeight('500'),
  },
});

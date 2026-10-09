import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { copy } from '@/constants/copy';
import { GlassPill } from '@/src/ui/controls/GlassPill';
import { colors, spacing, typography } from '@/constants/theme';

/**
 * Unknown route. Was Expo template scaffolding — the only white screen in the
 * app, plus a `title: 'Oops!'` header on a stack whose headers are hidden
 * everywhere else. Void canvas, no header, Corso voice.
 */
export default function NotFoundScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.canvas}>
        <Text style={styles.title} accessibilityRole="header">
          {copy.notFound.title}
        </Text>
        <Text style={styles.body}>{copy.notFound.body}</Text>
        <GlassPill
          label={copy.notFound.cta}
          onPress={() => router.replace('/')}
          style={styles.cta}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  canvas: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  title: {
    fontSize: typography.title,
    fontWeight: '600',
    color: colors.ink,
  },
  body: {
    fontSize: typography.body,
    color: colors.inkTertiary,
    marginBottom: spacing.lg,
  },
  /** The pill owns its own geometry; the screen only says it wants the column. */
  cta: { alignSelf: 'stretch' },
});

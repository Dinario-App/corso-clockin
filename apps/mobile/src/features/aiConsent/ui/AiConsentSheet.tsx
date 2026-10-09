import { Pressable, StyleSheet, View } from 'react-native';
import { CorsoText } from '@/src/theme/CorsoText';
import { PrimaryCTA } from '@/src/ui/controls/PrimaryCTA';
import { SecondaryCTA } from '@/src/ui/controls/SecondaryCTA';
import { BottomSheet } from '@/src/ui/primitives/BottomSheet';
import { colors, kitType, kitWeight, spacing, typography } from '@/src/ui/tokens';
import {
  AI_CONSENT_PILL_GAP,
  type AiConsentSheetPresentation,
} from './aiConsentSheetPresentation';

export type AiConsentSheetProps = {
  /** `null` hides the sheet. */
  presentation: AiConsentSheetPresentation | null;
  onAllow: () => void;
  onDecline: () => void;
  /** Close circle, scrim or Android back: no decision. */
  onDismiss: () => void;
  onOpenPrivacy: (href: AiConsentSheetPresentation['privacyHref']) => void;
  testID?: string;
};

export function AiConsentSheet({
  presentation,
  onAllow,
  onDecline,
  onDismiss,
  onOpenPrivacy,
  testID,
}: AiConsentSheetProps) {
  if (presentation === null) return null;
  return (
    <BottomSheet
      title={presentation.title}
      visible
      dismissible={presentation.sheet.dismissible}
      signing={presentation.sheet.signing}
      kind={presentation.sheet.kind}
      surface={presentation.sheet.surface}
      closeButton={presentation.sheet.closeButton}
      onRequestClose={onDismiss}
      testID={testID}
      footer={
        <View style={styles.footer}>
          <PrimaryCTA
            label={presentation.allowLabel}
            onPress={onAllow}
            testID={testID ? `${testID}-allow` : undefined}
          />
          <SecondaryCTA
            label={presentation.declineLabel}
            onPress={onDecline}
            style={styles.decline}
            testID={testID ? `${testID}-decline` : undefined}
          />
        </View>
      }
    >
      <View style={styles.body}>
        {presentation.paragraphs.map((paragraph) => (
          <CorsoText key={paragraph} style={styles.paragraph}>
            {paragraph}
          </CorsoText>
        ))}
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={presentation.privacyLinkLabel}
          onPress={() => onOpenPrivacy(presentation.privacyHref)}
          style={styles.linkHit}
          testID={testID ? `${testID}-privacy` : undefined}
        >
          <CorsoText style={styles.link}>{presentation.privacyLinkLabel}</CorsoText>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: spacing.smd,
    paddingBottom: spacing.smd,
  },
  paragraph: {
    fontFamily: typography.face(kitWeight.regular),
    fontSize: kitType.body,
    fontWeight: kitWeight.regular,
    lineHeight: 24,
    color: colors.ink,
  },
  linkHit: {
    minHeight: 44,
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  link: {
    fontFamily: typography.face(kitWeight.regular),
    fontSize: kitType.sub,
    fontWeight: kitWeight.regular,
    color: colors.ink,
  },
  footer: {
    alignSelf: 'stretch',
    gap: AI_CONSENT_PILL_GAP,
    paddingTop: spacing.smd,
  },
  /** `SecondaryCTA` carries its own bottom margin for stacks; the footer gap owns the spacing here. */
  decline: { marginBottom: 0 },
});

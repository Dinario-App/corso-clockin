import { Pressable, StyleSheet } from 'react-native';
import { CorsoText } from '@/src/theme/CorsoText';
import { CorsoGlassFill, corsoGlassDrop } from '@/src/ui/glass/CorsoGlass';
import { typography } from '@/src/ui/tokens';
import {
  VERDICT_CARD_GEOMETRY as G,
  canonWeight,
  resolveVerdictCtaTone,
} from './verdictCardPresentation';

export type VerdictCtaAction = {
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
  disabled?: boolean;
  testID?: string;
};

export function VerdictCta({
  action,
  pressable = true,
}: {
  action: VerdictCtaAction;
  /** False while the card is still revealing this button. */
  pressable?: boolean;
}) {
  const cta = resolveVerdictCtaTone();
  const disabled = action.disabled === true;

  return (
    <Pressable
      onPress={action.onPress}
      disabled={disabled || !pressable}
      pointerEvents={pressable ? 'auto' : 'none'}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      accessibilityLabel={action.accessibilityLabel ?? action.label}
      testID={action.testID}
      style={({ pressed }) => [
        styles.cta,
        {
          backgroundColor: disabled ? cta.fillDisabled : undefined,
          boxShadow: disabled ? undefined : corsoGlassDrop(cta.material),
          transform: [{ translateY: pressed ? cta.pressTranslateY : 0 }],
        },
      ]}
    >
      {disabled ? null : (
        <CorsoGlassFill material={cta.material} radius={G.ctaRadius} />
      )}
      <CorsoText
        style={[
          styles.ctaLabel,
          { color: disabled ? cta.labelDisabled : cta.label },
        ]}
      >
        {action.label}
      </CorsoText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  /** A floor, not a fixed height: a label that wraps at a large type size grows the pill. */
  cta: {
    width: '100%',
    minHeight: G.ctaHeight,
    paddingHorizontal: 16,
    borderRadius: G.ctaRadius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaLabel: {
    fontSize: G.ctaLabelSize,
    fontFamily: typography.face(G.ctaLabelWeight),
    fontWeight: canonWeight(G.ctaLabelWeight),
  },
});

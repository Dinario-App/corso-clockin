import { useState } from 'react';
import { router } from 'expo-router';
import { StyleSheet, TextInput, View } from 'react-native';
import { copy } from '@/constants/copy';
import { CorsoText } from '@/src/theme/CorsoText';
import { FirstRunFrame } from '@/src/features/onboarding/FirstRunFrame';
import {
  FIRST_RUN_ROUTES,
  PORTFOLIO_NAME_DEFAULT,
  PORTFOLIO_NAME_MAX,
} from '@/src/features/onboarding/firstRunOnboarding';
import { savePortfolioName } from '@/src/features/onboarding/portfolioNameStore';
import { IcyCta, QuietSecondary } from '@/src/ui/quiet/QuietButtons';
import {
  QUIET_FIELD,
} from '@/src/ui/quiet/quietMarkPresentation';
import { ETHENA_ACCESSIBLE_RIM, ethena } from '@/constants/theme.ethena';
import { ethenaGeometry } from '@/constants/theme.ethenaGeometry';
import { useInkContrastEnabled } from '@/src/ui/glass/useInkContrast';
import { useEthenaMaterial } from '@/src/ui/ethena/useEthenaMaterial';

export default function FirstRunNameScreen() {
  const [name, setName] = useState('');
  const tray = useEthenaMaterial('ground');
  const trayPaint = {
    backgroundColor: tray.fill as string,
    borderWidth: Math.max(1, tray.borderWidth),
    borderColor: tray.borderColor ?? undefined,
  };
  // The field's icy edge is an input boundary (WCAG 1.4.11): it keeps it,
  // and takes the accessible rim under Increase Contrast.
  const increaseContrast = useInkContrastEnabled();

  const next = () => router.replace(FIRST_RUN_ROUTES.how);

  const save = () => {
    // Best effort: a failed write keeps the default, never blocks the step.
    void savePortfolioName(name);
    next();
  };

  return (
    <FirstRunFrame
      title={copy.firstRun.nameTitle}
      subtitle={copy.firstRun.nameHint}
      titleTop={73}
      footer={
        <>
          <IcyCta
            testID="first-run-name-continue"
            label={copy.firstRun.continue}
            onPress={save}
          />
          <QuietSecondary
            testID="first-run-name-skip"
            label={copy.firstRun.skip}
            onPress={next}
          />
        </>
      }
    >
      <TextInput
        testID="first-run-name-field"
        value={name}
        onChangeText={setName}
        placeholder={PORTFOLIO_NAME_DEFAULT}
        placeholderTextColor={ethena.ink.secondary}
        maxLength={PORTFOLIO_NAME_MAX}
        accessibilityLabel={copy.firstRun.nameA11y}
        returnKeyType="done"
        onSubmitEditing={save}
        style={[
          styles.field,
          {
            backgroundColor: tray.fill as string,
            borderColor: increaseContrast ? ETHENA_ACCESSIBLE_RIM : QUIET_FIELD.edge,
          },
        ]}
      />
      <View
        testID="first-run-name-chips"
        style={styles.chips}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {copy.firstRun.namePreview.map((label) => (
          <View key={label} style={[styles.chip, trayPaint]}>
            <CorsoText style={styles.chipLabel}>{label}</CorsoText>
          </View>
        ))}
      </View>
    </FirstRunFrame>
  );
}

const styles = StyleSheet.create({
  field: {
    marginTop: 34,
    height: QUIET_FIELD.height,
    borderRadius: QUIET_FIELD.radius,
    borderWidth: 1,
    paddingHorizontal: 16,
    color: ethena.ink.primary,
    fontSize: 16,
  },
  chips: { marginTop: 24, flexDirection: 'row', gap: 8 },
  chip: {
    borderRadius: ethenaGeometry.radiusBox,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipLabel: {
    color: ethena.ink.secondary,
    fontSize: 13,
    fontWeight: '500',
  },
});

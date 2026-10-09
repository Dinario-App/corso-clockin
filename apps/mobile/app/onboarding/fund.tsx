import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { copy } from '@/constants/copy';
import { CorsoText } from '@/src/theme/CorsoText';
import { useUsdcBalance } from '@/src/features/balances/useUsdcBalance';
import { useMoonPay } from '@/src/features/ramp/MoonPayProvider';
import { FirstRunFrame } from '@/src/features/onboarding/FirstRunFrame';
import {
  completeFirstRun,
  resolveFirstRunCashLabel,
} from '@/src/features/onboarding/firstRunOnboarding';
import { useCorsoSession } from '@/src/features/session/SessionContext';
import { IcyCta, QuietSecondary } from '@/src/ui/quiet/QuietButtons';
import {
  QUIET_CASH_CARD,
} from '@/src/ui/quiet/quietMarkPresentation';
import { ethena } from '@/constants/theme.ethena';
import { useEthenaMaterial } from '@/src/ui/ethena/useEthenaMaterial';

export default function FirstRunFundScreen() {
  const tray = useEthenaMaterial('ground');
  const trayPaint = {
    backgroundColor: tray.fill as string,
    borderWidth: Math.max(1, tray.borderWidth),
    borderColor: tray.borderColor ?? undefined,
  };
  const { session } = useCorsoSession();
  const { flow: moonPay } = useMoonPay();
  const usdc = useUsdcBalance(session?.address);
  const cash = resolveFirstRunCashLabel({
    status: usdc.status,
    atomic: usdc.atomic,
    placeholder: copy.home.balancePlaceholder,
  });

  const land = (fund: boolean) => {
    completeFirstRun();
    router.replace('/(app)');
    if (fund) moonPay.open('USDC');
  };

  return (
    <FirstRunFrame
      title={copy.firstRun.fundTitle}
      subtitle={copy.firstRun.fundSub}
      titleTop={93}
      footer={
        <>
          <IcyCta
            testID="first-run-fund-add"
            label={copy.firstRun.fundAdd}
            onPress={() => land(true)}
          />
          <QuietSecondary
            testID="first-run-fund-explore"
            label={copy.firstRun.fundExplore}
            onPress={() => land(false)}
          />
        </>
      }
    >
      <View testID="first-run-fund-card" style={[styles.card, trayPaint]} accessible>
        <CorsoText style={styles.amount}>{cash}</CorsoText>
        <CorsoText style={styles.cardLabel}>{copy.firstRun.fundCash}</CorsoText>
      </View>
    </FirstRunFrame>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 40,
    height: QUIET_CASH_CARD.height,
    borderRadius: QUIET_CASH_CARD.radius,
    paddingHorizontal: 17,
    justifyContent: 'center',
  },
  amount: {
    color: ethena.ink.primary,
    fontSize: 32,
    fontWeight: '600',
  },
  cardLabel: {
    marginTop: 6,
    color: ethena.ink.secondary,
    fontSize: 14,
    fontWeight: '500',
  },
});

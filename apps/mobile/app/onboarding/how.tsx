import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { copy } from '@/constants/copy';
import { CorsoText } from '@/src/theme/CorsoText';
import { FirstRunFrame } from '@/src/features/onboarding/FirstRunFrame';
import { FIRST_RUN_ROUTES } from '@/src/features/onboarding/firstRunOnboarding';
import { IcyCta } from '@/src/ui/quiet/QuietButtons';
import {
  QUIET_ROW,
  QUIET_ROW_DISC,
} from '@/src/ui/quiet/quietMarkPresentation';
import { ethena } from '@/constants/theme.ethena';
import { useEthenaMaterial } from '@/src/ui/ethena/useEthenaMaterial';

function RowDisc() {
  const d = QUIET_ROW_DISC.size;
  return (
    <Svg width={d} height={d}>
      <Defs>
        <LinearGradient id="first-run-disc" x1="0" y1="0" x2="0" y2="1">
          <Stop
            offset={0}
            stopColor={QUIET_ROW_DISC.from.color}
            stopOpacity={QUIET_ROW_DISC.from.opacity}
          />
          <Stop
            offset={1}
            stopColor={QUIET_ROW_DISC.to.color}
            stopOpacity={QUIET_ROW_DISC.to.opacity}
          />
        </LinearGradient>
      </Defs>
      <Circle cx={d / 2} cy={d / 2} r={d / 2} fill="url(#first-run-disc)" />
    </Svg>
  );
}

export default function FirstRunHowScreen() {
  const tray = useEthenaMaterial('ground');
  const trayPaint = {
    backgroundColor: tray.fill as string,
    borderWidth: Math.max(1, tray.borderWidth),
    borderColor: tray.borderColor ?? undefined,
  };
  return (
    <FirstRunFrame
      title={copy.firstRun.howTitle}
      subtitle={copy.firstRun.howSub}
      titleTop={53}
      footer={
        <IcyCta
          testID="first-run-how-continue"
          label={copy.firstRun.continue}
          onPress={() => router.replace(FIRST_RUN_ROUTES.fund)}
        />
      }
    >
      <View testID="first-run-how-rows" style={styles.rows}>
        {copy.firstRun.howRows.map((row) => (
          <View key={row.title} style={[styles.row, trayPaint]} accessible>
            <RowDisc />
            <View style={styles.rowText}>
              <CorsoText style={styles.rowTitle}>{row.title}</CorsoText>
              <CorsoText style={styles.rowBody}>{row.body}</CorsoText>
            </View>
          </View>
        ))}
      </View>
      <CorsoText style={styles.foot}>{copy.firstRun.howFoot}</CorsoText>
    </FirstRunFrame>
  );
}

const styles = StyleSheet.create({
  rows: { marginTop: 36, gap: QUIET_ROW.gap },
  row: {
    height: QUIET_ROW.height,
    borderRadius: QUIET_ROW.radius,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 12,
  },
  rowText: { flex: 1 },
  rowTitle: {
    color: ethena.ink.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  rowBody: {
    marginTop: 4,
    color: ethena.ink.secondary,
    fontSize: 13,
  },
  foot: {
    marginTop: 32,
    textAlign: 'center',
    color: ethena.ink.secondary,
    fontSize: 13,
    lineHeight: 18,
  },
});

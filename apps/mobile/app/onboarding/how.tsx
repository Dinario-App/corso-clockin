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
import { readWealthV1BuildFlag } from '@/src/features/wealth/wealthEnv';
import { CorsoIcon } from '@/src/ui/icons/CorsoIcon';
import type { CorsoIconName } from '@/src/ui/icons/corsoIconNames';

const WEALTH_HOW_ROW_ICONS = [
  'mix',
  'checked',
  'lock',
] as const satisfies readonly CorsoIconName[];
const HOW_ROW_GLYPH = 18;

/** `127:107` — the row disc: icy 35% → deep 15%, top to bottom. */
function RowDisc({ icon }: { icon?: CorsoIconName }) {
  const d = QUIET_ROW_DISC.size;
  return (
    <View style={styles.disc}>
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
      {icon ? (
        <View style={styles.glyph}>
          <CorsoIcon
            name={icon}
            size={HOW_ROW_GLYPH}
            color={ethena.ink.secondary}
          />
        </View>
      ) : null}
    </View>
  );
}

export default function FirstRunHowScreen() {
  const tray = useEthenaMaterial('ground');
  const trayPaint = {
    backgroundColor: tray.fill as string,
    borderWidth: Math.max(1, tray.borderWidth),
    borderColor: tray.borderColor ?? undefined,
  };
  const wealthV1 = readWealthV1BuildFlag();
  const rows = wealthV1 ? copy.wealthV1.firstRun.howRows : copy.firstRun.howRows;
  return (
    <FirstRunFrame
      title={copy.firstRun.howTitle}
      subtitle={wealthV1 ? undefined : copy.firstRun.howSub}
      titleTop={53}
      footer={
        <IcyCta
          testID="first-run-how-continue"
          label={copy.firstRun.continue}
          onPress={() =>
            router.replace(
              wealthV1 ? FIRST_RUN_ROUTES.pick : FIRST_RUN_ROUTES.fund,
            )
          }
        />
      }
    >
      <View testID="first-run-how-rows" style={styles.rows}>
        {rows.map((row, i) => (
          <View
            key={row.title}
            style={[styles.row, wealthV1 && styles.rowWraps, trayPaint]}
            accessible
          >
            <RowDisc icon={wealthV1 ? WEALTH_HOW_ROW_ICONS[i] : undefined} />
            <View style={styles.rowText}>
              <CorsoText style={styles.rowTitle}>{row.title}</CorsoText>
              <CorsoText style={styles.rowBody}>{row.body}</CorsoText>
            </View>
          </View>
        ))}
      </View>
      <CorsoText style={styles.foot}>
        {wealthV1 ? copy.wealthV1.firstRun.howFoot : copy.firstRun.howFoot}
      </CorsoText>
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
  rowWraps: {
    height: undefined,
    minHeight: QUIET_ROW.height,
    paddingVertical: 14,
  },
  disc: { width: QUIET_ROW_DISC.size, height: QUIET_ROW_DISC.size },
  glyph: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
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

import { useEffect, useMemo, useState } from 'react';
import { Redirect, router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { copy } from '@/constants/copy';
import { CorsoText } from '@/src/theme/CorsoText';
import { FirstRunFrame } from '@/src/features/onboarding/FirstRunFrame';
import {
  FIRST_RUN_ROUTES,
  completeFirstRun,
} from '@/src/features/onboarding/firstRunOnboarding';
import { useAcquireGateInputs } from '@/src/features/security/useAcquireGateInputs';
import { useCuratedBook } from '@/src/features/universe/useCuratedBook';
import {
  presentWealthPicks,
  type WealthPick,
} from '@/src/features/wealth/wealthPicks';
import { resolveNetworkStatus } from '@/src/lib/apiConfig';
import { QuietSecondary } from '@/src/ui/quiet/QuietButtons';
import { QUIET_ROW } from '@/src/ui/quiet/quietMarkPresentation';
import { TokenIconView } from '@/src/ui/primitives/TokenIconView';
import { ethena } from '@/constants/theme.ethena';
import { useEthenaMaterial } from '@/src/ui/ethena/useEthenaMaterial';
import { readWealthV1BuildFlag } from '@/src/features/wealth/wealthEnv';
import { usePlainRisk } from '@/src/features/plainRisk/usePlainRisk';
import { RiskLevelSlot, spokenRiskLevel } from '@/src/ui/risk/RiskLevel';

export default function FirstRunPickScreen() {
  if (!readWealthV1BuildFlag())
    return <Redirect href={FIRST_RUN_ROUTES.fund} />;
  return <FirstRunPicks />;
}

function FirstRunPicks() {
  const tray = useEthenaMaterial('ground');
  const trayPaint = {
    backgroundColor: tray.fill as string,
    borderWidth: Math.max(1, tray.borderWidth),
    borderColor: tray.borderColor ?? undefined,
  };
  // The network is read, never guessed: until it is known, no pick is drawn.
  const [cluster, setCluster] = useState<'devnet' | 'mainnet-beta' | null>(
    null,
  );
  useEffect(() => {
    let cancelled = false;
    void resolveNetworkStatus().then((status) => {
      if (!cancelled && status.state === 'known') setCluster(status.cluster);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  const gateInputs = useAcquireGateInputs();
  const curated = useCuratedBook(true, cluster);
  const picks = useMemo(
    () => presentWealthPicks({ cluster, gateInputs, book: curated.book }),
    [cluster, gateInputs, curated.book],
  );

  const open = (pick: WealthPick) => {
    completeFirstRun();
    router.replace('/(app)');
    router.push(pick.href);
  };

  const t = copy.wealthV1.firstRun;
  return (
    <FirstRunFrame
      title={t.pickTitle}
      subtitle={t.pickSub}
      titleTop={53}
      footer={
        <>
          <CorsoText style={styles.foot}>{t.pickFoot}</CorsoText>
          <QuietSecondary
            testID="first-run-pick-skip"
            label={copy.firstRun.skip}
            onPress={() => router.replace(FIRST_RUN_ROUTES.fund)}
          />
        </>
      }
    >
      <View testID="first-run-picks" style={styles.rows}>
        {picks.map((pick) => (
          <PickRow
            key={pick.key}
            pick={pick}
            trayPaint={trayPaint}
            onOpen={open}
          />
        ))}
      </View>
      {picks.length > 0 ? (
        <CorsoText style={styles.next}>{t.pickNext}</CorsoText>
      ) : null}
    </FirstRunFrame>
  );
}

function PickRow({
  pick,
  trayPaint,
  onOpen,
}: {
  pick: WealthPick;
  trayPaint: object;
  onOpen: (pick: WealthPick) => void;
}) {
  const risk = usePlainRisk(pick.mint);
  return (
    <Pressable
      testID={`first-run-pick-${pick.key}`}
      accessibilityRole="button"
      accessibilityLabel={[pick.name, pick.sub, spokenRiskLevel(risk)]
        .filter((part): part is string => part != null)
        .join(', ')}
      onPress={() => onOpen(pick)}
      style={({ pressed }) => [
        styles.row,
        trayPaint,
        pressed && styles.pressed,
      ]}
    >
      <TokenIconView
        symbol={pick.symbol}
        mint={pick.mint}
        size={36}
        accessibilityLabel={pick.name}
        accessible={false}
      />
      <View style={styles.rowText}>
        <CorsoText style={styles.rowTitle}>{pick.name}</CorsoText>
        <CorsoText style={styles.rowBody}>{pick.sub}</CorsoText>
      </View>
      <RiskLevelSlot read={risk} testID={`first-run-pick-${pick.key}-risk`} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  rows: { marginTop: 28, gap: QUIET_ROW.gap },
  row: {
    minHeight: QUIET_ROW.height,
    borderRadius: QUIET_ROW.radius,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  pressed: { opacity: 0.72 },
  rowText: { flex: 1 },
  rowTitle: {
    color: ethena.ink.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  rowBody: {
    marginTop: 2,
    color: ethena.ink.secondary,
    fontSize: 13,
  },
  next: {
    marginTop: 20,
    color: ethena.ink.secondary,
    fontSize: 13,
    lineHeight: 18,
  },
  foot: {
    marginBottom: 12,
    textAlign: 'center',
    color: ethena.ink.secondary,
    fontSize: 13,
    lineHeight: 18,
  },
});

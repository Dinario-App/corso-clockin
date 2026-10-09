import { useCallback, useEffect, useState } from 'react';
import { Redirect, router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  bookInitials,
  resolveBookName,
} from '@/src/features/home/book/homeBookPresenter';
import { MarketsScreen } from '@/src/features/markets/MarketsScreen';
import {
  marketsRowHref,
  presentMarketsMoving,
} from '@/src/features/markets/marketsMovingPresentation';
import { useMarketsMoving } from '@/src/features/markets/useMarketsMoving';
import {
  presentInvestmentPlans,
  presentStocksShelf,
} from '@/src/features/markets/marketsShelves';
import { useAcquireGateInputs } from '@/src/features/security/useAcquireGateInputs';
import { MARKETS_MAJOR_MINTS } from '@/src/features/markets/marketsMovingPresentation';
import { useWhy } from '@/src/features/why/useWhy';
import { SwapTokenPickerSheet } from '@/src/features/tokenFacts/SwapTokenPickerSheet';
import { readLaunchDockBuildFlag } from '@/src/features/navigation/launchDockEnv';
import { readPortfolioName } from '@/src/features/onboarding/portfolioNameStore';
import { useAccessibilityPreference } from '@/src/motion/useAccessibilityPreference';
import { usePullRefresh } from '@/src/ui/primitives/usePullRefresh';
import {
  LAUNCH_AVATAR_HREF,
  resolveTabBarPresentation,
} from '@/src/ui/navigation/tabBarPresentation';

export default function MarketsRoot() {
  if (!readLaunchDockBuildFlag()) return <Redirect href="/(app)" />;
  return <MarketsRoute />;
}

function MarketsRoute() {
  const insets = useSafeAreaInsets();
  const { reduceMotion } = useAccessibilityPreference();
  const moving = useMarketsMoving();
  const why = useWhy('moving', MARKETS_MAJOR_MINTS);
  const gateInputs = useAcquireGateInputs();
  const [storedName, setStoredName] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void readPortfolioName().then((name) => {
      if (!cancelled) setStoredName(name);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const { refresh } = moving;
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );
  const pull = usePullRefresh(refresh);

  const dock = resolveTabBarPresentation({
    hidden: false,
    safeAreaBottom: insets.bottom,
    reduceMotion,
  });

  return (
    <>
      <StatusBar style="light" />
      <MarketsScreen
        model={presentMarketsMoving({
          prices: moving.prices,
          changes: moving.changes,
          nowMs: Date.now(),
          why,
        })}
        plans={presentInvestmentPlans()}
        stocks={presentStocksShelf(gateInputs)}
        initials={bookInitials(resolveBookName(storedName))}
        topInset={insets.top}
        dockReserve={dock.reserve}
        onOpenProfile={() => router.navigate(LAUNCH_AVATAR_HREF)}
        onOpenRow={(mint) => router.push(marketsRowHref(mint))}
        onOpenSearch={() => setSearchOpen(true)}
        refreshing={pull.refreshing}
        onRefresh={pull.onRefresh}
      />
      <SwapTokenPickerSheet
        visible={searchOpen}
        tokens={[]}
        selectedMint=""
        allowSearch
        acquireRows
        onSelect={(token) => {
          setSearchOpen(false);
          router.push(marketsRowHref(token.mint));
        }}
        onClose={() => setSearchOpen(false)}
      />
    </>
  );
}

import { MoonPayPendingCard } from '@/src/features/ramp/MoonPayPendingCard';
import { ImportedStatusAccess } from '@/src/features/ramp/ImportedStatusAccess';
import { useRampStatus } from '@/src/features/ramp/useRampStatus';
import { useCallback, useEffect, useRef, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePrivy } from '@privy-io/expo';
import { useFiatTotal } from '@/src/features/balances/useFiatTotal';
import {
  BOOK_ASK_HREF,
  BOOK_SETTINGS_HREF,
  BOOK_SLEEVE_HREF,
  bookMajorHref,
  openBookAddCash,
} from '@/src/features/home/book/bookDoors';
import {
  bookInitials,
  presentHomeBook,
  resolveBookName,
} from '@/src/features/home/book/homeBookPresenter';
import { maskHomeBook } from '@/src/features/balances/hideBalances';
import { useHideBalances } from '@/src/features/balances/hideBalancesPreference';
import { useOptionalMoonPayFlow } from '@/src/features/ramp/moonPayContext';
import {
  bindRampReturnRefresh,
  rampAssetAtomic,
} from '@/src/features/ramp/rampReturnRefresh';
import { CollateralStrip } from '@/src/features/desk/CollateralStrip';
import { BuyPickerSheet } from '@/src/features/home/buy/BuyPickerSheet';
import {
  buyPickerRowHref,
  presentBuyPicker,
} from '@/src/features/home/buy/buyPickerPresentation';
import { presentTodayCard } from '@/src/features/home/today/todayCardPresentation';
import { useTodayCard } from '@/src/features/home/today/useTodayCard';
import { SwapTokenPickerSheet } from '@/src/features/tokenFacts/SwapTokenPickerSheet';
import { BookScreen } from '@/src/features/home/book/BookScreen';
import {
  parseSeriousUniverse,
  withSeriousMajorNames,
  type SeriousName,
} from '@/src/features/home/seriousUniverse';
import { readPortfolioName } from '@/src/features/onboarding/portfolioNameStore';
import { useCorsoSession } from '@/src/features/session/SessionContext';
import { useAccessibilityPreference } from '@/src/motion/useAccessibilityPreference';
import { usePullRefresh } from '@/src/ui/primitives/usePullRefresh';
import { readLaunchDockBuildFlag } from '@/src/features/navigation/launchDockEnv';
import {
  LAUNCH_AVATAR_HREF,
  resolveTabBarPresentation,
} from '@/src/ui/navigation/tabBarPresentation';

export default function BookHomeScreen() {
  const rampItems = useRampStatus();
  const insets = useSafeAreaInsets();
  const { reduceMotion } = useAccessibilityPreference();
  const { session, locked } = useCorsoSession();
  const { getAccessToken } = usePrivy();
  const fiat = useFiatTotal(session?.address, { session, getAccessToken });
  const [storedName, setStoredName] = useState<string | null>(null);
  const today = useTodayCard();
  const [buyOpen, setBuyOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [seriousNames, setSeriousNames] = useState<SeriousName[]>([]);

  useEffect(() => {
    let cancelled = false;
    void readPortfolioName().then((name) => {
      if (!cancelled) setStoredName(name);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const { refresh } = fiat;
  const { refresh: refreshToday } = today;
  const moonPay = useOptionalMoonPayFlow();
  const liveBook = useRef({ refresh, holdings: fiat.holdings });
  liveBook.current = { refresh, holdings: fiat.holdings };
  const walletAddress = session?.address;
  useEffect(() => {
    if (!moonPay) return;
    return bindRampReturnRefresh(moonPay, {
      walletAddress,
      refresh: () => liveBook.current.refresh(),
      readQuantity: (wallet, asset) =>
        rampAssetAtomic(liveBook.current.holdings, wallet, asset),
    });
  }, [moonPay, walletAddress]);
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void readPortfolioName().then((name) => {
        if (!cancelled) setStoredName(name);
      });
      void refresh();
      refreshToday();
      return () => {
        cancelled = true;
      };
    }, [refresh, refreshToday]),
  );
  const pull = usePullRefresh(() => {
    refreshToday();
    return refresh();
  });

  const nowMs = Date.now();
  const hideBalances = useHideBalances();
  const heldBook = presentHomeBook(fiat, nowMs);
  const namesEligible =
    !locked &&
    session?.type === 'privy_embedded' &&
    heldBook.sections != null;
  useEffect(() => {
    if (!namesEligible) return undefined;
    const base = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/$/, '');
    if (!base) return undefined;
    let cancelled = false;
    void fetch(`${base}/v1/universe/serious`)
      .then((response) => (response.ok ? response.json() : null))
      .then((body: unknown) => {
        if (!cancelled && body != null) {
          setSeriousNames(parseSeriousUniverse(body));
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [namesEligible]);

  const shownBook = withSeriousMajorNames(
    heldBook,
    namesEligible ? seriousNames : [],
    fiat.holdings?.lines,
  );
  const model = hideBalances ? maskHomeBook(shownBook) : shownBook;
  const todayModel = presentTodayCard({
    prices: today.prices,
    changes: today.changes,
    mood: today.mood,
    nowMs,
  });
  const bookName = resolveBookName(storedName);
  const dock = resolveTabBarPresentation({
    hidden: false,
    safeAreaBottom: insets.bottom,
    reduceMotion,
  });

  return (
    <>
      <StatusBar style="light" />
      <BookScreen
        model={model}
        bookName={bookName}
        initials={bookInitials(bookName)}
        topInset={insets.top}
        dockReserve={dock.reserve}
        onAddCash={() => openBookAddCash(router)}
        hideBuy={session?.type === 'connected_external'}
        onBuy={() => { if (session?.type !== 'connected_external') setBuyOpen(true); }}
        onAsk={() => router.push(BOOK_ASK_HREF)}
        onSettings={() => router.push(BOOK_SETTINGS_HREF)}
        onOpenProfile={
          readLaunchDockBuildFlag()
            ? () => router.navigate(LAUNCH_AVATAR_HREF)
            : undefined
        }
        onOpenRow={(opens) => {
          if (opens.kind === 'sleeve') {
            router.push(BOOK_SLEEVE_HREF);
            return;
          }
          router.push(bookMajorHref(opens.mint));
        }}
        onOpenSleeve={() => router.push(BOOK_SLEEVE_HREF)}
        belowBook={<><ImportedStatusAccess /><MoonPayPendingCard items={rampItems} /><CollateralStrip /></>}
        refreshing={pull.refreshing}
        onRefresh={pull.onRefresh}
      />
      <BuyPickerSheet
        visible={buyOpen}
        model={presentBuyPicker(todayModel)}
        onSelectMajor={(mint) => {
          setBuyOpen(false);
          router.push(buyPickerRowHref(mint));
        }}
        onFindToken={() => {
          setBuyOpen(false);
          setSearchOpen(true);
        }}
        onClose={() => setBuyOpen(false)}
      />
      <SwapTokenPickerSheet
        visible={searchOpen}
        tokens={[]}
        selectedMint=""
        allowSearch
        acquireRows
        onSelect={(token) => {
          setSearchOpen(false);
          router.push(buyPickerRowHref(token.mint));
        }}
        onClose={() => setSearchOpen(false)}
      />
    </>
  );
}

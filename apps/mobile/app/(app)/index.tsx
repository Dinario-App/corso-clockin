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
  useOnReconnect,
  useReadFailState,
} from '@/src/features/connectivity/useConnectivity';
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
import { useAcquireGateInputs } from '@/src/features/security/useAcquireGateInputs';
import { presentTodayCard } from '@/src/features/home/today/todayCardPresentation';
import { useTodayCard } from '@/src/features/home/today/useTodayCard';
import { SwapTokenPickerSheet } from '@/src/features/tokenFacts/SwapTokenPickerSheet';
import { useCuratedBook } from '@/src/features/universe/useCuratedBook';
import { BookScreen } from '@/src/features/home/book/BookScreen';
import { LiveDeskCard } from '@/src/features/liveDesk/LiveDeskCard';
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
import { presentWealthHome } from '@/src/features/home/book/wealthHomePresenter';
import {
  readWealthHomeOptions,
  readWealthV1BuildFlag,
} from '@/src/features/wealth/wealthEnv';
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
  const acquireGateInputs = useAcquireGateInputs();
  const [searchOpen, setSearchOpen] = useState(false);
  const curated = useCuratedBook(searchOpen);
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
  const failState = useReadFailState();
  useOnReconnect(() => {
    refreshToday();
    void refresh();
  });
  const wealthV1 = readWealthV1BuildFlag();
  const heldBook = wealthV1
    ? presentWealthHome({ ...fiat, failState }, nowMs, readWealthHomeOptions())
    : presentHomeBook({ ...fiat, failState }, nowMs);
  const namesEligible =
    !wealthV1 &&
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

  const todayModel = presentTodayCard({
    prices: today.prices,
    changes: today.changes,
    mood: today.mood,
    nowMs,
    failState,
  });
  const shownBook = wealthV1
    ? heldBook
    : withSeriousMajorNames(
        heldBook,
        namesEligible ? seriousNames : [],
        fiat.holdings?.lines,
        presentBuyPicker(todayModel).rows,
      );
  const model = hideBalances ? maskHomeBook(shownBook) : shownBook;
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
        liveDesk={<LiveDeskCard plane="ground" testID="home-live-desk" />}
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
        model={presentBuyPicker(todayModel, acquireGateInputs)}
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
        bookState={curated.state}
        book={curated.book}
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

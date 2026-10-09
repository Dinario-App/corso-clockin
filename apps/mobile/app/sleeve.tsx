import { useCallback, useEffect, useRef, useState } from 'react';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { usePrivy } from '@privy-io/expo';
import { useFiatTotal } from '@/src/features/balances/useFiatTotal';
import { presentSleeve } from '@/src/features/sleeve/sleevePresentation';
import { maskSleeve, maskSleeveCap } from '@/src/features/balances/hideBalances';
import { useHideBalances } from '@/src/features/balances/hideBalancesPreference';
import {
  presentSleeveCap,
  type SleeveCapRead,
  type SleeveCapStep,
} from '@/src/features/sleeve/sleeveCap';
import {
  readSleeveCap,
  writeSleeveCap,
} from '@/src/features/sleeve/sleeveCapClient';
import {
  commitSleeveSell,
  resolveSleeveSell,
} from '@/src/features/sleeve/sleeveSell';
import { SwapTokenPickerSheet } from '@/src/features/tokenFacts/SwapTokenPickerSheet';
import { useTokenFacts } from '@/src/features/tokenFacts/useTokenFacts';
import { goBackOr } from '@/src/features/navigation/goBackOr';
import { BACK_FALLBACK } from '@/src/features/navigation/guardedBack';
import { resolveSwapEnabled } from '@/src/lib/apiConfig';
import { useCorsoSession } from '@/src/features/session/SessionContext';
import { bookMajorHref } from '@/src/features/home/book/bookDoors';
import { SleeveFace } from '@/src/ui/sleeve/SleeveFace';
import { copy } from '@/constants/copy';

export default function SleeveScreen() {
  const { session } = useCorsoSession();
  const { getAccessToken } = usePrivy();
  const params = useLocalSearchParams<{ sheet?: string }>();
  const fiat = useFiatTotal(session?.address, { session, getAccessToken });
  const [swapEnabled, setSwapEnabled] = useState<boolean | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [pendingSell, setPendingSell] = useState<string | null>(null);
  const [sellMessage, setSellMessage] = useState<string | null>(null);
  const [capRead, setCapRead] = useState<SleeveCapRead>({ kind: 'unknown' });
  const [sheetOpen, setSheetOpen] = useState(false);
  const [previewStep, setPreviewStep] = useState<SleeveCapStep | null>(null);
  const facts = useTokenFacts(pendingSell);

  useEffect(() => {
    void resolveSwapEnabled().then(setSwapEnabled);
  }, []);

  const { refresh } = fiat;
  useFocusEffect(
    useCallback(() => {
      void refresh();
      let cancelled = false;
      void readSleeveCap({
        getAccessToken:
          session?.type === 'privy_embedded' ? getAccessToken : undefined,
      }).then((next) => {
        if (!cancelled) setCapRead(next);
      });
      return () => {
        cancelled = true;
      };
    }, [refresh, session?.type, getAccessToken]),
  );

  const model = presentSleeve(fiat, Date.now(), {
    swapsOff: swapEnabled === false,
  });
  const cap = presentSleeveCap(fiat, capRead, previewStep);
  const hideBalances = useHideBalances();
  const shownModel = hideBalances ? maskSleeve(model) : model;
  const shownCap = hideBalances ? maskSleeveCap(cap) : cap;
  useEffect(() => {
    if (params.sheet === 'cap' && cap.showCapUi) setSheetOpen(true);
  }, [params.sheet, cap.showCapUi]);
  const latest = useRef({ model, fiat, session });
  latest.current = { model, fiat, session };

  useEffect(() => {
    if (!pendingSell) return;
    if (facts.status === 'idle' || facts.status === 'loading') return;
    const mint = pendingSell;
    setPendingSell(null);
    const { model: current, fiat: book, session: active } = latest.current;
    const row = current.rows.find((item) => item.mint === mint);
    const cluster = book.holdings?.cluster;
    if (!row || (cluster !== 'mainnet-beta' && cluster !== 'devnet')) {
      setSellMessage(copy.homeBook.unavailable);
      return;
    }
    const choice = resolveSleeveSell({
      mint: row.mint,
      symbol: row.symbol,
      decimals: row.decimals,
      cluster,
      walletType: active?.type ?? null,
      book: book.holdingsBook,
      facts: facts.facts,
    });
    if (choice.kind === 'door') {
      setSellMessage(null);
      commitSleeveSell(choice, (href) => router.push(href));
      return;
    }
    setSellMessage(
      choice.kind === 'error' ? choice.message : copy.homeBook.unavailable,
    );
  }, [pendingSell, facts.status, facts.facts]);

  return (
    <>
      <SleeveFace
        model={shownModel}
        cap={shownCap}
        sheetOpen={sheetOpen && cap.showCapUi}
        onBack={() => goBackOr(BACK_FALLBACK.shell)}
        onOpenHolding={(mint) => router.push(bookMajorHref(mint))}
        onFindToken={() => setSearchOpen(true)}
        onSell={(mint) => {
          setSellMessage(null);
          setPendingSell(mint);
        }}
        onOpenCapSheet={() => {
          if (!cap.showCapUi) return;
          setPreviewStep(null);
          setSheetOpen(true);
        }}
        onCloseCapSheet={() => setSheetOpen(false)}
        onSelectCapStep={(step) => setPreviewStep(step)}
        onConfirmCapStep={(step) => {
          void writeSleeveCap({
            capPercent: step,
            getAccessToken:
              session?.type === 'privy_embedded' ? getAccessToken : undefined,
          }).then((wrote) => {
            if (wrote.kind === 'known') {
              setCapRead(wrote);
              setPreviewStep(null);
              setSheetOpen(false);
              return;
            }
            if (wrote.kind === 'unknown') setCapRead({ kind: 'unknown' });
          });
        }}
        sellMessage={sellMessage}
      />
      <SwapTokenPickerSheet
        visible={searchOpen}
        tokens={[]}
        selectedMint=""
        allowSearch
        acquireRows
        onSelect={(token) => {
          setSearchOpen(false);
          router.push(bookMajorHref(token.mint));
        }}
        onClose={() => setSearchOpen(false)}
      />
    </>
  );
}

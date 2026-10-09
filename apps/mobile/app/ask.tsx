import { useEffect, useRef, useState } from 'react';
import type { TextInput } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePrivy } from '@privy-io/expo';
import {
  submitAsk,
  type AskAnswer,
  type AskAnswerShape,
  type AskSwapChoice,
  type AskSwapHandoff,
} from '@/src/features/ask/askClient';
import { runCorsoAsk } from '@/src/features/ask/connectedBrainAsk';
import { resolveDiscoveryOffAnswer } from '@/src/features/ask/discoveryOffAnswer';
import {
  resolveSellIntentAnswer,
  sellDoorHref,
} from '@/src/features/ask/sellIntentAnswer';
import {
  presentAskAnswer,
  presentAskSheet,
  presentSuggestions,
  type AskSheetPhase,
} from '@/src/features/ask/sheet/askSheetPresenter';
import {
  captureAiConsentOwner,
  defaultConsentDecision,
} from '@/src/features/aiConsent/aiConsentStore';
import { AiConsentHost } from '@/src/features/aiConsent/ui/AiConsentHost';
import {
  bindHomeAsk,
  createConsentHoldBox,
  holdForDefaultConsent,
  mountConsentHold,
  resolveHeldConsent,
  routeBoundAskAnswer,
} from '@/src/features/aiConsent/ui/homeConsentHold';
import { useFiatTotal } from '@/src/features/balances/useFiatTotal';
import { resolveDiscoveryEnabled } from '@/src/features/discovery/discoveryGuard';
import {
  bookMajorHref,
  openBookAddCash,
} from '@/src/features/home/book/bookDoors';
import { resolveBookName } from '@/src/features/home/book/homeBookPresenter';
import { buildSuggestedAsks } from '@/src/features/home/suggestedAsks';
import { readPortfolioName } from '@/src/features/onboarding/portfolioNameStore';
import { BACK_FALLBACK } from '@/src/features/navigation/guardedBack';
import { goBackOr } from '@/src/features/navigation/goBackOr';
import { useCorsoSession } from '@/src/features/session/SessionContext';
import { writeAskSourceTextForSwap } from '@/src/features/swap/askSourceTextStore';
import {
  resolveAskEnabled,
  resolveFeeBpsStatus,
  resolveSwapEnabled,
  resolveTokenVitalsEnabled,
  type FeeBpsStatus,
} from '@/src/lib/apiConfig';
import { AskSheet } from '@/src/ui/ethena/screens/AskSheet';

export default function AskSheetRoute() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ ask?: string }>();
  const { session } = useCorsoSession();
  const { getAccessToken } = usePrivy();
  const fiat = useFiatTotal(session?.address, { session, getAccessToken });

  const [draft, setDraft] = useState('');
  const [phase, setPhase] = useState<AskSheetPhase>({ kind: 'empty' });
  const [askEnabled, setAskEnabled] = useState(false);
  const [feeStatus, setFeeStatus] = useState<FeeBpsStatus | null>(null);
  const [swapsEnabled, setSwapsEnabled] = useState(false);
  const [vitalsEnabled, setVitalsEnabled] = useState(false);
  const [discoveryEnabled, setDiscoveryEnabled] = useState(false);
  const [storedName, setStoredName] = useState<string | null>(null);
  const input = useRef<TextInput>(null);
  const askRequestId = useRef(0);
  const consentHold = useRef(createConsentHoldBox());

  useEffect(() => {
    let cancelled = false;
    // Every gate fails closed until public config answers.
    void Promise.all([
      resolveAskEnabled().catch(() => false),
      resolveSwapEnabled().catch(() => false),
      resolveTokenVitalsEnabled().catch(() => false),
      resolveDiscoveryEnabled().catch(() => false),
      readPortfolioName().catch(() => null),
      resolveFeeBpsStatus().catch(() => null),
    ]).then(([askOn, swapsOn, vitalsOn, discoveryOn, name, fee]) => {
      if (cancelled) return;
      setAskEnabled(askOn);
      setSwapsEnabled(swapsOn);
      setVitalsEnabled(vitalsOn);
      setDiscoveryEnabled(discoveryOn);
      setStoredName(name);
      setFeeStatus(fee);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // A prefilled question goes into the field and waits for Send.
  useEffect(() => {
    if (typeof params.ask === 'string' && params.ask.trim() !== '')
      setDraft(params.ask);
  }, [params.ask]);

  useEffect(() => mountConsentHold(consentHold.current, consentEffects()), []);

  const bookName = resolveBookName(storedName);

  function land(
    question: string,
    answer: AskAnswer,
    shape: AskAnswerShape | null,
  ) {
    setDraft('');
    setPhase({
      kind: 'answered',
      question,
      outcome: presentAskAnswer({
        question,
        answer,
        shape,
        book: fiat,
        bookName,
        swapsEnabled,
        nowMs: Date.now(),
        feeStatus,
      }),
    });
  }

  function consentEffects() {
    return {
      landExplainer: (text: string, answer: AskAnswer) =>
        land(text, answer, null),
      drop: () => setPhase({ kind: 'empty' }),
      resend: (text: string, requestId: string) => {
        void runAsk(text, { consentRetry: true, sendId: requestId });
      },
    };
  }

  async function runAsk(
    question: string,
    options: { consentRetry?: boolean; sendId?: string } = {},
  ) {
    const text = question.trim();
    if (!text || !askEnabled) return;
    if (phase.kind === 'thinking' && options.consentRetry !== true) return;

    const discoveryOff = resolveDiscoveryOffAnswer({ text, discoveryEnabled });
    const initialSellIntent = resolveSellIntentAnswer({
      text,
      walletType: session?.type ?? null,
      book: fiat.holdingsBook,
      snapshot: fiat.holdings,
      fiat: fiat.result,
    });
    const requestId = ++askRequestId.current;
    const sendId = options.sendId ?? `ask-sheet-${requestId}`;
    const binding = bindHomeAsk(
      session?.address ?? null,
      captureAiConsentOwner(),
    );
    setPhase({ kind: 'thinking', question: text });

    let shape: AskAnswerShape | null = null;
    let resendWithConsent = false;
    await runCorsoAsk({
      submit: () =>
        submitAsk({
          text,
          holdings: fiat.holdings,
          result: fiat.result,
          quotes: fiat.quotes,
          routinesEnabled: false,
          vitalsEnabled,
          requestId: sendId,
          onShape: (read) => {
            shape = read;
          },
        }),
      isCurrent: () => askRequestId.current === requestId,
      onAnswer: (serverAnswer) => {
        const resolvedMint =
          serverAnswer.vitals?.render === 'token_vitals' &&
          !serverAnswer.vitals.tradeLeadIn
            ? serverAnswer.vitals.token.mint
            : undefined;
        const sellIntent =
          initialSellIntent ??
          (resolvedMint
            ? resolveSellIntentAnswer({
                text,
                walletType: session?.type ?? null,
                book: fiat.holdingsBook,
                snapshot: fiat.holdings,
                fiat: fiat.result,
                resolvedMint,
              })
            : null);
        const route = routeBoundAskAnswer({
          binding,
          answer: serverAnswer,
          overlaid: discoveryOff !== null || sellIntent !== null,
          decision: defaultConsentDecision(),
          consentRetry: options.consentRetry === true,
        });
        if (route === 'drop') {
          setPhase({ kind: 'empty' });
          return false;
        }
        if (route === 'hold') {
          holdForDefaultConsent(
            consentHold.current,
            { text, answer: serverAnswer, binding },
            consentEffects(),
          );
          return false;
        }
        if (route === 'retry') {
          resendWithConsent = true;
          return false;
        }
        const overlay = discoveryOff ?? sellIntent;
        land(text, overlay ?? serverAnswer, overlay ? null : shape);
        return false;
      },
      getTake: null,
      onTake: () => {},
    });
    if (resendWithConsent) await runAsk(text, { consentRetry: true });
  }

  const outcome = phase.kind === 'answered' ? phase.outcome : null;
  const suggestions = presentSuggestions(
    fiat.holdings,
    buildSuggestedAsks({ holdings: fiat.holdings, askPhase: 'idle' }),
  );
  const view = presentAskSheet({
    phase,
    askEnabled,
    suggestions: suggestions.chips,
  });

  // A deep link can open the sheet with nothing beneath it: then the Book.
  function close() {
    goBackOr(BACK_FALLBACK.shell);
  }

  function openReview(swap: AskSwapHandoff) {
    // The same door the Ask-era Home used: navigation, never execution.
    writeAskSourceTextForSwap(
      phase.kind === 'answered' ? phase.question : null,
    );
    router.replace({
      pathname: '/swap',
      params: {
        askFromSymbol: swap.fromSymbol,
        askToSymbol: swap.toSymbol,
        askToMint: swap.toMint,
        askToDecimals: String(swap.toDecimals),
        askInAmountAtomic: swap.inAmountAtomic,
        ...(swap.amountGuard ? { askAmountGuard: swap.amountGuard } : {}),
      },
    });
  }

  function openPair(choice: AskSwapChoice) {
    // Which token was answered; the amount stays empty (the composer's rest).
    writeAskSourceTextForSwap(
      phase.kind === 'answered' ? phase.question : null,
    );
    router.replace({
      pathname: '/swap',
      params: {
        askFromSymbol: choice.fromSymbol,
        askToSymbol: choice.symbol,
        askToMint: choice.mint,
        askToDecimals: String(choice.decimals),
        askAmountless: '1',
      },
    });
  }

  function chip(key: string) {
    if (phase.kind === 'empty') {
      const suggestion = suggestions.actions[key];
      if (!suggestion) return;
      if (suggestion.action === 'fund') {
        openBookAddCash(router);
        return;
      }
      setDraft(suggestion.label);
      void runAsk(suggestion.label);
      return;
    }
    const action = outcome?.actions.chips[key];
    if (!action) return;
    if (action.kind === 'ask') void runAsk(action.text);
    else if (action.kind === 'pair') openPair(action.choice);
    else router.replace(bookMajorHref(action.mint));
  }

  function door(key: string) {
    const action = outcome?.actions.doors[key];
    if (!action) return;
    if (action.kind === 'addCash') openBookAddCash(router);
    else router.replace(sellDoorHref(action.door));
  }

  return (
    <>
      <AskSheet
        view={view}
        draft={draft}
        inputRef={input}
        bottomInset={insets.bottom}
        onChangeDraft={setDraft}
        onSend={() => void runAsk(draft)}
        onChip={chip}
        onDoor={door}
        onOpen={() => {
          if (outcome?.actions.openMint)
            router.replace(bookMajorHref(outcome.actions.openMint));
        }}
        onOpenReview={() => {
          if (outcome?.actions.review && swapsEnabled)
            openReview(outcome.actions.review);
        }}
        // Wait closes the card and logs nothing; the sheet stays.
        onWait={() => setPhase({ kind: 'empty' })}
        onClose={close}
      />
      <AiConsentHost
        onResolve={(request, resolution) => {
          void resolveHeldConsent(
            consentHold.current,
            request,
            resolution,
            consentEffects(),
          );
        }}
        testID="ask-sheet-consent"
      />
    </>
  );
}

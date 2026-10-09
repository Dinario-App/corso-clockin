import { accountCopy } from './copy/account';
import { aiConnectCopy } from './copy/aiConnect';
import { aiConsentControlCopy } from './copy/aiConsentControl';
import { aiConsentCopy } from './copy/aiConsent';
import { browseCopy } from './copy/browse';
import { composerCopy } from './copy/composer';
import { homeCopy } from './copy/home';
import { howItWorksCopy } from './copy/howItWorks';
import { importFailureCopy } from './copy/importFailure';
import { moneyCopy } from './copy/money';
import { paperCopy } from './copy/paper';
import { deskUtilitiesCopy } from './copy/deskUtilities';
import { todayCardProposedCopy } from './copy/todayCard';
import { launchDockCopy } from './copy/launchDock';
import { privacyPolicyCopy } from './copy/privacyPolicy';
import { tradingCopy } from './copy/trading';
import { welcomeCopy } from './copy/welcome';
export { safetyCopy } from './copy/safety';

export const copy = {
  connect: {
    title: 'Connect wallet',
    idle: 'Connect to view your Solana address. Trading is not available for connected wallets.',
    opening: 'Opening your wallet…',
    cancelled: 'Connection cancelled.',
    wallet_not_found: 'No compatible wallet is installed.',
    timeout: 'The wallet did not respond. Try again.',
    wrong_cluster: 'Choose Solana mainnet in your wallet.',
    failed: 'Could not connect. Try again.',
    connected: 'Connected',
    disconnect: 'Disconnect',
    disconnectFailed: 'Could not remove the connection. Try again.',
  },
  welcome: {
    wordmark: 'Corso',
    subline: 'Your Solana wallet.',
    ctaPrimary: 'Continue with Email',
    ctaGoogle: 'Continue with Google',
    legal: 'By continuing you agree to our Terms and Privacy Policy.',
    legalTerms: 'Terms',
    legalPrivacy: 'Privacy Policy',
    legalPrefix: 'By continuing you agree to our ',
    legalAnd: ' and ',
    legalSuffix: '.',
    ...welcomeCopy,
  },
  quietMark: {
    line: 'A trading desk for everyday traders.',
    subLine: 'Read the market first. Then Wait or Buy.',
    getStarted: 'Get started',
    haveAccount: 'I already have an account',
    doorTitle: 'Welcome',
  },
  firstRun: {
    nameTitle: 'What should we call this?',
    nameHint: 'You can change this later.',
    nameA11y: 'Portfolio name',
    namePreview: ['Cash', 'Majors', 'Everything else'] as const,
    continue: 'Continue',
    skip: 'Skip for now',
    howTitle: 'How it works',
    howSub: 'Three simple parts',
    howRows: [
      { title: 'Cash', body: 'Start here. Dollars held as USDC' },
      { title: 'Majors', body: 'BTC · ETH · SOL you mean to keep' },
      {
        title: 'Decide before you sign',
        body: 'Swaps you make yourself: we explain, then you sign.',
      },
    ] as const,
    howFoot:
      'Memes are optional. Keep everything else small, not the main show.',
    fundTitle: 'Add cash to start',
    fundSub: 'Optional. You can explore first',
    fundCash: 'Cash',
    fundAdd: 'Add cash',
    fundExplore: 'I’ll explore first',
  },
  roots: {
    discoverTitle: 'Discover',
    discoverEmpty: "Discover isn't on yet.",
    discoverEmptyHint:
      'Fresh pairs and runners land here once discovery is switched on.',
    activityTitle: 'Activity',
    activityLead: 'Your swaps and transfers, newest first.',
    activityEmptyTitle: 'Nothing here yet',
    activityEmptyBody:
      'Your swaps and transfers will show up here. Receive or swap to get your first one.',
    activitySignedOutTitle: 'Sign in to see your activity',
    activitySignedOutBody:
      'Your swaps and transfers show up here once you are signed in.',
    /** Pull-to-refresh is the one retry path the error copy promises. */
    activityErrorHint: 'Pull down to try again.',
    accountTitle: 'Profile',
  },
  watchlist: {
    title: 'Watchlist',
    lead: 'Tokens you starred, with their latest verdict.',
    segmentDiscover: 'Discover',
    segmentWatchlist: 'Watchlist',
    emptyTitle: 'No tokens watched yet',
    emptyBody:
      'Star a token to track it here. Price and verdict update while you watch.',
    /** Shown while the on-device list is still being read. */
    loading: 'Reading your watchlist…',
    watch: 'Watch',
    watching: 'Watching',
    watchA11y: (symbol: string) => `Watch ${symbol}`,
    unwatchA11y: (symbol: string) => `Stop watching ${symbol}`,
    removeHint: 'Hold a row to stop watching it.',
    rowA11y: (symbol: string) => `${symbol}, hold to stop watching`,
    change24h: '24h',
    priceUnknownA11y: 'price not available',
    changeUnknownA11y: '24h change not available',
    /**
     * A starred token whose own name or symbol the store gate condemns
     * (`features/discovery/moderation.ts`). The row stays — it is the user's
     * own star and their money is in it — but it never prints the label. It
     * says withheld rather than "hidden" because nothing here is being kept
     * from the user: the mint is one tap away on token detail.
     */
    withheldSymbol: 'Withheld',
    withheldName: 'Name withheld',
  },
  diyLists: {
    reviewTitle: 'Your list',
    reading: 'Reading your lists…',
    noListBody: 'Name a list, then add tokens.',
    listEmpty: 'Nothing on this list.',
    pricesUnavailable: 'Prices didn’t load.',
    pricesOff: 'Prices are off.',
    notPriced: 'Not priced',
    waiting: 'Reading prices…',
    asOf: (clock: string) => `as of ${clock}`,
    unknownToken: 'Unknown token',
    diskError: 'Your lists didn’t load.',
    listsFull: 'This phone holds 8 lists.',
    listFull: 'This list holds 10 tokens.',
    invalidName: 'Name the list first.',
    invalidMint: 'Paste a token address.',
    newList: 'New list',
    rename: 'Rename',
    removeList: 'Remove list',
    addToken: 'Add token',
    removeToken: 'Remove',
    edit: 'Edit list',
    done: 'Done',
    addToList: 'Add to list',
    selectList: 'Show this list',
    namePlaceholder: 'List name',
    mintPlaceholder: 'Token address',
    onList: (name: string) => `On ${name}`,
    notOnList: (name: string) => `Not on ${name}`,
  },
  v1: {
    whatsMoving: "What's moving?",
    /**
     * Post-trade funding line: the Fund pill on a signed swap card and the
     * not-enough-SOL outcome body. Funding really is the next step there.
     */
    addMoneyThenAsk: 'Add money, then ask.',
    askThenAddMoney: 'Ask if a token is safe. Add money for prices and swaps.',
    whatIsTrending: 'What is trending?',
    continueApple: 'Continue with Apple',
    continueEmail: 'Continue with email',
    askAnything: 'Ask anything...',
    fund: 'Fund',
    send: 'Send',
    review: 'Review',
    confirmSwap: 'Confirm swap',
    confirmSend: 'Confirm send',
    confirmRoutine: 'Confirm routine',
    youHoldThis: 'you hold this',
    back: 'Back',
    done: 'Done',
    donePeriod: 'Done.',
    youGot: (amount: string, symbol: string) => `You got ${amount} ${symbol}.`,
    notEnoughSol: 'Not enough SOL',
    nothingMoved: 'Nothing moved. Your money is where it was.',
    priceMoved: 'Price moved',
    thatDidntGoThrough: "That didn't go through",
    activity: 'Activity',
    settings: 'Settings',
    whatMoved: 'What moved',
    fee: 'Fee',
    addMoney: 'Add money',
    fromWalletYouOwn: 'From a wallet you own',
    receive: 'Receive',
    solanaOnlyGone: 'Solana only. Anything else is gone.',
    copy: 'Copy',
    sending: 'Sending',
    youCanClose: 'This takes a few seconds.',
    seeOnSolscan: 'See it on Solscan',
    shareThis: 'Share this',
    pickAToken: 'Pick a token',
    searchOrPaste: 'Search or paste address',
    paste: 'Paste',
    searching: 'Searching…',
    searchNothing: 'Nothing to show for that.',
    searchFailed: "Search didn't load.",
    cancel: 'Cancel',
    continue: 'Continue',
    dismissSheet: (title: string) => `Dismiss ${title} sheet`,
  },
  talk: {
    pageA11y: (index: number, count: number) => `Page ${index} of ${count}`,
  },
  a11y: {
    pageA11y: (n: number, total: number) => `Page ${n} of ${total}`,
  },
  live: {
    askMeAnything: 'Ask me anything',
    /** Threads panel — Home's top-left history button (a side panel, not a route). */
    threadsTitle: 'Threads',
    threadsA11y: 'Threads',
    threadsEmpty: 'No threads yet.',
    threadsEmptyHint: 'Ask something and it lands here.',
    threadsNew: 'New thread',
    threadsSearch: 'Search',
    threadsSearchA11y: 'Search threads',
    threadsNoMatch: 'No threads match.',
    /** The date line under a thread's title. */
    threadsToday: 'Today',
    threadsYesterday: 'Yesterday',
    threadsWeekdays: [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ],
    threadsShortDate: (monthIndex: number, day: number) =>
      `${
        [
          'Jan',
          'Feb',
          'Mar',
          'Apr',
          'May',
          'Jun',
          'Jul',
          'Aug',
          'Sep',
          'Oct',
          'Nov',
          'Dec',
        ][monthIndex] ?? ''
      } ${day}`.trim(),
    threadsPinned: 'Pinned',
    threadsRename: 'Rename',
    threadsPin: 'Pin',
    threadsUnpin: 'Unpin',
    threadsDelete: 'Delete',
    threadsDeleted: 'Thread deleted',
    threadsUndo: 'Undo',
    threadsMenuDismiss: 'Close thread menu',
    threadsNameA11y: 'Thread name',
    threadsRowHint: 'Long-press to rename, pin or delete.',
    /** An auto-title that leads with the token: `CATE · Is it safe to buy?`. */
    threadsTokenTitle: (symbol: string, question: string) =>
      `${symbol} · ${question}`,
    /** A thread whose swap was signed: `Bought · 0.5 SOL → CATE`. */
    threadsBought: (trade: string) => `Bought · ${trade}`,
    /** Wallet pill (Home top-right) — opens Money. */
    walletPillA11y: (balance: string) => `Balance, ${balance}. Open Money`,
    quoteLive: 'Quote live',
    needs: 'Needs review',
    signed: 'Done',
    stale: 'Stale',
    coachQuote: (pay: string, get: string) =>
      `${pay} → ${get}. Review when you're ready.`,
    changeSize: 'Change size',
    coachReady: "Review when you're ready.",
    coachDone: (amount: string, symbol: string) =>
      `Done. ${amount} ${symbol} is in your bag.`,
    donePair: (pay: string, get: string) => `${pay} → ${get}`,
    coachExpired:
      'This expired when the app closed. Ask again to review it fresh.',
    moving: 'Moving',
    reviewFloor: 'Nothing moves until you confirm.',
    listening: 'listening',
    liveCount: (count: number) => (count === 1 ? '1 live' : `${count} live`),
    whyIsDown: (symbol: string) => `Why is ${symbol} down?`,
    whyIsUp: (symbol: string) => `Why is ${symbol} up?`,
    swapTo: (amount: string, from: string, to: string) =>
      `Swap ${amount} ${from} to ${to}`,
    voiceA11y: 'Say it',
    voiceStopA11y: 'Stop listening',
    cardA11y: (pair: string, status: string) => `${pair}, ${status}`,
    previousCard: 'Previous',
    thumbNeedsSign: 'waiting on you',
    thumbSigned: 'filled',
    gridA11y: (count: number) => `${count} live, grid`,
    nextCard: 'Next',
  },
  vitals: {
    live: (seconds: number) => (seconds < 1 ? 'live' : `live ${seconds}s`),
    paused: 'paused. Tap to refresh',
    checking: 'checking…',
    notAvailable: 'not available',
    verified: 'verified',
    age: (text: string) => `age ${text}`,
    ageUnknown: 'age unknown',
    marketCapFdv: (mc: string, fdv: string) => `MC ${mc} / FDV ${fdv}`,
    liquidity: 'Liquidity',
    volume24h: 'Volume 24h',
    buySell: 'Buy/Sell',
    holders: 'Holders',
    top10: (pct: string) => `Top-10 hold ${pct}`,
    top1: (pct: string) => `Top-1 ${pct}`,
    tag: (tag: string, count: number) => (count > 1 ? `${tag} ×${count}` : tag),
    safety: 'SAFETY',
    per: (sources: string) => `per ${sources}`,
    unreconciled: 'sources disagree, both shown',
    scoreNormalised: (score: number) => `RugCheck score ${score}`,
    informationNotAdvice: 'This is information, not advice.',
    factsPer: (label: string) => `Facts ${label}.`,
    details: 'Details',
    reviewSwap: 'Review a swap →',
    retry: 'Retry',
    couldNotLoad: (query: string) => `Couldn't load vitals for ${query}`,
    which: (query: string) => `Which ${query}?`,
    picked: (symbol: string) => `Here's what the sources say about ${symbol}.`,
    choiceLine: (symbol: string, mintTail: string) =>
      `${symbol} · …${mintTail}`,
    choiceTitle: (symbol: string, name: string) => `${symbol} · ${name}`,
    chartUnavailable: 'No candles yet',
    chartA11y: (symbol: string, timeframe: string) =>
      `${symbol} candlestick chart, ${timeframe}`,
    timeframeA11y: (timeframe: string) => `Timeframe ${timeframe}`,
    cached: 'cached',
    ledger: {
      title: 'Review a swap',
      preview: 'read-only preview. The real quote runs in Review',
      youPay: 'You pay',
      youReceive: 'You receive',
      estimate: (text: string) => `~${text} (est.)`,
      priceImpact: 'Price impact',
      shownAtReview: 'shown at review',
      networkAndFee: 'Network + fee',
    },
    cardA11y: (symbol: string, verdict: string) =>
      `${symbol} vitals, safety ${verdict}`,
  },
  chartEdge: {
    title: 'STRUCTURE',
    timeframeNote: (timeframe: string) => `${timeframe} readings`,
    confluence: 'Confluence',
    band: {
      strong_bear: 'Strong bear',
      bear: 'Bear',
      neutral: 'Neutral',
      bull: 'Bull',
      strong_bull: 'Strong bull',
    } as const,
    confluenceA11y: (band: string, score: number) =>
      `Confluence ${band}, ${score} of 100`,
    structure: (label: 'CHoCH' | 'CHoCH+' | 'BOS', direction: 'bull' | 'bear') =>
      label === 'BOS'
        ? 'Trend continued'
        : direction === 'bull'
          ? 'Trend turned up'
          : 'Trend turned down',
    structureLegend: 'Structure',
    structureAt: (price: string) => `at ${price}`,
    noStructure: 'No structure mark in this window',
    /** The nearest active zone to the last close. */
    demandBlock: 'Demand block',
    supplyBlock: 'Selling zone',
    fairValueGap: 'Fair-value gap',
    zoneRange: (bottom: string, top: string) => `${bottom} – ${top}`,
    noZone: 'No active zone in this window',
    /** Honest states — the pill is real, the reading is not there. */
    off: 'Structure readings are off',
    loading: 'Reading structure…',
    unavailable: 'Structure readings not available right now',
    /** A close we will not score. A read of the last bar, not a forecast. */
    unknownStale: 'Last close is too old to read.',
    unknownUnreadable: 'No reading for this day.',
    notComputed: (timeframe: string) => `No ${timeframe} readings yet`,
    noData: (timeframe: string) => `Not enough ${timeframe} bars for a reading`,
    thin: (bars: number) =>
      bars === 1 ? 'Thin data: 1 bar' : `Thin data: ${bars} bars`,
    /** 15s is the fast price line; overlays begin at the first signal bar. */
    lineOnly: '15s is a fast price line. Structure begins at 1m.',
    closedBars: 'closed bars',
    live: 'live',
    openTerminal: 'Open terminal',
    openTerminalA11y: (symbol: string) =>
      `Open the candlestick terminal for ${symbol}`,
    /** The fullscreen mode change: the line is held while Vela paints. */
    openingTerminal: 'Opening the terminal…',
  },
  majorDetail: {
    eyebrowPosition: 'Your position',
    eyebrowPrice: 'Price',
    priceUnavailable: 'Price unavailable',
    holdingsUnavailable: "Couldn't read what you hold right now.",
    loading: 'Loading…',
    priceStale: 'Price may be out of date',
    statShare: 'Share of total',
    wrapperCbBtc:
      'cbBTC is Coinbase Wrapped BTC on Solana, not native Bitcoin.',
    wrapperEthPortal:
      'ETH here is Ether bridged to Solana by Wormhole Portal, not native Ether.',
    wrapperZecOmniBridge:
      'ZEC here is Zcash bridged to Solana by Omni Bridge, not native Zcash.',
    ageUnderMinuteAgo: 'under a minute ago',
    ageMinutesAgo: (minutes: number) =>
      minutes === 1 ? '1 minute ago' : `${minutes} minutes ago`,
    ageHoursAgo: (hours: number) =>
      hours === 1 ? '1 hour ago' : `${hours} hours ago`,
    bookUnavailable: "Couldn't read your balance.",
    explain: 'Explain',
    swapsUnavailable: 'Swaps are unavailable.',
    chartQuiet: 'No price history for this span.',
    fullChart: 'Full chart',
    spanDay: 'day',
    spanDays: 'days',
    spanHour: 'hour',
    spanHours: 'hours',
    window24h: '24h',
  },
  sellReview: {
    afterPriced: (
      quantity: string,
      symbol: string,
      value: string,
      receive: string,
      aboutQuantity = false,
    ) =>
      aboutQuantity
        ? `After this sale: about ${quantity} ${symbol} left, about ${value} ${receive} at this quote's rate.`
        : `After this sale: ${quantity} ${symbol} left, about ${value} ${receive} at this quote's rate.`,
    afterUnpriced: (
      quantity: string,
      symbol: string,
      aboutQuantity = false,
    ) =>
      aboutQuantity
        ? `After this sale: about ${quantity} ${symbol} left. Not priced on this quote.`
        : `After this sale: ${quantity} ${symbol} left. Not priced on this quote.`,
    afterUnknown: 'After this sale: amount left not shown.',
    portionLabel: (pct: number) => (pct === 100 ? copy.swap.max : `${pct}%`),
    portionA11y: (pct: number, symbol: string) =>
      pct === 100 ? `Sell max ${symbol}` : `Sell ${pct}% of ${symbol}`,
  },
  homeBook: {
    defaultName: 'My money',
    eyebrow: 'Total value',
    eyebrowPartial: 'Total value · partial',
    cash: 'Cash',
    majors: 'Majors',
    sleeve: 'Everything else',
    venue: 'on Solana',
    /** Reading: a placeholder, never `$0.00`. */
    placeholder: '…',
    /** Held, but no price could be read: unknown, never `$0`. */
    notPriced: 'Not priced',
    unavailable: "Couldn't read your balance.",
    newBook: 'Nothing held yet.',
    emptyCash: 'No cash yet',
    emptyMajors: 'No majors yet',
    emptySleeve: 'Nothing else yet',
    assets: (count: number) => (count === 1 ? '1 asset' : `${count} assets`),
    asOf: (age: string) => `As of ${age} ago`,
    ageUnderMinute: 'under a minute',
    ageMinutes: (minutes: number) =>
      minutes === 1 ? '1 minute' : `${minutes} minutes`,
    ageHours: (hours: number) => (hours === 1 ? '1 hour' : `${hours} hours`),
  },
  sleeve: {
    /** Nav title. Home keeps the short label `homeBook.sleeve`. */
    title: 'Everything else',
    valueEyebrow: 'Everything else value',
    valuePartial: 'Everything else value · partial',
    keepSmall: 'Keep them small.',
    findToken: 'Find a token',
    holdings: 'Holdings',
  },
  askSheet: {
    placeholder: 'Ask anything\u2026',
    send: 'Send',
    close: 'Close',
    bookSplit: 'How is my money split?',
    /**
     * The Looked at line, joined with ` · ` from the sources the answer read.
     * The price slot is the quote's own clock.
     */
    lookedAtBook: (clock: string) => `Holdings at ${clock}`,
    lookedAtPrices: (clock: string) => `as of ${clock}`,
    /** Fact card rows. */
    holding: 'Holding',
    value: 'Value',
    shareOfBook: 'Share of total',
    liquidity: 'Liquidity',
    holders: 'Holders',
    verified: 'Verified',
    age: 'Age',
    safety: 'Safety',
    confluenceFrom: 'From',
    confluenceRestsOn: 'Rests on',
    confluenceBasis: (
      timeframe: string,
      clock: string,
      notes: readonly string[],
    ) =>
      [`Closed ${timeframe} bars to ${clock}. Not a forecast.`, ...notes].join(
        ' · ',
      ),
    confluenceUnknown: 'Unknown',
    confluenceReasonLabel: 'Reason',
    confluenceValue: (band: string, score: number) =>
      `${band} · ${score} (50 is balanced)`,
    confluenceReason: {
      stale: 'No recent closed bar',
      unpriced: 'Some bars have no price',
      unreadable: 'Could not read it',
    } as const,
    contributor: {
      market_structure: 'Structure',
      order_block: 'Order block',
      fvg: 'Fair-value gap',
      liquidity: 'Liquidity levels',
      divergence: 'RSI',
      premium_discount: 'Range',
    } as const,
    yes: 'Yes',
    no: 'No',
    notKnown: 'Not known',
    open: 'Open',
    trade: (from: string, to: string) => `${from} for ${to}`,
    sell: 'Sell',
    for: 'For',
    requote: 'You’ll see a fresh price on Review.',
    openReview: 'Open Review',
    wait: 'Wait',
    swapsOff: 'Swaps are off right now.',
    unverified: 'Unverified',
    /** Can't answer yet (05-a): what is missing, and no guess. */
    cantYet: (thing: string) =>
      `Corso doesn't keep ${thing} yet, so it can't add it up.`,
    cantYetFees: 'fees from past swaps',
    /** Every can't-answer path except a card that states a past cost. */
    cantAnswer: "Corso can't answer that here.",
    feePolicyTitle: 'Fees',
    networkFeeInSol: 'Separate, in SOL',
    addCash: 'Add cash',
  },
  receipt: {
    chainUnavailable: 'Record unavailable. Trying again.',
    quotedAmount: (value: string) => `${value} · quoted`,
  },
  tokenDetail: {
    chain: 'Solana',
    safetyOff: 'Safety readings are off',
    safetyChecking: 'Checking safety…',
    safetyUnavailable: 'Safety readings not available right now',
    safetyA11y: (verdict: string, sources: string | null) =>
      sources ? `Safety ${verdict}, ${sources}` : `Safety ${verdict}`,
    reviewSwap: 'Review swap',
    evidence: 'Evidence',
    checks: (count: number) => (count === 1 ? '1 check' : `${count} checks`),
    moverA11y: (change: string) => `Change ${change}`,
    priceUnknown: 'Price not available',
    withheldTitle: 'Name withheld',
    withheldSymbol: 'Withheld',
    noSwapDoor:
      'No swap for this token yet. The pair is unverified or too thin, so Corso is holding it back rather than guessing.',
    sellNeedsCorsoWallet:
      'Selling other tokens needs a Corso wallet. This wallet can still buy, send and receive.',
    /**
     * The holdings read was made and did not come back. Never a zero and never
     * a silent missing door: "we could not read this" is a different claim from
     * "you hold none of this", and only one of them is true here.
     */
    sellHoldingsUnavailable:
      "Couldn't read what you hold right now, so Sell is held back. Pull to retry.",
    /** The v1 swap route refuses Token-2022 (`assertSwapSemantics.ts`). */
    sellTokenNotSupported:
      'Corso cannot sell Token-2022 tokens yet, so this one has no Sell door.',
    sellHoldingNotRecognised: "Sell isn't available for this token.",
  },
  fullChart: {
    title: 'Full chart',
    /** Pill label → spoken name; unknown labels fall back to the label itself. */
    timeframeName: (timeframe: string): string =>
      ({
        '1m': '1 minute',
        '5m': '5 minutes',
        '1H': '1 hour',
        '4H': '4 hours',
        '1D': '1 day',
      })[timeframe] ?? timeframe,
    /**
     * Spoken width of one shipped bar. The server's range map can hand a pill
     * wider bars than its name (`1H` → 4-hour bars), so coverage lines name the
     * bar actually drawn, never the pill.
     */
    barName: (barMs: number): string => {
      const minute = 60_000;
      const hour = 60 * minute;
      const day = 24 * hour;
      if (barMs >= day && barMs % day === 0) {
        const n = barMs / day;
        return n === 1 ? '1 day' : `${n} days`;
      }
      if (barMs >= hour && barMs % hour === 0) {
        const n = barMs / hour;
        return n === 1 ? '1 hour' : `${n} hours`;
      }
      const n = Math.max(1, Math.round(barMs / minute));
      return n === 1 ? '1 minute' : `${n} minutes`;
    },
    /** The server had fewer than two bars at this timeframe — say so, suggest wider. */
    noData: (timeframeName: string) =>
      `Not enough ${timeframeName} bars for this token yet. Try a wider timeframe.`,
    /** Honest sub-hour coverage lines. Counts are real bars; nothing is drawn in. */
    coverage: {
      thin: (bars: number, timeframeName: string) =>
        bars === 1
          ? `Only 1 ${timeframeName} bar so far. Short history, thin activity.`
          : `Only ${bars} ${timeframeName} bars so far. Short history, thin activity.`,
      gaps: (missing: number) =>
        missing === 1
          ? '1 interval had no activity and is not drawn.'
          : `${missing} intervals had no activity and are not drawn.`,
      quiet: (intervals: number, timeframeName: string) =>
        `No closed bar in the last ${intervals} × ${timeframeName}.`,
    },
    open: 'Open full chart',
    openA11y: (symbol: string) => `Open the full chart for ${symbol}`,
    loading: 'Loading chart…',
    unavailable: 'Chart not available right now',
    /** Plan 09a honesty state: the pill is real, the compute is not there yet. */
    notComputed: (timeframe: string) =>
      `Readings are not available at ${timeframe} yet. Try 1H.`,
    disabled: 'Charts are not available',
    invalidTitle: 'No chart to show',
    invalidBody: 'This link does not name a token.',
    timeframeA11y: (timeframe: string) => `Timeframe ${timeframe}`,
    confluence: (score: number) => `Confluence ${score}`,
    band: {
      strong_bear: 'leaning down, strongly',
      bear: 'leaning down',
      neutral: 'balanced',
      bull: 'leaning up',
      strong_bull: 'leaning up, strongly',
    } as const,
    degraded: (count: number) =>
      count === 1
        ? '1 reading unavailable this bar'
        : `${count} readings unavailable this bar`,
    asOf: (text: string) => `last closed bar ${text}`,
    source: 'Readings computed by Corso.',
    informationNotAdvice: 'This is information, not advice.',
    chartA11y: (symbol: string, timeframe: string) =>
      `${symbol} full chart, ${timeframe}`,
    selected: (price: string) => `Selected ${price}`,
    attribution: 'Chart rendered with Vela',
    retry: 'Retry',
  },
  v1Onboarding: {
    bringWalletTitle: 'Bring your wallet',
    bringWalletBody:
      "Your words stay on this phone. They're never sent anywhere.",
    bringWalletPlaceholder: 'Your 12 or 24 words',
    bringWalletCounter: (filled: number, total: number) =>
      `${filled} of ${total}`,
    bringWalletSecure:
      'Secure entry. Screenshot-blocked, never logged, never leaves the device.',
    bringWalletCta: 'Add it',
    bringWalletWrongCount: (count: number) =>
      `That's ${count} words. It should be 12 or 24.`,

    beforeYouPasteTitle: 'Before you paste',
    beforeYouPasteBody: 'Three things. Read them.',
    beforeYouPasteCheckNobodyAsked:
      'Nobody asked me to set this up. Not support, not a friend, nobody on a call.',
    beforeYouPasteCheckMyWords:
      'Nobody gave me these words. They are mine and this is not the first time I have seen them.',
    beforeYouPasteCheckNoWayBack:
      'I know that anyone with these words can take everything, and that Corso can never get it back.',
    beforeYouPasteWait: (seconds: number) => `Wait ${seconds}s`,

    oneSecond: 'One second.',

    useBiometric: (label: string) => `Use ${label}`,
    everyTimeMoneyMoves: (label: string) =>
      `${label} unlocks the app. It never signs.`,
    turnOnBiometric: (label: string) => `Turn on ${label}`,
    usePasscode: 'Use a passcode',
    notNow: 'Not now',

    passcodeSetTitle: 'Set a passcode',
    passcodeSetBody: 'Six digits.',
    passcodeConfirmTitle: 'Enter it again.',
    passcodeMismatch: "Those didn't match. Start again.",
    passcodeCounter: (filled: number, total: number) => `${filled} of ${total}`,
    passcodeDelete: 'Delete',
    passcodeStartOver: 'Start over',
  },
  /** Security sheet + the two reveal / sign-out paths. */
  v1Security: {
    title: 'Security',
    on: 'On',
    off: 'Off',
    changePasscode: 'Change passcode',
    yourWords: 'Your words',
    yourKeys: 'Your keys',

    yourWordsBody: 'Anyone with these can move your money.',
    hidesIn: (clock: string) => `Hides in ${clock}`,
    showAgain: 'Show again',
    screenshotTitle: 'You just took a screenshot.',
    screenshotBody:
      'Photos get backed up. Anyone who reaches that backup can take your money. Delete it.',
    screenshotCta: "I'll delete it",

    safeReveal: {
      /** Footnote under the reveal row on the Security sheet. */
      annotation:
        'Embedded-wallet accounts see Export wallet here instead of Reveal recovery phrase — the two doors are different.',
      importDoor: {
        eyebrow: 'RECOVERY · IMPORTED WALLET',
        entryLabel: 'Reveal recovery phrase',
        entryHint: (biometricLabel: string) => `${biometricLabel} required`,
        warningTitle: 'Before you reveal',
        warningLines: [
          'Corso will never ask for these words, not in chat, not in support, not ever.',
          'Anyone who sees these words controls the funds. Treat them like cash.',
          'Screenshots are blocked on the next screen. Write the words down on paper.',
        ],
        warningCta: 'I understand',
        gateTitle: 'Recovery phrase',
        gateBody: (biometricLabel: string) =>
          `${biometricLabel} unlocks the words. They stay on this device.`,
        gateCta: (biometricLabel: string) => `Reveal with ${biometricLabel}`,
        /** Same gate, drawn when the app lock is the passcode. */
        gateBodyPasscode:
          'Your passcode unlocks the words. They stay on this device.',
        gateCtaPasscode: 'Reveal with passcode',
        claim:
          'Your keys never leave this device · not even Corso can recover them',
        captureChrome: 'Screenshots blocked',
        hiddenTitle: 'Hidden again',
        hiddenBody:
          'If you lose the words and this device, no one can recover the wallet, including Corso.',
      },
      exportDoor: {
        eyebrow: 'EMBEDDED WALLET · OUR SIGN-IN PROVIDER',
        entryLabel: 'Export wallet',
        title: 'Export wallet',
        intro:
          'This account uses an embedded wallet secured with our sign-in provider. Exporting assembles the full key so you can move it into a self-custody wallet.',
        stepLabel: 'What happens next',
        step: 'Our sign-in provider’s secure page assembles the full key.',
        warning: 'Once exported, anyone who has the key controls the funds.',
        cta: 'Continue to export',
      },
    },

    signOutTitle: 'Sign out?',
    signOutBody:
      'Signing out clears your threads and some settings. Sign back in the same way to get back in.',
    signOutBodyImportResting2a:
      'Your recovery phrase stays saved on this phone. To get back in, enter it again from your own backup.',
    // Existing strict body for imported and unknown sessions.
    signOutBodyImport:
      "Your words are the only way back in. Corso doesn't have a copy.",
    // Typed ceremony for imported and unknown session types.
    signOutConfirmPhrase: 'SIGN OUT',
    signOutConfirmPlaceholder: 'Type SIGN OUT',
    signOutCta: 'Sign out',
  },
  signin: {
    tryEmailInstead: 'Try email instead',
    title: 'Sign in',
    emailHelper: "We'll email you a 6-digit code.",
    emailPlaceholder: 'you@email.com',
    codePlaceholder: '123456',
    emailInput: 'Email',
    codeInput: 'Sign-in code',
    cta: 'Continue',
    verify: 'Verify',
    workingSuffix: ', working',
    codeTitle: 'Enter your code',
    codeHelper: (email: string) =>
      `Sent to ${email}. The code expires in 10 minutes.`,
    codeResend: 'Send a new code',
    errorBadCode: "That code didn't match. Check the digits and try again.",
    errorExpired: 'That code expired. Send a new one.',
    errorNetwork:
      "We couldn't reach the sign-in service. Check your connection and try again.",
    errorOAuthNetwork:
      "Sign-in couldn't connect. Check your connection and try again or use email.",
    errorOAuthUnavailable:
      "We couldn't complete sign-in. Try again or use email.",
    errorProviderUnavailable:
      "This sign-in option isn't available. Try email instead.",
    errorRateLimited: 'Too many attempts. Wait a moment and try again.',
    errorUnknown: "We couldn't complete sign-in. Try again.",
    errorProvision: "We couldn't finish setting up your wallet. Try again.",
    errorRetry: 'Try again',
    signOut: 'Sign out',
    signingOut: 'Signing out…',
    errorAlreadyIn: "You're already signed in. Finishing wallet setup…",
  },
  provision: {
    headline: 'Setting up your wallet',
    takingLong: 'This is taking longer than usual.',
  },
  lockSetup: {
    body: (label: string) =>
      `Use ${label} or your device passcode to open Corso and approve transactions.`,
  },
  lock: {
    prompt: 'Unlock Corso',
    unlockWith: (label: string) => `Unlock with ${label}`,
    ctaSecondary: 'Use a passcode instead',
    passcodeHelper:
      "6 digits. You'll need it to open Corso and to reveal your recovery phrase.",
    errorStillLocked: 'Corso is still locked. Try again.',
    errorDeviceAuth: 'Could not verify your device authentication.',
    wrongPasscode: "That passcode isn't right. Try again.",
    tooManyTries: (wait: string) => `Too many tries. Try again in ${wait}.`,
    tooManyTriesBody: 'Nothing was erased. The wait ends on its own.',
    tooManyTriesA11y: (wait: string) =>
      `Passcode entry paused. Try again in ${wait}.`,
    waitMinute: '1 minute',
    waitMinutes: (n: number) => `${n} minutes`,
    waitHour: '1 hour',
    waitHours: (n: number) => `${n} hours`,
    passcodeTitle: 'Enter your passcode',
    ctaSetUpUnlock: 'Set up unlock',
    /**
     * The one line explaining why the passcode field cannot help here. No
     * blame, no jargon, and no suggestion that signing out is the answer.
     */
    noUnlockMethod:
      "This phone doesn't have an unlock method saved yet. Set one up to get back in.",
  },
  ask: {
    ...composerCopy,
    /** Ask itself is down. Reassure about the money, which is the real worry. */
    unavailable: "Ask isn't working right now. Your money is fine.",
    /**
     * FLAG_ASK off (fail-closed on public config). Not a fault and not a
     * promise: the composer says it is off and that the money is fine.
     */
    disabledPlaceholder: 'Ask is off right now',
    disabledNotice: 'Ask is switched off. Your money is fine.',
    disabledA11y: 'Ask is off',
    placeholder: 'Ask about any token…',
    speak: 'Speak',
    sendA11y: 'Send',
    dictateA11y: 'Dictate',
    attachA11y: 'Attach',
    /** Model chip: `Auto ▸`. Shows only Auto + connected models + Connect. */
    modelAuto: 'Auto',
    modelChipA11y: 'Choose a model',
    showTabsA11y: 'Show the tab bar',
    modelConnect: 'Connect your AI',
    modelAutoCaption: 'Corso answers',
    modelConnectCaption: 'ChatGPT, Grok or Claude',
    modelGroupConnected: (brand: string) => `${brand} \u00b7 connected`,
    /**
     * A connected row is where the next question goes. The row is a radio and
     * carries its own checked state, so the label is the name and the state
     * the pool would actually meet, and nothing else.
     */
    modelConnectedA11y: (name: string, status: string) => `${name}, ${status}`,
    /**
     * The picked model did not answer, so Corso did
     * (`features/ask/connectedBrainAsk.ts`). One line, above the answer,
     * naming the model and the reason: a person who picked their own model
     * and quietly got a different answer would have been misled.
     */
    modelRestingNote: (name: string) =>
      `${name} is resting for a few minutes, so Corso answered this one.`,
    modelNeedsSignInNote: (name: string) =>
      `${name} needs a new sign in, so Corso answered this one.`,
    modelBlockedNote: (name: string) =>
      `${name} is not included in that plan, so Corso answered this one.`,
    modelUnreachableNote: (name: string) =>
      `Couldn't reach ${name} just now, so Corso answered this one.`,
    /** Attribution for the separate, non-interactive explanation block. */
    modelTakeLabel: (brand: string) => `Your ${brand} says…`,
    /** A connected model answered, but not the one that was picked. */
    modelAnsweredInstead: (picked: string, answered: string) =>
      `${picked} could not answer, so ${answered} did.`,
    /** Attach menu rows — never wallet actions. */
    attachPaste: 'Paste address',
    attachPasteCaption: 'A mint or a wallet from your clipboard',
    attachNothingToPaste: 'Nothing to paste.',
    timeout: 'That took too long. Try again?',
    rateLimited: 'Too many at once. Give it a second.',
    /** Corso could not read the balance. This is a fault and says so. */
    moneyUnavailable: "Can't see your money right now. Not your fault.",
    chooseMint: (symbol: string) => `Choose the ${symbol} mint.`,
    sellWhich: 'Which one do you want to sell?',
    sellWhichOne: (symbol: string) => `Sell your ${symbol}?`,
    /** More positions than the reply can draw doors for. Still never a pick. */
    sellWhichMore: 'Which one do you want to sell? Tap one, or name it.',
    /** A sell door under the reply. The label is the door, not a question. */
    sellDoorLabel: (symbol: string) => `Sell ${symbol}`,
    questionNeedsFunds:
      'That question needs a funded wallet because it asks for a quote or swap.',
    /** Unknown shapes fail toward requiring context, without claiming all Ask is gated. */
    questionNeedsWalletContext:
      "That question needs wallet context, so I can't answer it before the wallet is funded.",
    emptyDiscovery:
      "The Moving list up top is what's live right now. Add money and I can put you in it.",
    discoveryOff:
      "Discover isn't on yet. Fresh pairs and runners land here once it's switched on.",
    routineNotSetUp: 'One swap at a time for now.',
    insufficientAmount: (requested: string, balance: string, symbol: string) =>
      `You asked to swap ${requested} ${symbol}. You have ${balance} ${symbol}.`,
    solReserve: (reserve: string) =>
      `Leaves ${reserve} SOL for network fees and token account rent.`,
  },
  moving: {
    label: 'Moving',
    lastKnownLabel: 'Moving · last known',
    context: (clock: string) => `24h change · as of ${clock}`,
    /**
     * Screen-reader line for one row. A bare "+2.4%" read aloud after a symbol
     * and a price is three unattached facts; this makes it one sentence.
     * No merit word, no direction word, no verb — it states the three fields.
     */
    rowLabel: (symbol: string, price: string, change: string) =>
      `${symbol}, ${price}, ${change} over 24 hours`,
    attribution: 'via Jupiter Tokens API V2',
    header: (label: string, attribution: string) => `${label} · ${attribution}`,
    threadEmpty: "The Moving list isn't available right now.",
  },
  home: {
    balancePlaceholder: 'Not available',
    today: (amount: string) => `${amount} today`,
    balanceLoading: 'Loading balance…',
    balanceError: "Couldn't load balance. Pull to retry.",
    usdcBalanceError: "Couldn't load USDC. Pull to retry.",
    balanceUnavailableRetryA11y: 'Balance unavailable. Double tap to retry.',
    showingLastKnownAsOf: (clock: string) =>
      `Showing last known amounts · as of ${clock}`,
    balanceLoadingA11y: 'Loading balance',
    changeSkeletonNoun: 'change',
    balanceSkeletonNoun: 'balance',
    unpricedCount: (count: number) => `+${count} unpriced`,
    totalBalanceWithChange: (amount: string, change: string) =>
      `Total balance ${amount}, change ${change} in the last 24 hours`,
    totalBalance: (amount: string) => `Total balance ${amount}`,
    totalBalanceWithUnpriced: (amount: string, count: number) =>
      `Total balance ${amount}, plus ${count} assets without a price. Change unavailable.`,
    balanceFiatUnavailable: (amount: string) =>
      `Balance ${amount}. Fiat total unavailable.`,
    assetSol: 'SOL',
    assetUsdc: 'USDC',
    more: 'More',
    moreBuy: 'Buy',
    moreScan: 'Scan',
    moreCluster: 'Cluster',
    moreScanStub: "Scan isn't available yet.",
    moreClusterStub: 'Change cluster in Profile → Network.',
    ...homeCopy,
  },
  profile: {
    title: 'Profile',
    wallet: 'Wallet',
    securityStub: 'Security settings arrive next.',
    securityTitle: 'Security',
    securityChangePasscode: 'Change passcode',
    securitySigningCheck: 'Wallet signing check',
    securityMfaNotEnrolled: 'Not set up',
    securityMfaPasskey: 'Passkey',
    securityMfaTotp: 'Authenticator app',
    securityMfaSms: 'Text message',
    securityMfaBoth: 'Passkey and authenticator app',
    securityMfaMechanism:
      'Corso will ask for this before your wallet signs anything.',
    securityMfaPasskeyBody:
      'Use your device passkey for a quick signing check.',
    securityMfaTotpBody:
      'Use a code from an authenticator app as a second signing check.',
    securityMfaEnrolled: 'Enrolled',
    securityMfaSetUpPasskey: 'Set up passkey',
    securityMfaSetUpTotp: 'Set up authenticator app',
    securityMfaPasskeyUnavailable:
      'Passkey setup is not available in this build configuration.',
    securityMfaWrongWallet:
      'Wallet signing checks are available for the embedded wallet only.',
    securityMfaAccountLimit:
      'This protects wallet signing, not sign-in. Someone who controls your email or Google account may still be able to reset your sign-in.',
    securityMfaRecovery:
      'If you lose a passkey device, use an authenticator app you enrolled here. If you have no second method, wallet recovery still depends on the account you use to sign in.',
    securityMfaFailed: "We couldn't finish setting that up. Try again.",
    securityMfaOfferTitle: 'Protect wallet signing',
    securityMfaOfferCta: 'Set it up',
    securityWalletRecovery: 'Wallet recovery',
    notificationsTitle: 'Notifications',
    notificationsLoadFailed: "Couldn't load notifications.",
    notificationsEmpty: "You're all caught up",
    networkTitle: 'Network',
    selectCluster: 'Select cluster',
    preferencesTitle: 'Preferences',
    preferencesCurrency: 'Currency',
    preferencesHideBalances: 'Hide balances',
    preferencesBalanceHidden: 'Balance hidden',
    aboutVersion: 'Version',
    valueUnavailable: 'Not available',
    exportKey: 'Export private key',
    aboutSection: 'About & legal',
    aboutSupport: 'Support',
    aboutPrivacy: 'Privacy Policy',
    aboutTerms: 'Terms of Service',
    aboutDelete: 'Delete account & data',
    aboutDisclosures: 'Required disclosures',
    disclosuresTitle: 'Required disclosures',
    disclosuresLoading: 'Loading…',
    disclosuresUnavailable:
      'Required disclosures are not available. Check your connection and try again.',
    deleteEverything: 'Delete everything',
    deleteEverythingBody:
      'Move your money first. This permanently deletes your Corso account. A wallet made by signing in goes with it, and signing in again gives you a new one. A recovery phrase you imported is erased from this phone, and only your own backup can bring that wallet back. Money left behind stays on Solana, but you may never reach it again.',
    deleteEverythingConfirm: 'Type DELETE to confirm',
    deleteEverythingError: 'Account deletion failed. Try again.',
    deleteEverythingLocalIncomplete:
      "Your account is deleted. Some data couldn't be removed from this phone yet.",
    removeFromPhone: {
      label: 'Remove from this phone',
      a11yWords: 'Remove the recovery phrase from this phone',
      a11yConnected: 'Remove the connected wallet from this phone',
      a11yBoth:
        'Remove the recovery phrase and connected wallet from this phone',
      dangerNoteDelete: "Move your money first. This can't be undone.",
      dangerNoteRemoveWords:
        "Move your money first if you don't have your own backup.",
      dangerNoteRemoveConnected:
        "The wallet's keys stay in the app it's linked from.",
      title: 'Remove from this phone',
      bodyWords:
        "Move your money first if you don't have your own backup of the recovery phrase. This erases the phrase from this phone, and it can't be undone. Corso doesn't have a copy, so only your own backup can bring this wallet back. Without it, money in the wallet stays on Solana, but you can't reach it. Your conversations, watchlist and AI sign-ins on this phone are erased too. It doesn't delete anything on Corso's servers, or a Corso account if you have one.",
      bodyConnected:
        "This disconnects the connected wallet from Corso on this phone. Its keys stay in the app it's linked from, and money in it stays on Solana. Your conversations, watchlist and AI sign-ins on this phone are erased, and that can't be undone. It doesn't delete anything on Corso's servers, or a Corso account if you have one.",
      bodyBoth:
        "Move the money in your imported wallet first if you don't have your own backup of its recovery phrase. This erases that recovery phrase from this phone, and it can't be undone. Corso doesn't have a copy, so only your own backup can bring the imported wallet back. Without it, money in that wallet stays on Solana, but you can't reach it. This also disconnects your connected wallet from Corso on this phone. Its keys stay in the app it's linked from. Your conversations, watchlist and AI sign-ins on this phone are erased too. It doesn't delete anything on Corso's servers, or a Corso account if you have one.",
      confirmPhrase: 'REMOVE',
      confirmPlaceholder: 'Type REMOVE to confirm',
      cta: 'Remove from this phone',
      cancel: 'Keep it',
      passcodeTitle: 'Enter your Corso passcode',
      passcodeBodyWords:
        'Enter your Corso passcode to remove the recovery phrase from this phone.',
      passcodeBodyConnected:
        'Enter your Corso passcode to remove the connected wallet from this phone.',
      passcodeBodyBoth:
        'Enter your Corso passcode to remove the recovery phrase and connected wallet from this phone.',
      passcodeCheckFailed: "Couldn't check the passcode. Try again.",
      forgotPasscode: 'Forgot it? Use your backup',
      failedWords:
        "Couldn't remove it. The recovery phrase is still on this phone.",
      failedConnected:
        "Couldn't remove it. The connected wallet is still linked on this phone.",
      failedBoth:
        "Couldn't remove it. The recovery phrase and the connected wallet are still on this phone.",
      failedBothWordsKept:
        "Couldn't remove the recovery phrase. It is still on this phone. The connected wallet is no longer linked here.",
      failedBothLinkKept:
        'The recovery phrase is erased, but the connected wallet is still linked on this phone.',
      incompleteWords:
        "The recovery phrase is erased. Some other data couldn't be removed from this phone yet.",
      incompleteConnected:
        "The connected wallet is no longer linked here. Some other data couldn't be removed from this phone yet.",
      incompleteBoth:
        "The recovery phrase is erased and the connected wallet is no longer linked here. Some other data couldn't be removed from this phone yet.",
      done: 'Removed from this phone',
    },
    aboutEmailSupport: 'Email support@corso.trade',
    /** Analytics are on by default; this section is the plain-language control to turn them off. */
    privacySection: 'Privacy',
    analyticsTitle: 'Anonymous usage data',
    analyticsBody:
      'We use analytics events to improve Corso. Those events never include recovery phrases or emails. Turn off any time. New events stop immediately. This does not delete events already sent.',
    analyticsToggle: 'Share usage analytics',
    /** Concise VoiceOver/TalkBack hint for the Profile privacy switch. */
    analyticsSwitchHint:
      'When off, new analytics events stop immediately. Events already sent are not deleted.',
    biometricsUnavailable: "Biometrics aren't available on this device.",
    errorSetting: "Couldn't save that setting. Try again.",
    /** The user quotes this ID when emailing support@corso.trade to delete analytics events. */
    installIdLabel: 'Install ID',
    installIdHelp:
      'Use this ID if you email support@corso.trade (subject: Delete my data) to delete analytics events for this install. It is not your wallet address.',
    installIdCopyA11y: 'Copy install ID',
    toastInstallIdCopied: 'Install ID copied',
    signOut: 'Sign out',
    signingOut: 'Signing out…',
    toastCopied: 'Address copied',
    toastCopyFailed: "Couldn't copy. Try again.",
    errorSignOut: "Couldn't sign out. Try again.",
  },
  ai: {
    title: 'Your AI',
    hubRow: 'Your AI',
    intro:
      'Corso answers on its own. Connect your AI to get its take too. It suggests. You decide.',
    connectLine:
      "You are connecting your own AI account, you are responsible for following that provider's terms, and the AI only suggests trades. It never moves your funds.",
    managedTitle: 'Corso',
    managedBody: 'Ready with nothing to set up. This is the default.',
    managedInUse: 'In use',
    byokTitle: 'Your own API key',
    byokBody: 'Paste a key from OpenAI, Anthropic, or xAI.',
    byokCta: 'Paste a key',
    subscriptionTitle: 'Your own plan',
    providerChatgpt: 'ChatGPT',
    providerClaude: 'Claude',
    providerGrok: 'Grok',
    providerOpenai: 'OpenAI key',
    providerAnthropic: 'Anthropic key',
    providerXai: 'xAI key',
    signIn: (name: string) => `Sign in with ${name}`,
    signInAgain: 'Sign in again',
    remove: 'Remove',
    removeConfirm: 'Remove this sign in?',
    removeConfirmCta: 'Yes, remove',
    removeCancel: 'Keep it',
    removeFailed: "Couldn't remove that sign in. It is still connected here.",
    statusReady: 'Ready',
    statusNeedsReconnect: 'Needs a new sign in',
    statusResting: 'Resting for a few minutes',
    statusBlocked: 'Not included in this plan',
    usageUnavailable: 'usage unavailable',
    usageSession: 'Session',
    usageWeek: 'Week',
    usageUsed: (label: string, percent: number) => `${label} ${percent}% used`,
    usageResets: (when: string) => `resets ${when}`,
    deviceCodeBody: 'Enter this code on the page that opens.',
    openPage: 'Open the sign-in page',
    copyCode: 'Copy code',
    toastCodeCopied: 'Code copied',
    waiting: 'Waiting for you to finish on that page',
    /** The live expiry clock beside the code (`m:ss`). */
    deviceCodeExpiresIn: (clock: string) => `Expires in ${clock}`,
    deviceDenied: 'That sign in was cancelled.',
    deviceExpired: 'That code expired. Start again.',
    connectFailed: "Couldn't finish signing in. Try again.",
    manualBody:
      'Sign in on the page that opens, then paste the code it shows you here.',
    manualPlaceholder: 'Paste the code',
    manualSetupTokenHint: 'You can also paste a token from claude setup-token.',
    manualStateMismatch:
      "That code doesn't belong to this sign in. Start again.",
    manualEmpty: 'Paste the code first.',
    manualUse: 'Use this code',
    byokPlaceholder: 'sk… or xai…',
    byokChecking: 'Checking the key',
    byokRejected: 'That key was refused. Check it and try again.',
    byokUnreachable: "Couldn't reach the provider. Try again.",
    byokUnknown: "That doesn't look like an OpenAI, Anthropic, or xAI key.",
    byokUse: 'Use this key',
    pausedTitle: 'Paused',
    pausedBody: 'No AI could answer. Sign in again, or let Corso run it.',
    offBody: 'Not available in this build.',
    cancel: 'Cancel',
    done: 'Done',
    byokDisclosure: (vendor: string) =>
      `Connect your own ${vendor} API key. Your use of ${vendor} is governed by your agreement with ${vendor}, not by Dinario. You are responsible for your own API usage and costs. Your key is stored only on this device and is never sent to Dinario's servers.`,
    managedDisclosure:
      "Powered by Google's Gemini through Corso's account. Subject to Corso's Terms.",
    /** The API vendors, for the disclosure sentence above. */
    vendorOpenai: 'OpenAI',
    vendorAnthropic: 'Anthropic',
    vendorXai: 'xAI',
    /** Model names, one per connected credential. Pinned to `pins.BYOK`. */
    modelNameOpenai: 'GPT-5',
    modelNameAnthropic: 'Claude Sonnet 5',
    modelNameXai: 'Grok 4',
    modelNameChatgpt: 'ChatGPT',
    modelNameClaude: 'Claude',
    modelNameGrok: 'Grok',
    /** The three branded connect pills. Each one opens its own key sheet. */
    byokPillCaption: (vendor: string) => `${vendor} API key`,
    byokPillA11y: (brand: string) => `Connect your ${brand} API key`,
    byokSheetTitle: (brand: string) => `Connect ${brand}`,
    byokKeyPlaceholder: (prefix: string) => `${prefix}\u2026`,
    byokWrongProvider: (brand: string) => `That is not a ${brand} key.`,
    byokConnected: 'Connected',
    ...aiConnectCopy,
  },
  buy: {
    title: 'Buy',
    checkoutDisclosure:
      "MoonPay handles payment and ID checks and shows its fees before you pay. Corso doesn't add a fee.",
    sheetSubtitle: (lastFour: string) =>
      lastFour ? `with MoonPay · to wallet ··${lastFour}` : 'with MoonPay',
    opening: 'Opening MoonPay…',
    pendingTitle: 'Buy with MoonPay',
    pendingBody:
      'If you completed checkout, delivery usually takes a few minutes. Your balance updates when it lands.',
    dismissPending: 'Dismiss',
    unsupportedGeo:
      "Buy isn't available in your region yet. Request funds from another wallet instead.",
    disabled: 'Buy is temporarily unavailable.',
    missingAddress: 'No wallet address yet.',

    networkUnknownTitle: "Can't buy right now",
    networkUnknownBody:
      "We can't confirm the network, so nothing will move. Not your fault. You haven't been charged. Try again in a few minutes.",
    errorGeneric: "Couldn't start Buy. Try again.",
    /**
     * Legacy key — ramp_not_configured maps to `disabled` (temporary unavailability).
     * Kept equal to disabled so any residual call site cannot leak config state.
     */
    errorNotConfigured: 'Buy is temporarily unavailable.',
    errorReturnNotConfigured: "Buy can't open right now. Try again later.",
    errorAssetDisabled: 'That asset is temporarily unavailable for Buy.',
    errorProviderUnsupported:
      'This payment provider is not available right now.',
    authDeclined: "Buy wasn't started. Confirm it's you to continue.",
    authUnavailable:
      "We can't confirm this wallet right now, so Buy is on hold. Try again in a moment.",
    authExpired: 'That took a moment too long. Close Buy and try again.',
    authDoorUnsupported:
      "Buy isn't available for a connected wallet yet. You can still receive SOL and USDC from another wallet.",
  },
  request: {
    title: 'Request',
    subtitle: 'Receive SOL & tokens',
    walletAddress: 'Wallet address',
    receiveAddressQr: 'Receive address QR',
    copyAddress: 'Copy address',
    share: 'Share',
    toastCopied: 'Address copied',
    toastCopyFailed: "Couldn't copy. Try again.",
    missingAddress: 'No wallet address yet.',
    accountName: 'Main account',
    network: 'Solana',
    yourAddress: 'Your Solana address',
    copy: 'Copy',
    caution: 'Only send Solana assets to this address.',
  },
  account: {
    portfolio: 'Portfolio',
    swap: 'Swap',
    sectionApp: 'App',
    /**
     * The biometric toggle is the app-lock preference (`appLock.ts`): it
     * decides how Corso UNLOCKS, and nothing else. The design frame's
     * "Confirms every signature" would claim a signing check this
     * preference does not perform, so the sub-line says what it does.
     */
    biometricsSub: 'Unlocks Corso',
    reduceMotion: 'Reduce motion',
    reduceMotionSub: 'Animations respect the system setting',
    reduceMotionFollowsSystem: 'Follows system',
    reduceMotionOnSystem: 'On · system setting',
    ...accountCopy,
  },
  support: {
    sectionHeading: 'Help',
    contactTitle: 'Contact support',
    contactSub: 'Report a bug or ask a question',
    subject: 'Corso support: Report a bug',
    bodyPrompt: 'What happened?',
    bodyDetailsHeading: 'App details',
    fieldAppVersion: 'App version',
    fieldBuild: 'Build',
    fieldRuntime: 'Runtime',
    fieldPlatform: 'Platform',
    fieldOsVersion: 'OS version',
    fieldDevice: 'Device',
    fieldSignIn: 'Sign-in',
    sessionEmbedded: 'Corso wallet',
    sessionImported: 'Imported wallet',
    sessionConnected: 'Connected wallet',
    sessionUnknown: 'Not signed in',
    valueUnknown: 'Unknown',
    bodyFooter:
      'Corso will never ask for your wallet words. Do not add them to this email.',
    /** Shown when the device has no mail app, or the composer failed closed. */
    fallbackTitle: 'Email support@corso.trade',
    fallbackBody:
      'No mail app opened on this device. Copy the address below and write to us from anywhere.',
    copyAddress: 'Copy address',
    toastAddressCopied: 'Address copied',
    toastCopyFailed: "Couldn't copy. Try again.",
  },
  money: {
    address: 'Address',
    ...moneyCopy,
  },
  send: {
    title: 'Send',
    subtitle: 'Transfer SOL',
    subtitleUsdc: 'Transfer USDC',
    assetLabel: 'Asset',
    assetSol: 'SOL',
    assetUsdc: 'USDC',
    toLabel: 'To',
    toPlaceholder: 'Solana address',
    paste: 'Paste',
    amountLabel: 'Amount',
    amountPlaceholder: '0',
    max: 'Max',
    feeLabel: 'Network fee',
    feeEstimating: 'Estimating…',
    balanceLastKnown: (amount: string) => `Last known balance ${amount}`,
    feeUnknown: 'Estimating…',
    feeUnavailable: 'Unavailable',
    feeRetry: 'Try again',
    rentLabel: 'One-time token account cost',
    rentRecovery: 'Recoverable when the token account is closed.',
    totalCostLabel: 'Total SOL cost',
    solRequiredLabel: 'SOL required',
    review: 'Review',
    reviewTitle: 'Review send',
    reviewSending: "You're sending",
    reviewTo: 'To',
    reviewFee: 'Network fee',
    reviewTotal: 'Total',
    confirm: 'Send',
    confirming: 'Sending…',
    successTitle: 'Sent',
    successTitleUncertain: 'Submitted',
    successBody: 'Your transfer was submitted.',
    successBodyUncertain:
      'Submitted. Confirmation pending. Wait before retrying.',
    successDone: 'Done',
    successHome: 'Back to Home',
    disabled: 'Send is temporarily unavailable.',
    missingAddress: 'No wallet address yet.',

    networkUnknownTitle: "Can't send right now",
    networkUnknownBody:
      "We can't confirm the network, so nothing will move. Not your fault. Your money is where it was. Try again in a few minutes.",
    errorGeneric: "Couldn't send. Try again.",
    errorCancelled: 'Send cancelled.',
    newRecipientTitle: 'New address',
    newRecipientBody:
      "You haven't sent here from this device. Double-check the address.",

    /**
     * Address rejections. One sentence each, in money words. Must match
     * `SEND_SHIPPED_ADDRESS_ERROR` for the shipped invalid case.
     */
    addressInvalid: 'Enter a valid Solana address.',
    addressSelf: "That's your own address.",
    addressBurn: 'Money sent there is gone. Check the address.',
    addressTokenMint: "That's a token, not a wallet. Money sent there is gone.",
    addressOffCurve: "That address can't receive money.",

    /** Scanner — a state of this sheet, never its own screen. */
    scanTitle: 'Scan a code',
    scanHint: 'Point at the code.',
    scanAsking: 'Asking for the camera.',
    scanClose: 'Close',
    scanDeniedTitle: "Camera's off",
    scanDeniedBody:
      'Turn the camera on for Corso in Settings, or paste the address instead.',
    scanOpenSettings: 'Open Settings',
    scanNotSolana: "That code isn't a Solana address.",
    scanBadAmount: "That code's amount doesn't look right. Type it yourself.",
    scanUnsupportedToken: 'Corso sends SOL and USDC.',
    scanFilled: (amount: string, symbol: string) =>
      `The code filled in ${amount} ${symbol}.`,
    scanFilledAsset: (symbol: string) => `The code asked for ${symbol}.`,

    /** Recent recipients. Addresses only. No names, ever. */
    recentsLabel: 'Recent',
  },
  activity: {
    costUnavailable: 'Not available',
    accountRentLabel: 'One-time token account cost',
    rentRecovery: 'Recoverable when the token account is closed.',
    totalCostLabel: 'Total SOL fees and account costs',
    title: 'Activity',
    filterAll: 'All',
    filterPending: 'Pending',
    filterSent: 'Sent',
    filterReceived: 'Received',
    empty: 'No activity yet. Receive or swap to see it here.',
    emptyFiltered: 'Nothing in this filter yet.',
    loading: 'Loading activity…',
    error: "Couldn't load activity. Pull to retry.",
    signedOut: 'Sign in to see this.',
    detailTitle: 'Details',
    status: 'Status',
    fee: 'Network fee',
    signature: 'Reference',
    counterparty: 'Counterparty',
    explorer: 'See it on Solscan',
    explorerNetworkUnknown:
      "We can't tell which network this is on, so we can't open Solscan.",
    copySignature: 'Copy reference',
    toastCopied: 'Reference copied',
    toastCopyFailed: "Couldn't copy. Try again.",
    missing: 'Not found.',
    statusPending: 'Pending',
    statusConfirmed: 'Confirmed',
    statusFailed: 'Failed',
    justNow: 'just now',
    minutesAgo: (minutes: number) => `${minutes}m ago`,
    hoursAgo: (hours: number) => `${hours}h ago`,
    yesterday: 'yesterday',
    daysAgo: (days: number) => `${days}d ago`,
    timeUnknown: 'time unknown',
    /** Spoken in place of the em-dash amount placeholder. */
    amountUnknownA11y: 'amount not shown',
  },
  tokenFacts: {
    loading: 'Loading token details…',
    unavailable: 'Token details unavailable',
    disabled: 'Token details are turned off',
    partial: 'Some token details are missing.',
    partialShort: 'Some details missing',
    stale: 'Token details may be out of date.',
    staleShort: 'Details may be out of date',
    unknown: 'Unknown',
    none: 'None',
    yes: 'Yes',
    no: 'No',
    renounced: 'Renounced',
    active: 'Active',
    verified: 'Verified',
    unverified: 'Unverified',
    verificationUnknown: 'Verification unknown',
    verifiedMeaning:
      'Verified means Jupiter lists this exact mint as verified.',
    mintTail: (tail: string) => `Mint …${tail}`,
    mintAuthority: 'Mint authority',
    freezeAuthority: 'Freeze authority',
    transferFee: 'Transfer fee',
    transferFeeConfigured: (bps: number) => `Yes (${bps} bps)`,
    transferFeeEstimated: (amount: string) =>
      `Est. mint transfer fee on quoted receive: ~${amount}`,
    transferHook: 'Transfer hook',
    transferHookProgram: 'Transfer hook program',
    transferHookAuthority: 'Transfer hook authority',
    permanentDelegate: 'Permanent delegate',
    permanentDelegateAddress: 'Permanent delegate address',
    defaultAccountFrozen: 'Default account frozen',
    topHolders: 'Top holders',
    liquidity: 'Liquidity',
    lpLocked: 'LP locked',
    panelTitle: 'Token details',
    panelTitlePayLeg: 'Token details · what you pay',
    panelTitleReceiveLeg: 'Token details · what you get',
    flagSummary: (count: number) => `${count} notes`,
  },
  assetDetail: {
    title: 'Asset',
    invalidTitle: 'Asset unavailable',
    invalidBody: 'This asset link is missing a valid Solana mint.',
    mint: 'Mint',
    priceUnavailable: 'Price not shown on this screen',
    retry: 'Retry',
    buy: 'Buy',
    sell: 'Sell',
    identity: (mint: string) => mint,
    ownershipTitle: 'Ownership',
    holderCount: 'Holders',
    jupiterTopHolders: 'Top holders',
    top20Accounts: 'Top 20 accounts',
    top20Methodology:
      'Share of raw mint supply held by the 20 largest token accounts.',
    attribution: (clock: string) => `as of ${clock}`,
  },
  chart: {
    historyLoading: 'Checking price history…',
    historyUnavailable: 'Price history is not available yet.',
    attribution: (clock: string) => `as of ${clock}`,
    coverageTopIndexedPool: 'Top indexed pool',
    coverageTokenAggregated: 'Across all pools',
    poolTail: (tail: string) => `Pool …${tail}`,
    poolLiquidity: 'Pool liquidity',
    poolVolume24h: '24h pool volume',
  },
  numberCraft: {
    showFull: 'Show full amount',
    showCompact: 'Show compact amount',
  },
  swap: {
    youPay: 'You pay',
    youReceive: 'You get',
    balance: (amount: string, symbol: string) => `${amount} ${symbol}`,
    max: 'Max',
    chart: 'Chart',
    amountPlaceholder: '0',
    flipTokens: 'Flip tokens',
    review: 'Review',
    enterAmount: 'Enter amount',
    quoting: 'Getting quote…',
    headline: (amount: string, paySymbol: string, receiveSymbol: string) =>
      `Swap ${amount} ${paySymbol} → ${receiveSymbol}`,
    headlinePair: (paySymbol: string, receiveSymbol: string) =>
      `${paySymbol} → ${receiveSymbol}`,
    reviewHeadline: (payOut: string, receiveSymbol: string) =>
      `Swap ${payOut} → ${receiveSymbol}`,
    rateLine: (paySymbol: string, outPerOne: string, receiveSymbol: string) =>
      `1 ${paySymbol} ≈ ${outPerOne} ${receiveSymbol}`,
    notEnough: (symbol: string) => `Not enough ${symbol}`,
    notEnoughForSwap: (symbol: string) => `Not enough ${symbol} for this swap`,
    payBalanceUnavailable: {
      sol_unavailable: 'SOL balance unavailable',
      usdc_unavailable: 'USDC balance not loaded yet',
      holdings_loading: 'Still reading what you hold',
      holdings_unavailable: "Couldn't read what you hold. Pull to retry.",
      wallet_type_unsupported: 'Selling a held token needs a Corso wallet',
      token_2022_not_sellable: 'Corso cannot sell Token-2022 tokens yet',
      holding_not_recognised: "Sell isn't available for this token",
      pay_decimals_unread:
        'Confirming this token before you can sell it',
      pay_decimals_mismatch:
        "This token's decimals don't match what opened this screen. Corso won't size an amount on that.",
    } as const,
    payBalanceUnavailableCta: 'Balance unavailable',
    unconfirmedSignature: (message: string, signature: string) =>
      `${message}\n\nReference: ${signature}`,
    route: 'Route',
    price: 'Rate',
    networkFee: 'Network fee',
    costEstimating: 'Estimating…',
    totalCost: 'Total SOL fees and account costs',
    accountRent: 'One-time token account cost',
    rentRecovery: 'Recoverable when the token account is closed.',
    corsoFee: 'Corso fee',
    // `usd` is quote-derived. The only literal amount allowed here is the
    // under-cent bound below; never replace this interpolator with a figure.
    corsoFeeValueWithUsd: (usd: string, percent: string) =>
      `${usd} · ${percent}`,
    corsoFeeUnderCent: '<$0.01',
    // Review sheet. `amount` is the quote's committed fee passed through
    // verbatim (see swapCommittedFee.ts); nothing here may compute a figure.
    corsoFeeCommitted: (amount: string, percent: string) =>
      `${amount} · ${percent}`,
    feeWhatsThis: "What's this?",
    feeWhatsThisHide: 'Hide',
    corsoFeeSolInputExplain:
      "This is Corso's fee, charged in SOL on top of the amount you pay, inside the transaction you sign.",
    minimumReceived: "You'll get at least",
    priceImpact: 'Price impact',
    riskNotThisOne: 'Not this one',
    riskSwapAnyway: 'Swap anyway',
    priceImpactUnknown: 'Price impact unknown',
    slippage: 'Slippage',
    slippageAuto: 'Auto',
    routeBest: 'Best available route found.',
    routeDetail: (impact: string) => `Best route selected · ${impact}`,
    routeProviderAttribution: 'via Metis',
    routeProviderAttributionAggregator: 'via Jupiter Meta-Aggregator',
    routeProviderPoweredBy: 'Powered by Jupiter',
    routeNames: {
      metis: 'Metis',
      jupiterz: 'JupiterZ',
      dflow: 'DFlow',
      okx: 'OKX',
    } as const,
    routeUnknown: '—',
    routeDetailWithProvider: (impact: string, attribution: string) =>
      `${impact} · ${attribution}`,
    accessJurisdiction: "We can't offer this here.",
    accessAsset: "This token isn't offered.",
    // Fee-authority voice: name the missing thing, then state the refusal.
    // `EXPO_PUBLIC_CORSO_FEE_AUTHORITY` unset yields "Corso fee authority is
    // not configured. Refusing to sign." Same shape, same finality. Neither
    // apologises and neither hints at a way around, because there is none.
    //
    // This one fires when the access check could not be read at all, which is
    // the same for every user everywhere, so it names no place and no rule and
    // is not the spoof map the two lines above avoid being.
    accessUnavailable: 'Access checks are not available. This won’t go through.',
    accessDisclosures:
      'Required disclosures are not available. This won’t go through.',
    quoteExpired: 'Quote expired',
    refresh: 'Refresh',
    successBody: 'Your swap was submitted.',
    disabled: 'Swap is temporarily unavailable.',
    missingAddress: 'No wallet address yet.',
    feeDropped:
      'Corso fee could not be verified on this quote. Try again later.',
    errorGeneric: "Couldn't swap. Try again.",
    errorQuote: "Couldn't get a quote. Try again.",
    noRoute: 'No route is available for this swap.',
    networkUnknown:
      "We can't confirm the network, so nothing will move. Not your fault. Your money is where it was. Try again in a few minutes.",
    networkUnknownTitle: "Can't swap right now",
  },
  trust: {
    privyRecovery:
      'Your wallet is tied to how you signed in. Sign in the same way on a new phone to get it back.',
    importedRecovery:
      'This wallet came from a recovery phrase, and only this phone holds it. Write the phrase down and keep it somewhere safe. It is the only way to get the wallet back, and no one can recover it for you.',
    connectedRecovery:
      'This wallet is linked from another app, and that app holds the keys. Recover it there, then link it again here.',
  },
  import: {
    ...importFailureCopy,
    ctaWorking: 'Importing…',
    errorChecksum:
      "That phrase isn't valid. Check the word order and try again.",
    /** Prefer this on Import — no secret word enters React error state. */
    errorWordlistAt: (n: number) =>
      `Word ${n} isn't a valid recovery word. Check the spelling.`,
    pasteDone: (n: number) => `Pasted ${n} words`,
    clipboardCleared: 'Clipboard cleared',
    clipboardClearFailed:
      "Wallet imported. We couldn't clear your clipboard, so clear it yourself.",
    revealShow: 'Show words',
    revealHide: 'Hide words',
    lengthUse24: 'Use 24 words',
    lengthUse12: 'Use 12 words',
    lengthDiscard:
      'Switching to 12 words will clear the extra words. Continue?',
    captureWarning:
      "Screenshots aren't safe. Anyone with that picture can move your funds.",
    dismiss: 'Dismiss',
    captureProtectionFailed:
      'Screen capture protection is required before you can enter a recovery phrase. Tap Try again to turn it on.',
    captureRetry: 'Try again',
    wordCellLabel: (n: number) => `Word ${n}`,
    wordCellEmpty: 'empty',
    wordCellSecureEntry: 'secure entry',
    wordCellEntered: 'entered',
    wordCellSecureField: 'secure field',
  },
  stepup: {
    reauthenticationTitle: 'Re-authentication needed',
    retry: 'Try again',
    enrollTitle: 'Add an extra check',
    enrollBody: (threshold: string) =>
      `Transactions of ${threshold} or more need a second confirmation. Set it up once. It takes about a minute.`,
    enrollCta: 'Set it up',
    enrollCancel: 'Not now',
    enrollFailed: "We couldn't finish setting that up. Try again.",
    verifyTitle: "Confirm it's you",
    verifyBody: (threshold: string) =>
      `This transaction is ${threshold} or more, so it needs a second confirmation.`,
    verifyCta: 'Verify',
    verifyWithTotp: 'Verify with authenticator app',
    verifyWithPasskey: 'Verify with passkey',
    verifyCancel: 'Cancel',
    codePlaceholder: '000000',
    verifyFailed: "That didn't verify. Try again.",
    verifyLocked: 'Too many attempts. Wait a minute and try again.',
    unavailable:
      "We can't run the security check right now, so this transaction is on hold. Try again in a moment.",
    appLockTitle: 'Confirm with your app lock',
    appLockBody: (threshold: string) =>
      `Enter your Corso passcode to approve transactions of ${threshold} or more.`,
    appLockWrong: "That passcode didn't match. Try again.",
    noAppLock: (threshold: string) =>
      `Set a Corso passcode to approve transactions of ${threshold} or more.`,
    reviewNotice: (threshold: string) =>
      `Amounts of ${threshold} or more need a second confirmation before they're sent.`,
  },
  stub: {
    body: 'Not available yet.',
  },
  skeleton: {
    loading: (what: string) => `Loading ${what}`,
  },
  /** Unknown route. Void canvas, no header, no template voice. */
  notFound: {
    title: 'Nothing here.',
    body: 'That link does not go anywhere.',
    cta: 'Go home',
  },
  crash: {
    title: 'Something went wrong.',
    body: 'Corso ran into a problem and stopped.',
    cta: 'Try again',
  },
  skills: {
    railChip: 'Skills',
    railChipA11y: 'Open the skills directory',
    title: 'Skills',
    lead: 'Rules you set. Corso never picks a token.',
    browseHint: 'Test before you trust.',
    kind: {
      execute: 'Rule',
      analytics: 'Reading',
    } as const,
    category: {
      screen: 'Screen',
    } as const,
    template: {
      the_verdict: {
        name: 'The Verdict',
        what: 'A read-only safety and structure check on any token you name. It reads. It never acts.',
        never: [
          'Never chooses the token. You name it.',
          'Never acts on what it reads.',
          'Never ranks tokens or tells you what to do.',
        ],
      },
      heads_up: {
        name: 'Heads-Up',
        what: 'Tells you when the chart structure of a token you name flips. It watches. It never acts.',
        never: [
          'Never chooses the token. You name it.',
          'Never acts on its own.',
          'Never ranks tokens or tells you what to do.',
        ],
      },
    } as const,
    preview: {
      whatItDoes: 'What it does',
      whatItNeverDoes: "Corso's software policy",
      softwarePolicyNote:
        'Corso applies these limits in software. Solana does not enforce the daily cap or end date.',
      testHeading: 'Test it',
      testOn: 'Test on a token you hold',
      testOnA11y: (symbol: string) => `Test on ${symbol}`,
      pickToTest: 'Pick a token to test on.',
      testCta: 'Test',
      testing: 'Testing…',
      simulated: 'Simulated. Past behavior, not a promise.',
      addAnalytics: 'Add this reading',
      added: 'Added.',
      addedAnalyticsBody: 'You can run it any time from the directory.',
      testNotInBuild: 'No dry run for this one in this build.',
    },
    test: {
      title: 'Dry run',
      windowDays: (days: number) => `Last ${days} days`,
      fireCount: (count: number) =>
        count === 0
          ? 'Would not have fired.'
          : count === 1
            ? 'Would have fired once.'
            : `Would have fired ${count} times.`,
      fireAt: (when: string, price: string) => `${when} at ${price}`,
      estSlippage: (bps: string) => `Estimated slippage ${bps}`,
      thinData: 'Thin data in this window. Treat the count as a rough sketch.',
      safety: {
        asOfNow: 'Safety as of now',
        level: {
          green: 'Nothing flagged.',
          amber: 'Something to look at.',
          red: 'Flags raised.',
          unknown: 'Could not read this token.',
        } as const,
        wouldExit: 'Would exit now.',
        wouldHold: 'Would not exit now.',
        setAt: (level: string) => `Set to exit at: ${level}`,
        noHistory:
          'This is today\u2019s read, not a replay. There is no safety history to test against.',
      },
      verdict: {
        clear: 'Nothing flagged.',
        caution: 'Something to look at.',
        avoid: 'Flags raised.',
        unknown: 'Could not read this token.',
      } as const,
      confluence: {
        timeframe: (timeframe: string) => `Chart structure ${timeframe}`,
        side: {
          bear: 'Structure leans down.',
          neutral: 'Structure is mixed.',
          bull: 'Structure leans up.',
        } as const,
        score: (score: number) => `Confluence score ${score}`,
      },
      reading: {
        mint_authority: 'Mint authority',
        freeze_authority: 'Freeze authority',
        lp_lock: 'Liquidity lock',
        top10_concentration: 'Top-10 holders',
        transfer_fee: 'Transfer fee',
        mutable_metadata: 'Metadata',
        rugged: 'Rug reports',
        insider_network: 'Insider network',
        low_liquidity: 'Liquidity depth',
        sniper_share: 'Snipers at launch',
        bundler_share: 'Bundled wallets',
        insider_cluster: 'Insider clusters',
        sources_reconciled: 'Source agreement',
        safety_sources: 'Safety sources',
      } as const,
      readingState: {
        ok: 'clear',
        warn: 'watch',
        fail: 'flagged',
        unknown: 'unavailable',
      } as const,
      disabled: 'Testing is not available.',
      unavailable: 'Test not available right now.',
      noData: 'Not enough history for this token.',
      unsupportedNetwork: 'Testing runs on mainnet only.',
      retry: 'Retry',
      informationNotAdvice: 'This is information, not advice.',
    },
    configure: {
      title: 'Set your rules',
      lead: 'Every value here is yours. Corso fills nothing in for you.',
      token: 'Token',
      tokenHint: 'Pick from what you hold.',
      watchLead: 'Pick the token and timeframe you want to watch.',
      timeframe: 'Timeframe',
      watchCta: 'Watch this token',
      watching: 'Adding watch...',
      watched: 'Watch added. You will get a heads-up when the structure flips.',
      watchExists: 'You already watch this token at that timeframe.',
      watchUnavailable: 'Could not add this watch. Try again.',
      threshold: 'Threshold',
      thresholdHint: (leg: 'up' | 'down') =>
        leg === 'down'
          ? 'Percent drop vs the 24h baseline'
          : 'Percent rise vs the 24h baseline',
      safety: 'Exit when safety turns',
      safetyHint: 'Read from the same sources you can see on the token.',
      safetyLevel: {
        toAmberOrWorse: 'Worth a look, or worse',
        toRed: 'Flagged',
      } as const,
      amount: 'Amount per swap',
      perFireMax: 'Most per swap',
      perDayMaxFires: 'Swaps per day',
      perDayMax: 'Most per day',
      minOutBps: 'Slippage limit',
      minOutBpsHint: 'Basis points. 100 is 1%.',
      expiryDays: 'Ends in',
      expiryDaysHint: 'Days. 30 at most.',
      errors: {
        tokenRequired: 'Pick a token.',
        positiveDecimal: 'Enter a number above zero.',
        positiveInteger: 'Enter a whole number above zero.',
        thresholdRange: (min: string, max: string) =>
          `Between ${min}% and ${max}%.`,
        amountOverPerFire: 'Amount per swap cannot exceed most per swap.',
        perFireOverPerDay: 'Most per swap cannot exceed most per day.',
        safetyRequired: 'Pick a safety level.',
        perDayFiresRange: (max: number) => `Between 1 and ${max}.`,
        minOutBpsRange: (max: number) => `Between 1 and ${max} basis points.`,
        expiryRange: (max: number) => `Between 1 and ${max} days.`,
      },
      review: 'Review the envelope',
      envelopeHeading: 'The exact rules that would sign',
      rules: {
        trade: 'Swap',
        mostPerTrade: 'Most per swap',
        mostPerDay: 'Most per day',
        slippageLimit: 'Slippage limit',
        ends: 'Ends',
      },
      tradeLine: (input: string, output: string, condition: string) =>
        `swap ${input} into ${output} when ${condition}`,
      condition: (symbol: string, leg: 'up' | 'down', pct: string) =>
        `${symbol} ${leg === 'down' ? 'drops' : 'rises'} ${pct}% vs its 24h baseline`,
      safetyCondition: (symbol: string, safety: 'toAmberOrWorse' | 'toRed') =>
        safety === 'toRed'
          ? `${symbol} safety turns flagged`
          : `${symbol} safety turns worth a look or worse`,
      perDay: (fires: number, amount: string) =>
        `${fires} ${fires === 1 ? 'swap' : 'swaps'}, ${amount}`,
      endsIn: (days: number) =>
        `in ${days} ${days === 1 ? 'day' : 'days'}, or when you revoke`,
    },
    empty: 'No skills to show.',
    back: 'Back',
  },
  automation: {
    suspension: {
      standing:
        'The on-chain approval is still standing until the owner signs a Revoke and it confirms.',
      cancel: 'Cancel rule',
      revoke: 'Sign Revoke',
      resumeUnavailable:
        'Execution is still paused by Corso. Resume this rule after execution is available.',
      stateChanged: 'The rule changed. Check permissions, then try again.',
    },
    pauseApprovalUnknown:
      'Any on-chain approval remains until the owner signs a Revoke and it confirms. Check token permissions to see whether an approval is standing.',
    pauseApproval:
      'The on-chain approval is still standing until the owner signs a Revoke and it confirms.',
    checkPermissions: 'Check token permissions',
    revokeNeeded:
      'This rule has stopped. Its on-chain allowance may still stand. The owner must sign a Revoke and wait for confirmation.',
    revokeAction: 'Sign Revoke',
    revokeFee:
      'This wallet pays the network fee in SOL. If it has too little SOL, add SOL and try again. The allowance remains until the Revoke confirms.',
    revokeNone: 'No standing allowance needs a Revoke.',
    revokeFailed:
      'The revoke is not confirmed. The allowance may still stand. Check the signature and try again.',

    title: 'Rules',
    a11yTitle: 'Your rules',
    rule: {
      dip: { title: 'Buy the dip', what: 'buys a drop you size' },
      take_profit: { title: 'Take profit', what: 'sells into your target' },
      stop_loss: { title: 'Stop loss', what: 'exits below your floor' },
      dca: { title: 'Accumulate', what: 'buys on your schedule' },
    } as const,
    trustNote:
      'A rule swaps the pair you name, inside the limits you set, until it expires. Solana caps each allowance you grant and limits it to the token account you approve. Corso holds that key and will not move funds out. Killing stops new swaps. The owner must sign a Revoke and wait for confirmation to remove the on-chain allowance. A swap already broadcast can still land; you always get the receipt.',
    setup: {
      unavailable: 'This rule cannot run yet.',
    },
    scope: {
      canHeading: 'It can',
      can: {
        swap: (input: string, output: string) =>
          `Swap ${input} into ${output} only. The pair you named`,
        spend: (perSwap: string, perDay: string) =>
          `Spend up to ${perSwap} per swap, ${perDay} per day`,
        until: (when: string) =>
          `Run until ${when}. Then it stops swapping. The on-chain allowance remains until the owner signs a Revoke and it confirms`,
      },
      chainHeading: 'Solana enforces',
      chain: {
        allowance_ceiling: {
          title: 'One allowance, one size',
          body: (perSwap: string) =>
            `you sign an allowance of ${perSwap}. Solana rejects any spend above it`,
        },
      },
      corsoHeading: 'Corso enforces',
      corsoNote:
        'Corso holds the key that signs for this rule. The limits below are kept by Corso. Solana does not enforce them.',
      corso: {
        destination: {
          title: 'Where it can send',
          body: 'Corso signs swaps on the pair you named and nothing else. Solana does not restrict the destination. Corso does',
        },
        daily_cap: {
          title: 'Your daily cap',
          body: (perDay: string) =>
            `${perDay} per day is counted and stopped by Corso`,
        },
        expiry: {
          title: 'Your end date',
          body: (when: string) =>
            `Corso stops swapping ${when}. The allowance you signed has no end date on Solana and stands until a Revoke confirms`,
        },
        nothing_but_swaps: {
          title: 'Swaps only',
          body: 'no approvals, no delegation, nothing else. Corso will not build or sign one',
        },
      },
      signsNote:
        'Running it signs one transaction: an allowance on one token account, up to the per swap amount you set, with no end date. Every other limit here is kept by Corso.',
      killNote:
        'Kill stops new swaps. The owner must sign a Revoke and wait for confirmation to remove the on-chain allowance. A swap already broadcast before the kill can still land; you’ll see its fill, receipt and all.',
    },
    status: {
      ended: 'Ended after failed swaps',
      setting_up: 'setting up',
      live: 'live',
      firing: 'swapping',
      paused: 'paused',
      revoking: 'revoking…',
      killed: 'killed',
      expired: 'expired',
    } as const,
    fired: 'fired',
    firedCount: (count: number) => `${count}×`,
    spentToday: (spent: string, cap: string) => `${spent} of ${cap} today`,
    summary: {
      dip: (
        symbol: string,
        pct: string,
        perSwap: string,
        perDay: string,
        until: string,
      ) =>
        `buy ${symbol} dips of ${pct}% · ≤ ${perSwap}/swap · ≤ ${perDay}/day · until ${until}`,
      take_profit: (
        symbol: string,
        pct: string,
        perSwap: string,
        perDay: string,
        until: string,
      ) =>
        `sell ${symbol} at +${pct}% · ≤ ${perSwap}/swap · ≤ ${perDay}/day · until ${until}`,
      stop_loss: (
        symbol: string,
        pct: string,
        perSwap: string,
        perDay: string,
        until: string,
      ) =>
        `sell ${symbol} below −${pct}% · ≤ ${perSwap}/swap · ≤ ${perDay}/day · until ${until}`,
      dca: (
        symbol: string,
        every: string,
        perSwap: string,
        perDay: string,
        until: string,
      ) =>
        `buy ${symbol} every ${every} · ≤ ${perSwap}/swap · ≤ ${perDay}/day · until ${until}`,
    },
    pause: 'Pause',
    resume: 'Resume',
    kill: 'Kill',
    killA11y: (name: string) =>
      `Stop ${name}. The owner must sign a Revoke and wait for confirmation to remove its on-chain allowance.`,
    killState: {
      revoking: 'Revoking…',
      revokingBody:
        'New swaps are stopped. The on-chain allowance may still stand until the owner signs a Revoke and it confirms.',
      killed: 'Revoke confirmed · key revoked',
      killedAt: (when: string) => `scoped key revoked on-chain · ${when}`,
      broadcastBeforeKill: (count: number) =>
        count === 1
          ? '1 swap already broadcast before kill. Here’s the fill'
          : `${count} swaps already broadcast before kill. Here are the fills`,
      superseded:
        'A newer rule holds the allowance. Its owner must sign a Revoke and wait for confirmation.',
      signRevoke: 'Confirm the revoke',
    },
    fill: {
      landed: (inAmount: string, outAmount: string) =>
        `${inAmount} → ${outAmount}`,
      pending: 'still landing',
      failed: 'did not land',
      unreadable: 'fill not readable yet',
    } as const,
    fires: {
      heading: 'What it’s fired',
      none: 'Nothing fired yet.',
      auto: 'AUTO',
      outcome: {
        landed: 'landed',
        submitting: 'landing',
        skipped: 'skipped',
        failed: 'failed',
      } as const,
    },
    expiry: {
      until: (when: string) => `until ${when}`,
      soon: (left: string) => `expires ${left}`,
      expired: 'expired · renewable',
      renew: 'Set up again',
    },
    fleet: {
      count: (n: number) => (n === 1 ? '1 rule' : `${n} rules`),
      live: (n: number) => `${n} live`,
      spent: (spent: string, cap: string) =>
        `${spent} of ${cap} daily caps spent`,
    },
    error: {
      list: 'Your rules are not available right now.',
      setup:
        'The rule could not be set up. Nothing is armed and nothing was signed.',
      arm: 'The rule could not be armed. Nothing is running.',
      pause: 'Could not pause. The rule is unchanged.',
      resume: 'Could not resume. The rule is unchanged.',
      kill: 'Kill did not go through. Try again.',
      ataInUse:
        'Another rule has a standing allowance for this input token. The owner must sign a Revoke and wait for confirmation before setting up another rule.',
      declined: 'Cancelled. Nothing was signed.',
    },
    off: 'Rules are not switched on for this build.',
    loading: 'Checking your rules…',
    back: 'Back',
  },
  report: {
    /** The menu's own heading. */
    title: 'Report this token',
    /** The overflow control on token detail, and the long-press hint. */
    open: 'Report',
    openA11y: (symbol: string) => `Report ${symbol}`,
    /** The named affordance when the label itself is withheld from the row. */
    openWithheldA11y: 'Report this token',
    /** The long-press hint on a list row. Says the gesture and its result. */
    rowHint: 'Hold to report this name.',
    lead: 'What is wrong with this name?',
    reason: {
      hate: 'Hateful or a slur',
      sexual: 'Sexual or exploitative',
      violence: 'Violent or threatening',
      impersonation: 'Pretends to be someone else',
      other: 'Something else',
    } as const,
    reasonA11y: (label: string) => `Report as ${label.toLowerCase()}`,
    /** Under the reasons, before a choice is made. Says what will happen. */
    note: 'We hide it from your feed right away and send the name for review.',
    sending: 'Sending…',
    /** The honest done state. No promise of a reply. */
    sent: 'Reported. Hidden from your feed.',
    /** The send failed, and the local hide still happened. */
    failed: 'Could not send the report. It is hidden from your feed.',
    retry: 'Try again',
    close: 'Close report options',
    /** The count line under a list, when the person has hidden pairs. */
    hiddenLine: (count: number) =>
      count === 1
        ? '1 pair hidden because you reported it.'
        : `${count} pairs hidden because you reported them.`,
  },
  discovery: {
    railChip: 'Discover',
    railChipA11y: 'Open Discover, fresh pairs under one million',
    lead: 'Fresh pairs under one million. Each one arrives already read.',
    stage: {
      new: 'New',
      about_to_graduate: 'About to graduate',
      graduated: 'Graduated',
      unknown: 'Stage unknown',
    } as const,
    stageHint: {
      new: 'Fresh on the bonding curve',
      about_to_graduate: 'Close to the curve finish line',
      graduated: 'Migrated to a full pool',
      unknown: 'No curve reading in the feed',
    } as const,
    curve: (pct: string) => `curve ${pct}`,
    lp: (usd: string) => `LP ${usd}`,
    lpUnknown: 'LP unknown',
    holders: (count: string) => `${count} holders`,
    holdersUnknown: 'holders unknown',
    snipers: (pct: string) => `snipers ${pct}`,
    snipersUnknown: 'snipers unknown',
    verdict: {
      green: 'No flags found',
      amber: 'Caution',
      red: 'Avoid',
      unknown: 'Unread',
    } as const,
    thinData: (age: string) => `thin data · ${age}`,
    ageMinutes: (minutes: number) => `${minutes} min old`,
    ageHours: (hours: number) => `${hours}h old`,
    ageDays: (days: number) => `${days}d old`,
    ageUnknown: 'age unknown',
    filters: {
      lpFloor: (usd: string) => `LP ${usd}+`,
      holderFloor: (count: string) => `${count}+ holders`,
      sniperCeiling: (pct: string) => `snipers under ${pct}`,
      clear: 'Clear filters',
    },
    emptyTitle: 'Nothing clears your floors',
    emptyBody: (hiddenByFilter: number, hiddenUnknown: number) =>
      `${hiddenByFilter} hidden by your floors, ${hiddenUnknown} hidden for thin data.`,
    noPairsTitle: 'No fresh pairs right now',
    noPairsBody: 'The feed came back empty. Pull to check again.',
    unavailableTitle: "Discover isn't available right now",
    unavailableBody:
      'The feed did not answer. Pull to try again. Your money is fine.',
    unreachableTitle: "Corso can't check Discover right now",
    unreachableBody:
      'We could not reach Corso, so we cannot tell you what is fresh. You may be offline. Pull to try again. Your money is fine.',
    refreshA11y: 'Pull to check the feed again',
    offBody: 'Discover is not switched on for this build.',
    checking: 'checking…',
    sources: 'This is information, not advice.',
    rowA11y: (symbol: string, stage: string, verdict: string) =>
      `${symbol}, ${stage}, ${verdict}. Open details`,
    root: {
      segment: {
        new: 'New',
        about_to_graduate: 'Graduating',
        graduated: 'Graduated',
      } as const,
      segmentA11y: {
        new: 'New pairs, fresh on the bonding curve',
        about_to_graduate: 'About to graduate, close to the curve finish line',
        graduated: 'Graduated, migrated to a full pool',
      } as const,
      /** The pill on a row the server did not score. Never a made-up number. */
      noScoreYet: 'No score yet',
      filtersButton: 'Filters',
      filtersButtonActive: (count: number) => `Filters · ${count}`,
      filtersButtonA11y: 'Open filters',
      filtersButtonActiveA11y: (count: number) => `Open filters, ${count} on`,
      menu: {
        title: 'Filters',
        lp: 'Liquidity',
        lpDetail: (usd: string) => `${usd} or more`,
        holders: 'Holders',
        holdersDetail: (count: string) => `${count} or more`,
        snipers: 'Sniper share',
        snipersDetail: (pct: string) => `under ${pct}`,
        hint: 'Floors hide rows. They do not judge them.',
        apply: 'Apply filters',
        clear: 'Clear all',
        close: 'Close filters',
        toggleA11y: (name: string) => `${name} floor`,
      },
      filteredEmptyTitle: 'Nothing matches these filters',
      filteredEmptyBody: (hidden: number) =>
        hidden > 0
          ? `${hidden} hidden by your floors. Loosen one or clear them.`
          : 'Loosen a floor or clear them.',
      stageEmptyTitle: {
        new: 'No new pairs right now',
        about_to_graduate: 'Nothing about to graduate right now',
        graduated: 'Nothing graduated recently',
      } as const,
      stageEmptyBody: 'Try another stage, or pull to check again.',
      unknownStageLine: (count: number) =>
        count === 1
          ? '1 more pair has no stage reading yet'
          : `${count} more pairs have no stage reading yet`,
    },
  },
  trading: { ...tradingCopy },
  browse: { ...browseCopy },
  paper: { ...paperCopy },
  deskUtilities: { ...deskUtilitiesCopy },
  todayCard: { ...todayCardProposedCopy },
  launchDock: { ...launchDockCopy },
  howItWorks: { ...howItWorksCopy },
  aiConsent: { ...aiConsentCopy },
  aiConsentControl: { ...aiConsentControlCopy },
  privacyPolicy: { ...privacyPolicyCopy },
  reviewReads: {
    footer: 'Mood & social reads are context only · not investment advice.',
  },
  fearGreed: {
    attribution: 'alternative.me',
    today: 'today',
    yesterday: 'yesterday',
  },
  fred: {
    fed: 'Fed',
    tenYear: '10Y',
    curve: '10Y\u20132Y',
    dollar: 'Dollar',
    cpi: 'CPI',
    today: 'today',
    yesterday: 'yesterday',
    notice:
      'This product uses the FRED\u00AE API but is not endorsed or certified by the Federal Reserve Bank of St. Louis.',
  },
  fundingOi: {
    funding: 'Funding',
    openInterest: 'Open interest',
    today: 'today',
    yesterday: 'yesterday',
    venues: {
      okx: 'OKX',
      bybit: 'Bybit',
      binance: 'Binance',
    },
  },
} as const;

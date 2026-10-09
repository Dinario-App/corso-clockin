import type { ConnectedTake } from '@/src/features/ask/connectedBrainAsk';
import { canAttachConnectedTake } from '@/src/features/switcher/liveCards';
import { copy } from '@/constants/copy';
import type { LiveCard } from '@/src/features/switcher/liveCards';
import {
  resolveLivePills,
  type LivePill,
  type MoversCard,
} from '@/src/features/switcher/switcherPresentation';
import {
  formatCompactUsd,
  formatCount,
  formatPct,
  resolveSafety,
  type VitalsSafetyPresentation,
} from '@/src/features/tokenVitals/tokenVitalsPresentation';
import type { VitalsPayload } from '@/src/features/tokenVitals/types';
import {
  formatReadStamp,
  resolveReadRing,
  type ReadRingView,
} from '@/src/features/tokenVitals/readRingCatalog';
import {
  resolveVerdictEvidenceRows,
  resolveVerdictSourcesSubLine,
  resolveVerdictWord,
} from '@/src/features/tokenVitals/verdictSurface';
import { resolveFeedVerdictTone } from '@/src/features/home/homeFeed';
import type {
  VerdictEvidenceChip,
} from '@/src/ui/verdict/VerdictCard';
import type { VerdictTone } from '@/src/ui/verdict/verdictCardPresentation';
import type { HomeAskPhase } from './homeEmptyPresentation';
import type { AnswerReportTarget } from '@/src/features/moderation/submitAnswerReport';

export type HomeAssemblyCheck = {
  key: string;
  label: string;
  /** Visible completed-tense label for a check the payload did not back. */
  unavailableLabel: string;
  state: 'running' | 'done' | 'unavailable';
  found: string | null;
};

export type HomeAssemblyVerdict = {
  /** `unread` when the server reached no verdict: hollow dot, ink word. */
  tone: VerdictTone;
  word: string;
  ring: ReadRingView | null;
  stampText: string | null;
  subLine: string | null;
  evidence: VerdictEvidenceChip[];
  announcement: string;
};

export type HomeAssemblyChart = {
  mint: string;
  symbol: string;
};

export type HomeAssemblyMovers =
  | { status: 'ready'; card: MoversCard }
  | { status: 'empty'; line: string };

export type HomeAssembly = {
  connectedTake: ConnectedTake | null;
  /** The exact Corso reply shown on screen, ready for the report write path. */
  answerReport: AnswerReportTarget | null;
  /** The connected model's displayed take, kept distinct from Corso's reply. */
  connectedTakeReport: AnswerReportTarget | null;
  /** The question, echoed back right-aligned. `null` → no echo, no assembly. */
  queryEcho: string | null;
  checks: HomeAssemblyCheck[];
  /** The atom, when the answer carried a scored token. */
  verdict: HomeAssemblyVerdict | null;
  chart: HomeAssemblyChart | null;
  movers: HomeAssemblyMovers | null;
  /** Corso's answer in prose, when there is no verdict to render instead. */
  answerLine: string | null;
  /** The one azure door — an EXISTING live pill, re-used. */
  cta: LivePill | null;
  forwardAction: LivePill | null;
  /** The remaining follow-up pills, which are questions, not doors. */
  followUps: LivePill[];
};

export function homeAssemblyHasForwardAction(
  assembly: HomeAssembly | null,
): boolean {
  if (assembly === null) return false;
  return assembly.cta !== null || assembly.forwardAction !== null;
}

export function resolveHomeAssemblyChecks(
  answerLanded: boolean,
  vitals: VitalsPayload | null = null,
): HomeAssemblyCheck[] {
  const found = answerLanded ? resolveCheckFindings(vitals) : NO_FINDINGS;
  const stateFor = (finding: string | null): HomeAssemblyCheck['state'] =>
    !answerLanded ? 'running' : finding === null ? 'unavailable' : 'done';
  return [
    {
      key: 'market',
      label: copy.home.checkMarketData,
      unavailableLabel: copy.home.checkMarketDataUnavailable,
      state: stateFor(found.market),
      found: found.market,
    },
    {
      key: 'liquidity',
      label: copy.home.checkLiquidity,
      unavailableLabel: copy.home.checkLiquidityUnavailable,
      state: stateFor(found.liquidity),
      found: found.liquidity,
    },
    {
      key: 'holders',
      label: copy.home.checkHolders,
      unavailableLabel: copy.home.checkHoldersUnavailable,
      state: stateFor(found.holders),
      found: found.holders,
    },
  ];
}

type CheckFindings = {
  market: string | null;
  liquidity: string | null;
  holders: string | null;
};

const NO_FINDINGS: CheckFindings = {
  market: null,
  liquidity: null,
  holders: null,
};

function resolveCheckFindings(vitals: VitalsPayload | null): CheckFindings {
  if (vitals === null) return NO_FINDINGS;
  const volume = formatCompactUsd(vitals.market?.volume24hUsd);
  const liquidity = formatCompactUsd(vitals.market?.liquidityUsd);
  const count = formatCount(vitals.holders?.count);
  const topTen = formatPct(vitals.holders?.top10Pct);
  const holders = [
    count === null ? null : copy.home.checkFoundHolders(count),
    topTen === null ? null : copy.home.checkFoundTopTen(topTen),
  ].filter((part): part is string => part !== null);
  return {
    market: volume === null ? null : copy.home.checkFoundMarket(volume),
    liquidity:
      liquidity === null ? null : copy.home.checkFoundLiquidity(liquidity),
    holders: holders.length === 0 ? null : holders.join(' · '),
  };
}

/** The last thing the person said in this thread — what the echo repeats. */
export function lastUserLine(card: LiveCard): string | null {
  const line = [...card.thread].reverse().find((item) => item.role === 'user');
  return line?.text ?? null;
}

function resolveVerdict(
  card: LiveCard,
): { verdict: HomeAssemblyVerdict; safety: VitalsSafetyPresentation } | null {
  if (card.kind !== 'vitals' || !card.vitals) return null;
  const payload = card.vitals;
  if (payload.safety.verdict === 'unknown' && payload.safety.v2 == null) {
    return null;
  }
  const safety = resolveSafety(payload);
  const ring = resolveReadRing(payload.safety);

  const verdict: Omit<HomeAssemblyVerdict, 'announcement'> = {
      tone:
        payload.safety.verdict === 'unknown'
          ? 'unread'
          : (resolveFeedVerdictTone(payload.safety.verdict) as VerdictTone),
      word: resolveVerdictWord(payload.safety.verdict),
      ring,
      stampText: formatReadStamp(ring?.stamp ?? null, Date.now()),
      subLine:
        ring?.reason ??
        resolveVerdictSourcesSubLine({
          scoreLine: null,
          sourcesLine: safety.sourcesLine,
          unreconciledLine: safety.unreconciledLine,
        }),
      evidence: resolveVerdictEvidenceRows(payload.safety.flags),
  };
  return {
    safety,
    verdict: { ...verdict, announcement: resolveVerdictAnnouncement(verdict) },
  };
}

export function resolveVerdictAnnouncement(verdict: {
  word: string;
  ring: ReadRingView | null;
  evidence: readonly VerdictEvidenceChip[];
}): string {
  const parts = [`${verdict.word}.`];
  if (verdict.ring !== null) parts.push(verdict.ring.accessibilityLabel);
  return parts.join(' ');
}

export function resolveHomeAssembly(input: {
  /** The focused live card, or `null` before the first answer. */
  card: LiveCard | null;
  /** The question in flight, when one is. */
  pendingQuestion: string | null;
  askPhase: HomeAskPhase;
  moversCard?: MoversCard | null;
}): HomeAssembly | null {
  const working = input.askPhase === 'working';

  /** In flight: the echo and the three running checks, and nothing else yet. */
  if (working) {
    const echo = input.pendingQuestion?.trim();
    if (!echo) return null;
    return {
      connectedTake: null,
      answerReport: null,
      connectedTakeReport: null,
      queryEcho: echo,
      checks: resolveHomeAssemblyChecks(false),
      verdict: null,
      chart: null,
      movers: null,
      answerLine: null,
      cta: null,
      forwardAction: null,
      followUps: [],
    };
  }

  const card = input.card;
  if (card === null) return null;
  const moving = card.kind === 'movers';

  const resolved = resolveVerdict(card);
  const pills = resolveLivePills(card);
  const ctaIndex = pills.findIndex(
    (pill) =>
      pill.action.kind === 'review' || pill.action.kind === 'vitals-review',
  );
  const cta = ctaIndex === -1 ? null : pills[ctaIndex]!;
  const rest = pills.filter((_, index) => index !== ctaIndex);
  const userLine = [...card.thread]
    .reverse()
    .find((item) => item.role === 'user');
  const coachLine = [...card.thread]
    .reverse()
    .find((item) => item.role === 'coach');
  const visibleConnectedTake = canAttachConnectedTake(card)
    ? (card.connectedTake ?? null)
    : null;
  const answerReport: AnswerReportTarget | null =
    userLine && coachLine
      ? {
          answerId: coachLine.id,
          question: userLine.text,
          answer: coachLine.text,
          source: 'corso',
        }
      : null;

  return {
    connectedTake: visibleConnectedTake,
    answerReport,
    connectedTakeReport:
      answerReport && visibleConnectedTake
        ? {
            answerId: `${answerReport.answerId}:connected`,
            question: answerReport.question,
            answer: visibleConnectedTake.text,
            source: 'connected_ai',
          }
        : null,
    queryEcho: lastUserLine(card),
    /** A list read no liquidity and no holders: no check claims it did. */
    checks: moving
      ? []
      : resolveHomeAssemblyChecks(
          true,
          card.kind === 'vitals' ? card.vitals : null,
        ),
    verdict: resolved?.verdict ?? null,
    movers: moving
      ? input.moversCard
        ? { status: 'ready', card: input.moversCard }
        : { status: 'empty', line: copy.moving.threadEmpty }
      : null,
    chart:
      resolved !== null &&
      resolved.verdict.tone !== 'unread' &&
      card.kind === 'vitals' &&
      card.vitals
        ? { mint: card.vitals.token.mint, symbol: card.vitals.token.symbol }
        : null,
    answerLine: coachLine?.text ?? null,
    cta,
    forwardAction:
      cta !== null
        ? null
        : (rest.find((pill) => pill.action.kind === 'details') ??
          rest[0] ??
          null),
    followUps: rest,
  };
}

import {
  answerFromText,
  readModelText,
  readAnswerText,
} from './askAnswerBoundary';

import { copy } from '@/constants/copy';
import type { HoldingsSnapshot } from '@/src/features/balances/computeFiatTotal';
import type { ByoAiFlags } from '@/src/features/aiConnect/flags';
import type {
  AiConnect,
  BrainContext,
  BrainSummary,
  ProposalDraft,
} from '@/src/features/aiConnect/types';
import { modelBrand } from '@/src/features/aiConnect/ui/modelMenuPresentation';
import {
  isCredentialProvider,
  type BrainProvider,
  type CredentialProvider,
} from '@/src/features/aiConnect/types';
import {
  hasConnectedConsent,
  type AiConsentOwnerBinding,
} from '@/src/features/aiConsent/aiConsentStore';
import { brandFor } from '@/src/features/aiConsent/consentBrand';
import { formatAtomicAmount } from '@/src/features/swap/tokens';
import type { AskAnswer } from './askClient';

/**
 * The whole ladder, not one request. `proposeOverHttp` already bounds a
 * single call at `STREAM_IDLE_TIMEOUT_MS`; this bounds the person's wait, so
 * two slow rungs cannot add up to a spinner nobody would sit through. On
 * expiry the ask falls back to Auto like any other failure.
 */
export const CONNECTED_BRAIN_TIMEOUT_MS = 30_000;

let takeSeq = 0;

/** One id per connected take: a single-use permission is spent by one question only. */
function nextTakeId(): string {
  takeSeq += 1;
  return `take:${takeSeq}`;
}

/** At most this many holdings are named to a brain. Symbols only, no mints. */
const MAX_CONTEXT_HOLDINGS = 12;

export const CONNECTED_BRAIN_INSTRUCTIONS = [
  'You are the copilot inside Corso, a trading app for Solana.',
  'Answer the question in plain language, in at most four short sentences.',
  'Provide explanation and context only. Do not recommend trades, predict prices, set price targets, or provide calls to action.',
  'You cannot move, sign, or approve anything. Corso provides the independent facts and safety verdict.',
  'Reply with a JSON object using only the key rationale (your explanation in plain language).',
  'Never name a mint, a wallet address, or a dollar amount. Corso resolves those itself.',
].join('\n');

export type ConnectedBrainOutcome =
  | Readonly<{
      kind: 'proposal';
      answer: AskAnswer;
      provider: BrainProvider;
      slotId: string;
      /** A connected brain answered, but not the one that was picked. */
      degraded: boolean;
      /**
       * The line about who answered, already folded into `answer`. Exposed
       * so a caller can tell a plain answer from a degraded one.
       */
      note: string | null;
    }>
  | Readonly<{
      kind: 'fallback';
      /** Null when there is nothing honest to say: the pick was never live. */
      note: string | null;
    }>;

/**
 * Symbols and rounded amounts, and nothing else.
 *
 * `BrainContext.holdings` is documented as "refs, never mints or addresses",
 * and this is where that promise is kept: the mint, the atomic balance, the
 * decimals, the wallet address and every fiat figure stay on this side. A
 * brain learns that the person holds some SOL, not which account holds it.
 */
export function buildBrainContext(input: {
  question: string;
  holdings: HoldingsSnapshot | null;
}): BrainContext {
  const snapshot = input.holdings;
  const lines =
    snapshot && snapshot.quantityStatus === 'ready'
      ? snapshot.lines.filter(
          (line) => line.includeInHomeTotal && /^\d+$/.test(line.atomic.trim()),
        )
      : [];
  const holdings = lines.slice(0, MAX_CONTEXT_HOLDINGS).map((line) =>
    Object.freeze({
      symbol: line.symbol,
      amount: roundAmount(
        formatAtomicAmount(line.atomic.trim(), line.decimals),
      ),
    }),
  );
  return Object.freeze({
    question: input.question.trim(),
    holdings: Object.freeze(holdings),
    instructions: CONNECTED_BRAIN_INSTRUCTIONS,
  });
}

/** Six decimals is plenty to answer a question and is not a signing amount. */
function roundAmount(value: string): string {
  const dot = value.indexOf('.');
  if (dot < 0) return value;
  const trimmed = value.slice(0, dot + 7).replace(/\.?0+$/, '');
  return trimmed.length > 0 ? trimmed : '0';
}

export function proposalAnswer(draft: ProposalDraft): AskAnswer {
  return answerFromText('answered', readModelText(draft.rationale.trim()));
}

/** Prepend the honest line about who answered, keeping the rest of the answer. */
export function withFallbackNote(
  answer: AskAnswer,
  note: string | null,
): AskAnswer {
  if (!note) return answer;
  const body = answer.answer.trim();
  const text = body ? `${note}\n\n${body}` : note;
  return Object.assign(
    answerFromText(
      answer.status,
      readModelText(text),
      readAnswerText(answer).chips,
    ),
    answer,
    { answer: text },
  );
}

/** What a brain is called in a sentence: the brand, or Corso for managed. */
function brandOf(provider: BrainProvider): string {
  return provider === 'managed' ? copy.ai.managedTitle : modelBrand(provider);
}

/** Why the picked model is not answering, in the person's words. */
function noteFor(brain: BrainSummary): string {
  const name = brandOf(brain.provider);
  switch (brain.status) {
    case 'resting':
      return copy.ask.modelRestingNote(name);
    case 'needs_reconnect':
      return copy.ask.modelNeedsSignInNote(name);
    case 'blocked':
      return copy.ask.modelBlockedNote(name);
    case 'ready':
      return copy.ask.modelUnreachableNote(name);
  }
}

/** True only while the same wallet is still bound and consent was not cleared. */
function stillTheSameWallet(binding: AiConsentOwnerBinding): boolean {
  try {
    return binding.stillCurrent() === true;
  } catch {
    return false;
  }
}

/**
 * Put the question to the picked brain, and say honestly what happened.
 *
 * The pin only reorders the ladder (`pool.ts`), so a picked brain that cannot
 * answer costs the ask nothing: another connected brain may answer instead,
 * and if none does the caller asks the server. Either way the person is told
 * which model spoke.
 */
export async function askConnectedBrain(input: {
  ai: Pick<AiConnect, 'propose'>;
  flags: ByoAiFlags;
  /** The picked brain, already resolved against what the picker lists. */
  brain: BrainSummary;
  question: string;
  holdings: HoldingsSnapshot | null;
  owner: string | null;
  consent: AiConsentOwnerBinding | null;
  signal?: AbortSignal;
  timeoutMs?: number;
  hasConsent?: (provider: CredentialProvider) => boolean;
}): Promise<ConnectedBrainOutcome> {
  // Belt and braces: the picker cannot offer a row while the feature is off,
  // and if one ever leaked through, Auto answers and says nothing about it.
  if (!input.flags.byoAiEnabled || input.brain.kind === 'managed') {
    return Object.freeze({ kind: 'fallback', note: null });
  }

  const provider = input.brain.provider;
  if (
    !isCredentialProvider(provider) ||
    (input.hasConsent ?? hasConnectedConsent)(provider) !== true
  ) {
    const brand = isCredentialProvider(provider) ? brandFor(provider) : null;
    return Object.freeze({
      kind: 'fallback',
      note: brand ? copy.aiConsent.connectedOffLine(brand.brand) : null,
    });
  }

  const owner = input.owner;
  const binding = input.consent;
  if (
    !owner ||
    binding === null ||
    binding.owner !== owner ||
    !stillTheSameWallet(binding)
  ) {
    return Object.freeze({ kind: 'fallback', note: null });
  }

  const context = buildBrainContext({
    question: input.question,
    holdings: input.holdings,
  });
  if (context.question.length === 0) {
    return Object.freeze({ kind: 'fallback', note: null });
  }

  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    input.timeoutMs ?? CONNECTED_BRAIN_TIMEOUT_MS,
  );
  const onParentAbort = () => controller.abort();
  if (input.signal) {
    if (input.signal.aborted) controller.abort();
    else input.signal.addEventListener('abort', onParentAbort, { once: true });
  }

  let state: Awaited<ReturnType<AiConnect['propose']>> | null = null;
  try {
    // No execution argument: propose-only, the only mode there is.
    const aborted = new Promise<never>((_, reject) => {
      const fail = () => reject(new Error('connected_take_aborted'));
      if (controller.signal.aborted) fail();
      else controller.signal.addEventListener('abort', fail, { once: true });
    });
    if (controller.signal.aborted) await aborted;
    state = await Promise.race([
      input.ai.propose(
        context,
        input.flags,
        controller.signal,
        undefined,
        input.brain.id,
        {
          owner,
          takeId: nextTakeId(),
          stillCurrent: () => stillTheSameWallet(binding),
        },
      ),
      aborted,
    ]);
  } catch {
    state = null;
  } finally {
    clearTimeout(timer);
    input.signal?.removeEventListener('abort', onParentAbort);
  }

  if (!stillTheSameWallet(binding)) {
    return Object.freeze({ kind: 'fallback', note: null });
  }

  if (
    state === null ||
    controller.signal.aborted ||
    state.status !== 'proposal'
  ) {
    return Object.freeze({ kind: 'fallback', note: noteFor(input.brain) });
  }
  // A draft with nothing in it is a dead thread. Auto answers instead.
  if (state.draft.rationale.trim().length === 0) {
    return Object.freeze({ kind: 'fallback', note: noteFor(input.brain) });
  }

  const answeredBySomeoneElse = state.slotId !== input.brain.id;
  const note = answeredBySomeoneElse
    ? copy.ask.modelAnsweredInstead(
        brandOf(input.brain.provider),
        brandOf(state.provider),
      )
    : null;
  return Object.freeze({
    kind: 'proposal',
    answer: withFallbackNote(proposalAnswer(state.draft), note),
    provider: state.provider,
    slotId: state.slotId,
    degraded: answeredBySomeoneElse,
    note,
  });
}

export type ConnectedTake = Readonly<{ label: string; text: string }>;

/** Only display strings cross this boundary; never spread a provider payload. */
export function connectedTake(
  outcome: ConnectedBrainOutcome,
): ConnectedTake | null {
  if (outcome.kind !== 'proposal' || outcome.provider === 'managed')
    return null;
  return {
    label: copy.ask.modelTakeLabel(brandOf(outcome.provider)),
    text: outcome.answer.answer,
  };
}

/** Publish the server answer before even starting optional provider work. */
export async function runCorsoAsk(input: {
  submit: () => Promise<AskAnswer>;
  isCurrent: () => boolean;
  /** False when the actual destination is a money/sign card. */
  onAnswer: (answer: AskAnswer) => boolean;
  getTake: (() => Promise<ConnectedTake | null>) | null;
  onTake: (take: ConnectedTake) => void;
}): Promise<void> {
  const answer = await input.submit();
  if (!input.isCurrent()) return;
  const destinationAllowsTake = input.onAnswer(answer);
  if (
    !destinationAllowsTake ||
    answer.status !== 'answered' ||
    !answer.connectedTakeAllowed ||
    !input.getTake ||
    answer.swap ||
    answer.swapChoices ||
    answer.addMoney ||
    answer.routine ||
    answer.sellDoors?.length ||
    answer.vitals?.render === 'token_vitals_disambiguate'
  )
    return;
  try {
    const take = await input.getTake();
    if (take && input.isCurrent()) input.onTake(take);
  } catch {
    // Corso is already on screen. Provider errors cannot replace its answer.
  }
}

import type { AskAnswer } from '@/src/features/ask/askClient';
import type {
  AiConsentOwnerBinding,
  DefaultAssistantDecision,
} from '@/src/features/aiConsent/aiConsentStore';
import {
  currentConsentRequest,
  raiseConsentRequest,
  resolveConsentRequest,
  subscribeConsentRequests,
  type ConsentRequest,
  type ConsentResolution,
} from '@/src/features/aiConsent/consentRequests';
import { registerConsentScopedClear } from '@/src/features/aiConsent/consentScopedClear';
import {
  applyDefaultConsentResolution,
  routeDefaultConsentAnswer,
  type DefaultConsentRoute,
} from './homeDefaultConsentFlow';

export type HomeAskBinding = Readonly<{
  owner: string | null;
  stillCurrent: () => boolean;
}>;

/**
 * Bind a question to the wallet it was asked under and the consent generation
 * that was live at the time.
 *
 * With no wallet there is nothing to bind to and nothing to leak between
 * wallets: the question stays current. With a wallet, the store's binding must
 * exist, name that same wallet, and still be current — so a wallet change, a
 * sign-out, a clear or a forget all end it, permanently (an A → B → A cycle
 * matches the address again but never the generation).
 */
export function bindHomeAsk(
  owner: string | null,
  consent: AiConsentOwnerBinding | null,
): HomeAskBinding {
  if (owner === null)
    return Object.freeze({ owner, stillCurrent: () => true });
  return Object.freeze({
    owner,
    stillCurrent: () =>
      consent !== null && consent.owner === owner && consent.stillCurrent(),
  });
}

export type BoundAskRoute = 'drop' | DefaultConsentRoute;

export function routeBoundAskAnswer(input: {
  /** The binding captured when the question was created. Never a later one. */
  binding: HomeAskBinding;
  answer: AskAnswer;
  overlaid: boolean;
  decision: 'unset' | DefaultAssistantDecision;
  consentRetry: boolean;
}): BoundAskRoute {
  if (!input.binding.stillCurrent()) return 'drop';
  return routeDefaultConsentAnswer({
    answer: input.answer,
    overlaid: input.overlaid,
    decision: input.decision,
    consentRetry: input.consentRetry,
  });
}

/** A question waiting behind the sheet. The binding is part of it, always. */
export type HeldConsentQuestion = Readonly<{
  text: string;
  answer: AskAnswer;
  /** The raised request's id. The permission and the replay share it. */
  requestId: string;
  /** Captured when the question was created. Never replaced. */
  binding: HomeAskBinding;
}>;

export type ConsentHoldBox = {
  held: HeldConsentQuestion | null;
  /** @internal the live queue subscription, or `null` when nothing is held. */
  unwatch: (() => void) | null;
};

export function createConsentHoldBox(): ConsentHoldBox {
  return { held: null, unwatch: null };
}

let parked: HeldConsentQuestion | null = null;

const claimant = new WeakMap<HeldConsentQuestion, ConsentHoldBox>();

/**
 * The box that has ADOPTED the park and not yet released it, or `null` when the
 * park is up for adoption. Exclusivity lives here: the creating mount is not an
 * adopter, the first adopter claims, and a second adopter gets nothing until the
 * first releases on unmount.
 */
let parkedAdopter: ConsentHoldBox | null = null;

function unparkHold(): void {
  parked = null;
  parkedAdopter = null;
}

function claimParkedHold(box: ConsentHoldBox, held: HeldConsentQuestion): void {
  const previous = claimant.get(held) ?? null;
  claimant.set(held, box);
  parkedAdopter = box;
  if (previous === null || previous === box) return;
  previous.unwatch?.();
  previous.unwatch = null;
  if (previous.held === held) previous.held = null;
}

registerConsentScopedClear((scope) => {
  if (scope.kind !== 'all') return;
  parked = null;
  parkedAdopter = null;
});

let issuedRequestIds = 0;

export function nextHeldRequestId(): string {
  issuedRequestIds += 1;
  return `home-default-${issuedRequestIds}`;
}

/** Take the held question out of the box and close its queue watch with it. */
function takeHold(box: ConsentHoldBox): HeldConsentQuestion | null {
  const held = box.held;
  box.held = null;
  box.unwatch?.();
  box.unwatch = null;
  // Consumed, so there is nothing left to adopt. A park that outlived its
  // question is the one thing that could land an answered question twice.
  if (held !== null && parked === held) unparkHold();
  return held;
}

/** What Home does with the held question. `discard` is observable nowhere. */
export type HeldQuestionUse =
  | Readonly<{ kind: 'discard' }>
  | Readonly<{ kind: 'explain'; text: string; answer: AskAnswer }>
  | Readonly<{ kind: 'resend'; text: string; requestId: string }>;

const DISCARD: HeldQuestionUse = Object.freeze({ kind: 'discard' });

function stillBound(held: HeldConsentQuestion | null): held is HeldConsentQuestion {
  return held !== null && held.binding.stillCurrent();
}

export type ConsentHoldEffects = Readonly<{
  landExplainer: (text: string, answer: AskAnswer) => void;
  /** Release Home with no card: the question belonged to somebody else. */
  drop: () => void;
  /** Replay the held question, which is the only thing that reaches the wire. */
  resend: (text: string, requestId: string) => void;
}>;

export type ConsentHoldStore = Readonly<{
  raiseConsentRequest: (request: ConsentRequest) => ConsentRequest | null;
  currentConsentRequest: () => ConsentRequest | null;
  resolveConsentRequest: (id: string, resolution: ConsentResolution) => void;
  subscribeConsentRequests: (listener: () => void) => () => void;
  applyDefaultConsentResolution: (
    resolution: ConsentResolution,
    requestId: string,
  ) => Promise<{ resend: boolean }>;
}>;

const STORE: ConsentHoldStore = Object.freeze({
  raiseConsentRequest,
  currentConsentRequest,
  resolveConsentRequest,
  subscribeConsentRequests,
  applyDefaultConsentResolution,
});

export function holdForDefaultConsent(
  box: ConsentHoldBox,
  question: { text: string; answer: AskAnswer; binding: HomeAskBinding },
  effects: ConsentHoldEffects,
  store: ConsentHoldStore = STORE,
): void {
  takeHold(box);
  const held: HeldConsentQuestion = Object.freeze({
    text: question.text,
    answer: question.answer,
    requestId: nextHeldRequestId(),
    binding: question.binding,
  });
  if (!stillBound(held)) {
    effects.drop();
    return;
  }
  box.held = held;
  parked = held;
  parkedAdopter = null;
  claimant.set(held, box);
  const raised = store.raiseConsentRequest({
    id: held.requestId,
    kind: 'default_assistant',
    origin: 'home',
  });
  if (raised === null) {
    takeHold(box);
    effects.landExplainer(held.text, held.answer);
    return;
  }
  if (store.currentConsentRequest()?.id !== raised.id) {
    takeHold(box);
    store.resolveConsentRequest(raised.id, 'dismissed');
    effects.landExplainer(held.text, held.answer);
    return;
  }
  watchForStranding(box, held, effects, store);
}

function watchForStranding(
  box: ConsentHoldBox,
  held: HeldConsentQuestion,
  effects: ConsentHoldEffects,
  store: ConsentHoldStore,
): void {
  box.unwatch = store.subscribeConsentRequests(() => {
    const pending = store.currentConsentRequest();
    queueMicrotask(() => {
      if (claimant.get(held) !== box) return;
      // This watch belongs to ONE question. If the box has moved on — answered,
      // dropped, or holding the next question already — the emit that woke it
      // is somebody else's, and releasing here would land a question its owner
      // never finished with.
      if (box.held !== held) return;
      releaseStrandedHold(box, pending, effects);
    });
  });
}

export function releaseConsentHoldOnUnmount(box: ConsentHoldBox): boolean {
  const watching = box.unwatch !== null;
  box.unwatch?.();
  box.unwatch = null;
  box.held = null;
  if (parkedAdopter === box) parkedAdopter = null;
  return watching;
}

export type ConsentHoldAdoption = 'adopted' | 'explained' | 'dropped' | 'none';

export function adoptParkedConsentHold(
  box: ConsentHoldBox,
  effects: ConsentHoldEffects,
  store: ConsentHoldStore = STORE,
): ConsentHoldAdoption {
  const held = parked;
  if (held === null || box.held !== null) return 'none';
  if (parkedAdopter !== null) return 'none';
  claimParkedHold(box, held);
  const pending = store.currentConsentRequest();
  if (pending !== null && pending.id !== held.requestId) {
    unparkHold();
    return 'none';
  }
  if (!stillBound(held)) {
    unparkHold();
    effects.drop();
    return 'dropped';
  }
  if (pending === null) {
    // The request left the queue while nothing held the question: a sign-out
    // dropped it, or a host tap resolved it into the mount that is now gone.
    unparkHold();
    effects.landExplainer(held.text, held.answer);
    return 'explained';
  }
  box.held = held;
  watchForStranding(box, held, effects, store);
  return 'adopted';
}

export function mountConsentHold(
  box: ConsentHoldBox,
  effects: ConsentHoldEffects,
  store: ConsentHoldStore = STORE,
): () => void {
  adoptParkedConsentHold(box, effects, store);
  return () => {
    releaseConsentHoldOnUnmount(box);
  };
}

export function releaseStrandedHold(
  box: ConsentHoldBox,
  pending: ConsentRequest | null,
  effects: ConsentHoldEffects,
): HeldQuestionUse {
  if (box.held === null || pending !== null) return DISCARD;
  const held = takeHold(box) as HeldConsentQuestion;
  if (!stillBound(held)) {
    effects.drop();
    return DISCARD;
  }
  effects.landExplainer(held.text, held.answer);
  return Object.freeze({ kind: 'explain', text: held.text, answer: held.answer });
}

export async function resolveHeldConsent(
  box: ConsentHoldBox,
  request: ConsentRequest,
  resolution: ConsentResolution,
  effects: ConsentHoldEffects,
  store: ConsentHoldStore = STORE,
): Promise<HeldQuestionUse> {
  if (request.kind !== 'default_assistant') return DISCARD;
  const held = box.held;
  if (held === null) return DISCARD;
  if (request.id !== held.requestId) return DISCARD;
  takeHold(box);
  if (!stillBound(held)) {
    effects.drop();
    return DISCARD;
  }
  const { resend } = await store.applyDefaultConsentResolution(
    resolution,
    held.requestId,
  );
  if (!stillBound(held)) {
    effects.drop();
    return DISCARD;
  }
  if (resend) {
    effects.resend(held.text, held.requestId);
    return Object.freeze({ kind: 'resend', text: held.text, requestId: held.requestId });
  }
  effects.landExplainer(held.text, held.answer);
  return Object.freeze({ kind: 'explain', text: held.text, answer: held.answer });
}

export function __resetConsentHoldForTests(): void {
  unparkHold();
  issuedRequestIds = 0;
}

export function __peekParkedConsentHoldForTests(): HeldConsentQuestion | null {
  return parked;
}

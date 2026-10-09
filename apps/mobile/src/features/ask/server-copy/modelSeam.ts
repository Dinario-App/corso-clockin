import type { ModelText } from './textProvenance.js';
import type { AskResult } from './types.js';
import type { AskContext } from './types.js';

export type AskModelRequest = {
  question: string;
  context: AskContext;
};

export type AskModelFailure =
  | 'unavailable'
  | 'timeout'
  | 'rate_limited'
  | 'malformed'
  | 'refusal';

export type AskModelResponse =
  | { ok: true; result: unknown }
  | { ok: false; failure: AskModelFailure };

export interface AskModel {
  classify(request: AskModelRequest): Promise<AskModelResponse>;
}

export const unavailableAskModel: AskModel = {
  async classify(): Promise<AskModelResponse> {
    return { ok: false, failure: 'unavailable' };
  },
};

export const GIBBERISH_COPY = 'I didn\'t get that. Try "swap 1 SOL for USDC".';

export const MODEL_FAILURE_COPY: Record<AskModelFailure, string> = {
  unavailable: "Ask isn't working right now. Your money is fine.",
  timeout: 'That took too long. Try again?',
  rate_limited: 'Too many at once. Give it a second.',
  malformed: GIBBERISH_COPY,
  refusal: GIBBERISH_COPY,
};

type ModelClassification = {
  intent: AskResult['intent'];
  sourceSymbol: ModelText;
  targetSymbol: ModelText;
  subjectSymbol: ModelText;
  confidence: 'high' | 'low';
};

export function parseClassification(raw: unknown): ModelClassification | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  const intents: AskResult['intent'][] = [
    'SWAP',
    'HOLDING_FACT',
    'PORTFOLIO',
    'CLARIFY',
    'REFUSE',
    'OUT_OF_SCOPE',
  ];
  if (
    typeof value.intent !== 'string' ||
    !intents.includes(value.intent as AskResult['intent']) ||
    typeof value.sourceSymbol !== 'string' ||
    typeof value.targetSymbol !== 'string' ||
    typeof value.subjectSymbol !== 'string' ||
    (value.confidence !== 'high' && value.confidence !== 'low')
  )
    return null;
  // Only parsed classifier fields acquire the model-boundary brand. Ignore
  // extra fields (including model-supplied answer/chips/provenance metadata).
  return {
    intent: value.intent as AskResult['intent'],
    sourceSymbol: value.sourceSymbol as ModelText,
    targetSymbol: value.targetSymbol as ModelText,
    subjectSymbol: value.subjectSymbol as ModelText,
    confidence: value.confidence,
  };
}

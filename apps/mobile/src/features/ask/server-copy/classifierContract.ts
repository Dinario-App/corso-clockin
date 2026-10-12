
import type { ModelText } from './textProvenance.js';

export const ASK_CLASSIFIER_INTENTS = [
  'SWAP',
  'HOLDING_FACT',
  'PORTFOLIO',
  'CLARIFY',
  'REFUSE',
  'OUT_OF_SCOPE',
] as const;

export type AskClassifierIntent = (typeof ASK_CLASSIFIER_INTENTS)[number];

export const ASK_CLASSIFIER_SYMBOL_MAX = 16;

export const ASK_CLASSIFIER_FIELDS = [
  'intent',
  'sourceSymbol',
  'targetSymbol',
  'subjectSymbol',
  'confidence',
] as const;

export const ASK_CLASSIFICATION_SCHEMA = {
  type: 'object',
  properties: {
    intent: { type: 'string', enum: ASK_CLASSIFIER_INTENTS },
    sourceSymbol: { type: 'string' },
    targetSymbol: { type: 'string' },
    subjectSymbol: { type: 'string' },
    confidence: { type: 'string', enum: ['high', 'low'] },
  },
  required: ASK_CLASSIFIER_FIELDS,
  additionalProperties: false,
} as const;

export const ASK_CLASSIFIER_SYSTEM_PROMPT = [
  'Classify one Corso Ask request.',
  'Return only the requested JSON shape.',
  'Extract token symbols only. Use an empty string when a symbol is absent.',
  'Use SWAP only when the person clearly chose a trade direction.',
  'Use CLARIFY when the source, destination, or instruction is ambiguous.',
  "Use REFUSE for advice, prediction, autonomous execution, yield, recurring orders, tax, or legal requests, and for market-wide discovery: trending, hottest, best, or biggest-mover questions not scoped to the user's own holdings.",
  'Suspicious holdings require low confidence and CLARIFY.',
  'When context.unpricedHoldingsCount is positive, totalUsd is the priced subtotal only; unpriced holdings are not valued and this is not the whole wallet value.',
].join(' ');

export type AskClassification = {
  intent: AskClassifierIntent;
  sourceSymbol: ModelText;
  targetSymbol: ModelText;
  subjectSymbol: ModelText;
  confidence: 'high' | 'low';
};

function isCappedSymbol(value: unknown): value is string {
  return typeof value === 'string' && value.length <= ASK_CLASSIFIER_SYMBOL_MAX;
}

export function isAskClassification(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  if (Object.getPrototypeOf(value) !== Object.prototype) return false;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  return (
    keys.length === ASK_CLASSIFIER_FIELDS.length &&
    ASK_CLASSIFIER_FIELDS.every((field) => keys.includes(field)) &&
    typeof record.intent === 'string' &&
    (ASK_CLASSIFIER_INTENTS as readonly string[]).includes(record.intent) &&
    isCappedSymbol(record.sourceSymbol) &&
    isCappedSymbol(record.targetSymbol) &&
    isCappedSymbol(record.subjectSymbol) &&
    (record.confidence === 'high' || record.confidence === 'low')
  );
}

export function readAskClassification(
  value: unknown,
): AskClassification | null {
  if (!isAskClassification(value)) return null;
  const record = value as Record<string, string>;
  return {
    intent: record.intent as AskClassifierIntent,
    sourceSymbol: record.sourceSymbol as ModelText,
    targetSymbol: record.targetSymbol as ModelText,
    subjectSymbol: record.subjectSymbol as ModelText,
    confidence: record.confidence as 'high' | 'low',
  };
}

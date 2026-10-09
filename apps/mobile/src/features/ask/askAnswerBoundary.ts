import { readTrustedCopyRef } from './server-copy/textProvenance';
import type { AskAnswer } from './askClient';
import type { AskText, ModelText } from './askText';

/** Raw answer/data boundary: absent authenticated provenance is model text. */
export function readModelText(text: string): ModelText {
  return Object.freeze({ kind: 'model', text }) as ModelText;
}

const answerProvenance = new WeakMap<
  AskAnswer,
  { line: AskText; chips: readonly AskText[] }
>();
export function answerFromText(
  status: AskAnswer['status'],
  line: AskText,
  chips: readonly AskText[] = [],
): AskAnswer {
  const answer = {
    status,
    answer: line.text,
    chips: chips.map((chip) => chip.text),
  } as AskAnswer;
  answerProvenance.set(answer, { line, chips: [...chips] });
  return answer;
}
export function readAnswerText(answer: AskAnswer): {
  line: AskText;
  chips: readonly AskText[];
} {
  const known = answerProvenance.get(answer);
  return {
    line:
      known?.line.text === answer.answer
        ? known.line
        : readModelText(answer.answer),
    chips: answer.chips.map((chip, at) =>
      known?.chips[at]?.text === chip ? known.chips[at] : readModelText(chip),
    ),
  };
}

export function readServerText(text: string, reference: unknown): AskText {
  const trusted = readTrustedCopyRef(reference);
  return trusted?.text === text ? trusted : readModelText(text);
}

export function readCopyRefs(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

import { howItWorksCopy } from '@/constants/copy/howItWorks';
import {
  howItWorksReplayHref,
  resolveHowItWorksAiBody,
  type HowItWorksFlagInput,
} from './howItWorksPresentation';

export const HOW_IT_WORKS_VERDICT_QUESTIONS_ENABLED = false;

export const HOW_IT_WORKS_REPLAY_ENABLED = false;

export type HowItWorksPageFlags = HowItWorksFlagInput;

export type HowItWorksBasicId =
  | 'ask'
  | 'verdicts'
  | 'reviewAndSign'
  | 'botsAndRules'
  | 'yourAi';

export type HowItWorksBasic = Readonly<{
  id: HowItWorksBasicId;
  head: string;
  body: string;
}>;

export type HowItWorksQuestionId =
  | 'verdictSources'
  | 'riskScale'
  | 'withoutYou'
  | 'aiSees'
  | 'aiSwaps'
  | 'cost';

export type HowItWorksQuestion = Readonly<{
  id: HowItWorksQuestionId;
  question: string;
  answer: string | null;
  visible: boolean;
}>;

export type HowItWorksPagePresentation = Readonly<{
  title: string;
  /** Null while `HOW_IT_WORKS_REPLAY_ENABLED` is off: no row renders. */
  replay: Readonly<{
    label: string;
    href: ReturnType<typeof howItWorksReplayHref>;
  }> | null;
  basicsHeading: string;
  basics: readonly HowItWorksBasic[];
  questionsHeading: string;
  /** Visible rows only. Hidden sheets stay in the catalog. */
  questions: readonly HowItWorksQuestion[];
}>;

function withoutYouAnswer(botsEnabled: boolean): string {
  const { answer, answerBots } = howItWorksCopy.questions.withoutYou;
  return botsEnabled ? `${answer} ${answerBots}` : answer;
}

function costAnswer(flags: HowItWorksPageFlags): string {
  const { answerSignIn, answerKeysOnly } = howItWorksCopy.questions.cost;
  return flags.chatgptEnabled || flags.grokEnabled
    ? answerSignIn
    : answerKeysOnly;
}

export function resolveHowItWorksQuestionCatalog(
  flags: HowItWorksPageFlags,
): HowItWorksQuestion[] {
  const verdictGate = HOW_IT_WORKS_VERDICT_QUESTIONS_ENABLED;
  const riskScaleAnswer: string | null = null;
  const questions: HowItWorksQuestion[] = [
    {
      id: 'verdictSources',
      question: howItWorksCopy.questions.verdictSources.question,
      answer: howItWorksCopy.questions.verdictSources.answer,
      visible: verdictGate,
    },
    {
      id: 'riskScale',
      question: howItWorksCopy.questions.riskScale.question,
      answer: riskScaleAnswer,
      visible: verdictGate && riskScaleAnswer !== null,
    },
    {
      id: 'withoutYou',
      question: howItWorksCopy.questions.withoutYou.question,
      answer: withoutYouAnswer(flags.botsEnabled),
      visible: true,
    },
  ];
  if (flags.byoAiEnabled) {
    questions.push(
      {
        id: 'aiSees',
        question: howItWorksCopy.questions.aiSees.question,
        answer: howItWorksCopy.questions.aiSees.answer,
        visible: true,
      },
      {
        id: 'aiSwaps',
        question: howItWorksCopy.questions.aiSwaps.question,
        answer: howItWorksCopy.questions.aiSwaps.answer,
        visible: true,
      },
      {
        id: 'cost',
        question: howItWorksCopy.questions.cost.question,
        answer: costAnswer(flags),
        visible: true,
      },
    );
  }
  return questions;
}

export function resolveHowItWorksBasics(
  flags: HowItWorksPageFlags,
): HowItWorksBasic[] {
  const basics: HowItWorksBasic[] = [
    {
      id: 'ask',
      head: howItWorksCopy.basics.ask.head,
      body: howItWorksCopy.basics.ask.body,
    },
    {
      id: 'verdicts',
      head: howItWorksCopy.basics.verdicts.head,
      body: howItWorksCopy.basics.verdicts.body,
    },
    {
      id: 'reviewAndSign',
      head: howItWorksCopy.basics.reviewAndSign.head,
      body: howItWorksCopy.basics.reviewAndSign.body,
    },
  ];
  if (flags.botsEnabled) {
    basics.push({
      id: 'botsAndRules',
      head: howItWorksCopy.basics.botsAndRules.head,
      body: howItWorksCopy.basics.botsAndRules.body,
    });
  }
  if (flags.byoAiEnabled) {
    basics.push({
      id: 'yourAi',
      head: howItWorksCopy.basics.yourAi.head,
      body: resolveHowItWorksAiBody(flags),
    });
  }
  return basics;
}

export function resolveHowItWorksPagePresentation(
  flags: HowItWorksPageFlags,
): HowItWorksPagePresentation {
  const catalog = resolveHowItWorksQuestionCatalog(flags);
  return {
    title: howItWorksCopy.title,
    replay: HOW_IT_WORKS_REPLAY_ENABLED
      ? {
          label: howItWorksCopy.replay,
          href: howItWorksReplayHref(),
        }
      : null,
    basicsHeading: howItWorksCopy.basicsHeading,
    basics: resolveHowItWorksBasics(flags),
    questionsHeading: howItWorksCopy.questionsHeading,
    questions: catalog.filter((question) => question.visible),
  };
}

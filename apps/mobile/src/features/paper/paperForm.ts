import {
  dcaEveryMs,
  isSolanaAddress,
  isValidPaperRequest,
  PAPER_DCA_MAX_HOURS,
  PAPER_DCA_MIN_HOURS,
  PAPER_MAX_MIN_OUT_BPS,
  PAPER_MAX_PER_DAY_FIRES,
  PAPER_SOL_MINT,
  type PaperRequest,
  type PaperRuleKind,
} from './paperClient';

export type PaperForm = {
  mint: string;
  ruleKind: PaperRuleKind;
  /** dropPct / risePct, or hours for DCA. */
  param: string;
  windowDays: 7 | 30;
  sizeUsd: string;
  startingUsd: string;
  perDayMaxFires: string;
  perDayMaxUsd: string;
  minOutBps: string;
};

export type PaperFormField = Exclude<
  keyof PaperForm,
  'ruleKind' | 'windowDays'
>;

export const PAPER_PARAM_DEFAULT: Record<PaperRuleKind, string> = {
  dip: '10',
  take_profit: '20',
  stop_loss: '15',
  dca: '6',
};

export function defaultPaperForm(mint?: string | null): PaperForm {
  return {
    mint: mint && isSolanaAddress(mint) ? mint : PAPER_SOL_MINT,
    ruleKind: 'dip',
    param: PAPER_PARAM_DEFAULT.dip,
    windowDays: 30,
    sizeUsd: '50',
    startingUsd: '500',
    perDayMaxFires: '3',
    perDayMaxUsd: '150',
    minOutBps: '100',
  };
}

export function paramKey(
  kind: PaperRuleKind,
): 'dropPct' | 'risePct' | 'everyHours' {
  if (kind === 'take_profit') return 'risePct';
  if (kind === 'dca') return 'everyHours';
  return 'dropPct';
}

const INT = /^\d{1,6}$/;
const USD = /^\d{1,7}(?:\.\d{1,6})?$/;
const PCT = /^\d{1,3}(?:\.\d{1,4})?$/;

export function buildPaperRequest(
  form: PaperForm,
):
  | { ok: true; request: PaperRequest }
  | { ok: false; fields: PaperFormField[] } {
  const fields: PaperFormField[] = [];
  const mint = form.mint.trim();
  if (!isSolanaAddress(mint)) fields.push('mint');

  const param = form.param.trim();
  let rule: PaperRequest['rule'] | null = null;
  if (form.ruleKind === 'dca') {
    const hours = INT.test(param) ? Number(param) : NaN;
    if (hours >= PAPER_DCA_MIN_HOURS && hours <= PAPER_DCA_MAX_HOURS)
      rule = { kind: 'dca', everyMs: dcaEveryMs(hours) };
  } else if (PCT.test(param)) {
    const value = Number(param);
    const max = form.ruleKind === 'take_profit' ? 500 : 90;
    if (value >= 1 && value <= max) {
      rule =
        form.ruleKind === 'take_profit'
          ? { kind: 'take_profit', risePct: param }
          : { kind: form.ruleKind, dropPct: param };
    }
  }
  if (!rule) fields.push('param');

  const usdField = (key: 'sizeUsd' | 'startingUsd' | 'perDayMaxUsd') => {
    const value = form[key].trim();
    if (!USD.test(value) || !/[1-9]/.test(value) || Number(value) > 1_000_000)
      fields.push(key);
    return value;
  };
  const sizeUsd = usdField('sizeUsd');
  const startingUsd = usdField('startingUsd');
  const perDayMaxUsd = usdField('perDayMaxUsd');

  const intField = (key: 'perDayMaxFires' | 'minOutBps', max: number) => {
    const value = form[key].trim();
    const parsed = INT.test(value) ? Number(value) : NaN;
    if (!(parsed >= 1 && parsed <= max)) fields.push(key);
    return parsed;
  };
  const perDayMaxFires = intField('perDayMaxFires', PAPER_MAX_PER_DAY_FIRES);
  const minOutBps = intField('minOutBps', PAPER_MAX_MIN_OUT_BPS);

  if (fields.length > 0 || !rule) return { ok: false, fields };
  const request: PaperRequest = {
    mint,
    rule,
    windowDays: form.windowDays,
    sizeUsd,
    startingUsd,
    caps: { perDayMaxFires, perDayMaxUsd, minOutBps },
  };
  // The client gate is the last word: a form that passes here and fails there is a bug, not a request.
  return isValidPaperRequest(request)
    ? { ok: true, request }
    : { ok: false, fields: ['param'] };
}

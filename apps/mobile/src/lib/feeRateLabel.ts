// Number and unit joined by whitespace, ASCII hyphen-minus, U+2010–U+2015
// (hyphen through horizontal bar) or the minus sign, any number of times.
const BPS_RATE = /\d[\s\-\u2010-\u2015\u2212]*(?:bps?|basis[\s\-\u2010-\u2015\u2212]*points?)\b/i;
const PERCENT = /\d[\s\-\u2010-\u2015\u2212]*(?:[%\uFF05]|per[\s\-\u2010-\u2015\u2212]*cent\b)/i;
const FEE_WORD = /\bfees?\b/i;

export function isFeeRateLabel(label: string): boolean {
  if (BPS_RATE.test(label)) return true;
  return PERCENT.test(label) && FEE_WORD.test(label);
}

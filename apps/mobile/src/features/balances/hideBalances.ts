import { copy } from '@/constants/copy';
import type { HomeBookModel } from '@/src/ui/ethena/homeBookModel';
import {
  BALANCE_MASK,
  maskFigure,
  maskFiguresInline,
} from '@/src/ui/format/balanceMask';

export {
  BALANCE_MASK,
  maskedFigureLabel,
  maskFigure,
  maskFiguresInline,
  spokenFigure,
} from '@/src/ui/format/balanceMask';

/** Home: the total, the three subtotals, each row's value and quantity. */
export function maskHomeBook(model: HomeBookModel): HomeBookModel {
  const hero =
    model.hero?.kind === 'value' && /\d/.test(model.hero.amount)
      ? { ...model.hero, amount: BALANCE_MASK, cents: null, delta: null }
      : model.hero;
  return {
    ...model,
    hero,
    sections:
      model.sections?.map((section) => ({
        ...section,
        subtotal: maskFigure(section.subtotal),
        rows: section.rows.map((row) => ({
          ...row,
          value: maskFigure(row.value),
          // The sleeve summary's sub is the partial caveat, not a quantity.
          sub: row.key === 'sleeve' ? row.sub : maskFigure(row.sub),
          delta: row.delta === undefined ? undefined : maskFigure(row.delta),
        })),
      })) ?? null,
  };
}

type ActivityRowShape = {
  title: string;
  subLine: string;
  amountText: string;
  amountTone: string;
  amountIsPlaceholder: boolean;
  fiatText: string | null;
  statusLabel: string;
  accessibilityLabel: string;
};

/** Activity row: the amount goes; who, when and status stay. */
export function maskActivityFeedRow<T extends ActivityRowShape>(view: T): T {
  if (view.amountIsPlaceholder) return view;
  return {
    ...view,
    amountText: BALANCE_MASK,
    amountTone: 'neutral',
    fiatText: null,
    accessibilityLabel: `${view.title}, ${view.subLine}, ${copy.profile.preferencesBalanceHidden}, ${view.statusLabel}`,
  };
}

type SleeveShape = {
  state: string;
  hero: string | null;
  rows: readonly { quantity: string | null; value: string | null }[];
};

/** Sleeve (06): the total, each row's value and quantity. Names and count stay. */
export function maskSleeve<T extends SleeveShape>(model: T): T {
  return {
    ...model,
    hero: model.state === 'refused' ? model.hero : maskFigure(model.hero),
    rows: model.rows.map((row) => ({
      ...row,
      quantity: maskFigure(row.quantity),
      value: maskFigure(row.value),
    })),
  };
}

type SleeveCapShape = {
  status: string | null;
  ofTotal: string | null;
  notice: { title: string; body: string } | null;
};

/** Sleeve cap readout: left-under-cap dollars and share of the book. */
export function maskSleeveCap<T extends SleeveCapShape>(cap: T): T {
  return {
    ...cap,
    status: cap.status === null ? null : maskFiguresInline(cap.status),
    ofTotal: cap.ofTotal === null ? null : maskFiguresInline(cap.ofTotal),
    notice:
      cap.notice === null
        ? null
        : { ...cap.notice, body: maskFiguresInline(cap.notice.body) },
  };
}

import { copy } from '@/constants/copy';
import { MAJOR_ASSETS } from '@/src/features/balances/majors';
import { bookMajorHref } from '@/src/features/home/book/bookDoors';
import {
  isTodayMajor,
  type TodayCardModel,
  type TodayChange,
} from '@/src/features/home/today/todayCardPresentation';

export type BuyPickerRow = {
  key: string;
  mint: string;
  name: string;
  symbol: string;
  price: string | null;
  change: TodayChange | null;
};

export type BuyPickerModel = {
  title: string;
  majorsHeader: string;
  rows: BuyPickerRow[];
  everythingElseHeader: string;
  findToken: string;
};

export function presentBuyPicker(today: TodayCardModel): BuyPickerModel {
  const figures =
    today.kind === 'loaded' || today.kind === 'stale' ? today.rows : [];
  return {
    title: copy.buy.title,
    majorsHeader: copy.homeBook.majors,
    rows: MAJOR_ASSETS.filter(isTodayMajor).map((asset) => {
      const figure = figures.find((row) => row.mint === asset.mint);
      return {
        key: asset.symbol,
        mint: asset.mint,
        name: asset.displayName,
        symbol: asset.symbol,
        price: figure?.price ?? null,
        change: figure?.change ?? null,
      };
    }),
    everythingElseHeader: copy.homeBook.sleeve,
    findToken: copy.sleeve.findToken,
  };
}

/** Where a picker row goes: the major's 03 on the asset route. */
export function buyPickerRowHref(mint: string) {
  return bookMajorHref(mint);
}

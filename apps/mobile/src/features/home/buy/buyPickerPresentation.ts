import { copy } from '@/constants/copy';
import { MAJOR_ASSETS, type MajorAsset } from '@/src/features/balances/majors';
import {
  majorConsumerName,
  majorWrapperLine,
} from '@/src/features/balances/majorNames';
import { bookMajorHref } from '@/src/features/home/book/bookDoors';
import {
  isTodayMajor,
  type TodayCardModel,
  type TodayChange,
} from '@/src/features/home/today/todayCardPresentation';
import { resolveAcquireAccess } from '@/src/features/security/acquireAccessPresentation';
import type { JurisdictionGateInputs } from '@/src/features/security/jurisdictionGateInputs';
import { SOL_MINT } from '@/src/features/swap/tokens';
import { readWealthV1BuildFlag } from '@/src/features/wealth/wealthEnv';


export type BuyPickerRow = {
  key: string;
  mint: string;
  name: string;
  symbol: string;
  sub: string;
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

function isWealthBuyMajor(asset: MajorAsset): boolean {
  return isTodayMajor(asset) || asset.symbol === 'ZEC';
}

function buyableMajors(gateInputs: JurisdictionGateInputs | null | undefined) {
  const majors = MAJOR_ASSETS.filter(
    readWealthV1BuildFlag() ? isWealthBuyMajor : isTodayMajor,
  );
  if (gateInputs == null) return majors;
  const open = majors.filter(
    (asset) =>
      resolveAcquireAccess({
        gateInputs,
        mint: asset.mint,
        symbol: asset.symbol,
        name: asset.displayName,
      }).kind !== 'refused',
  );
  return open.length > 0
    ? open
    : // Every row refused: Solana alone (F1.3), never an empty picker.
      majors.filter((asset) => asset.mint === SOL_MINT);
}

export function presentBuyPicker(
  today: TodayCardModel,
  gateInputs?: JurisdictionGateInputs | null,
): BuyPickerModel {
  const figures =
    today.kind === 'loaded' || today.kind === 'stale' ? today.rows : [];
  return {
    title: copy.buy.title,
    majorsHeader: copy.homeBook.majors,
    rows: buyableMajors(gateInputs).map((asset) => {
      const figure = figures.find((row) => row.mint === asset.mint);
      return {
        key: asset.symbol,
        mint: asset.mint,
        name: majorConsumerName(asset),
        symbol: asset.symbol,
        sub: majorWrapperLine(asset.symbol) ?? asset.symbol,
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

import { sleeveCapCopy } from '@/constants/copy/sleeveCap';
import type {
  FiatLineResult,
  HoldingLine,
} from '@/src/features/balances/computeFiatTotal';
import { classifyHolding } from '@/src/features/balances/majors';
import {
  formatCents,
  type HomeBookRead,
} from '@/src/features/home/book/homeBookPresenter';
import type { SessionType } from '@/src/features/session/types';
import type { HoldingSection } from '@corso/swap-config';

export const SLEEVE_CAP_STEPS = [10, 15, 20, 25] as const;
export type SleeveCapStep = (typeof SLEEVE_CAP_STEPS)[number];

export type SleeveCapRead =
  | { kind: 'known'; capPercent: SleeveCapStep }
  | { kind: 'unknown' };

export type SleeveCapSheet = {
  steps: readonly SleeveCapStep[];
  selected: SleeveCapStep;
  dollars: string | null;
  lower: string;
  confirm: string;
};

export type SleeveCapView = {
  showCapUi: boolean;
  buys: 'open' | 'paused';
  emitsSell: false;
  editCap: string | null;
  raiseCap: string | null;
  emptyLine: string | null;
  bar: { fill: number } | null;
  status: string | null;
  ofTotal: string | null;
  notice: { title: string; body: string } | null;
  sheet: SleeveCapSheet | null;
  position: 'under' | 'near' | 'at' | 'over' | null;
};

export type SleeveCapRefusal = {
  kind: 'exceeded' | 'paused' | 'wallet';
  heading: string;
  body: string;
  seeHoldings: string | null;
  raiseCap: string | null;
  emitsSell: false;
};

const HIDDEN: SleeveCapView = {
  showCapUi: false,
  buys: 'paused',
  emitsSell: false,
  editCap: null,
  raiseCap: null,
  emptyLine: null,
  bar: null,
  status: null,
  ofTotal: null,
  notice: null,
  sheet: null,
  position: null,
};

export function isSleeveCapStep(value: unknown): value is SleeveCapStep {
  return SLEEVE_CAP_STEPS.some((step) => step === value);
}

export function presentSleeveCap(
  read: HomeBookRead,
  server: SleeveCapRead,
  previewStep?: SleeveCapStep | null,
): SleeveCapView {
  if (server.kind !== 'known') return HIDDEN;
  const selected = isSleeveCapStep(previewStep)
    ? previewStep
    : server.capPercent;
  const priced = completeBook(read);
  const sheetBase = {
    steps: SLEEVE_CAP_STEPS,
    selected,
    lower: sleeveCapCopy.capSheetLower,
    confirm: sleeveCapCopy.confirm,
  };
  if (!priced) {
    return {
      showCapUi: true,
      buys: 'paused',
      emitsSell: false,
      editCap: sleeveCapCopy.editCap,
      raiseCap: sleeveCapCopy.raiseCap,
      emptyLine: sleeveCapCopy.emptyLine,
      bar: null,
      status: null,
      ofTotal: null,
      notice: {
        title: sleeveCapCopy.pausedTitle,
        body: sleeveCapCopy.pausedBody,
      },
      sheet: { ...sheetBase, dollars: null },
      position: null,
    };
  }
  const capCents = (priced.book * BigInt(server.capPercent)) / 100n;
  const previewCents = (priced.book * BigInt(selected)) / 100n;
  // A measured $0 book has no position. 0 === 0 is not at-cap. The server
  // cap comparison is not reached without a positive held input, so this
  // screen does not pause buys here.
  const position =
    priced.book === 0n ? null : positionOf(priced.sleeve, capCents);
  const ofTotal =
    priced.book > 0n
      ? sleeveCapCopy.ofTotal(String((priced.sleeve * 100n) / priced.book))
      : null;
  const left = capCents - priced.sleeve;
  return {
    showCapUi: true,
    buys:
      position === 'under' || position === 'near' || position === null
        ? 'open'
        : 'paused',
    emitsSell: false,
    editCap: sleeveCapCopy.editCap,
    raiseCap: sleeveCapCopy.raiseCap,
    emptyLine: sleeveCapCopy.emptyLine,
    bar: position === null ? null : { fill: fillOf(priced.sleeve, capCents) },
    status:
      position === 'near'
        ? sleeveCapCopy.leftUnderCap(formatCents(left < 0n ? 0n : left))
        : position === 'under'
          ? sleeveCapCopy.underCap
          : position === null
            ? null
            : sleeveCapCopy.atCap,
    ofTotal,
    notice:
      position === 'over'
        ? {
            title: sleeveCapCopy.pausedTitle,
            body: sleeveCapCopy.overByPrice,
          }
        : position === 'at'
          ? {
              title: sleeveCapCopy.pausedTitle,
              body: sleeveCapCopy.pausedBody,
            }
          : null,
    sheet: {
      ...sheetBase,
      dollars: formatCents(previewCents),
    },
    position,
  };
}

export function decideSleeveBuy(args: {
  section: HoldingSection;
  walletType: SessionType | null;
  cap: SleeveCapRead;
  read: HomeBookRead;
}):
  | { allow: true; emitsSell: false }
  | { allow: false; emitsSell: false; refusal: SleeveCapRefusal } {
  if (args.section !== 'sleeve') return { allow: true, emitsSell: false };
  if (args.walletType !== 'privy_embedded') {
    return { allow: false, emitsSell: false, refusal: walletRefusal() };
  }
  const view = presentSleeveCap(args.read, args.cap);
  if (view.buys === 'open') return { allow: true, emitsSell: false };
  if (view.position === 'at' || view.position === 'over') {
    return { allow: false, emitsSell: false, refusal: exceededRefusal() };
  }
  return { allow: false, emitsSell: false, refusal: pausedRefusal() };
}

export function mapSleeveCapServerCode(code: string): SleeveCapRefusal | null {
  switch (code) {
    case 'sleeve_cap_exceeded':
      return exceededRefusal();
    case 'sleeve_cap_unknown':
    case 'sleeve_book_unreadable':
      return pausedRefusal();
    case 'swap_owner_mismatch':
      return {
        kind: 'paused',
        heading: sleeveCapCopy.pausedTitle,
        body: '',
        seeHoldings: null,
        raiseCap: null,
        emitsSell: false,
      };
    default:
      return null;
  }
}

function walletRefusal(): SleeveCapRefusal {
  return {
    kind: 'wallet',
    heading: sleeveCapCopy.walletUnavailable,
    body: '',
    seeHoldings: null,
    raiseCap: null,
    emitsSell: false,
  };
}

function pausedRefusal(): SleeveCapRefusal {
  return {
    kind: 'paused',
    heading: sleeveCapCopy.pausedTitle,
    body: sleeveCapCopy.pausedBody,
    seeHoldings: null,
    raiseCap: null,
    emitsSell: false,
  };
}

function exceededRefusal(): SleeveCapRefusal {
  return {
    kind: 'exceeded',
    heading: sleeveCapCopy.pausedTitle,
    body: sleeveCapCopy.pausedBody,
    seeHoldings: sleeveCapCopy.seeHoldings,
    raiseCap: sleeveCapCopy.raiseCap,
    emitsSell: false,
  };
}

function positionOf(
  sleeve: bigint,
  cap: bigint,
): 'under' | 'near' | 'at' | 'over' {
  if (sleeve > cap) return 'over';
  // Equality at a $0 cap amount is not "at". A positive cap still is.
  if (cap !== 0n && sleeve === cap) return 'at';
  if (cap > 0n && sleeve * 100n >= cap * 80n) return 'near';
  return 'under';
}

function fillOf(sleeve: bigint, cap: bigint): number {
  if (cap <= 0n) return 1;
  const ratio = Number(sleeve) / Number(cap);
  if (!Number.isFinite(ratio) || ratio <= 0) return 0;
  return ratio >= 1 ? 1 : ratio;
}

function completeBook(
  read: HomeBookRead,
): { book: bigint; sleeve: bigint } | null {
  if (
    read.status !== 'fully_priced' &&
    read.status !== 'zero'
  ) {
    return null;
  }
  const holdings = read.holdings;
  if (!holdings || holdings.quantityStatus !== 'ready') return null;
  if (holdings.cluster !== 'mainnet-beta' && holdings.cluster !== 'devnet') {
    return null;
  }
  const priced = new Map(read.result.lines.map((line) => [line.mint, line]));
  let book = 0n;
  let sleeve = 0n;
  for (const line of holdings.lines) {
    if (!isHeld(line)) continue;
    const section = classifyHolding(line, holdings.cluster);
    if (section === 'hidden') continue;
    const cents = centsOf(priced.get(line.mint));
    if (cents === null) return null;
    book += cents;
    if (section === 'sleeve') sleeve += cents;
  }
  if (sleeve > book) return null;
  return { book, sleeve };
}

function isHeld(line: HoldingLine): boolean {
  try {
    return BigInt(line.atomic) > 0n;
  } catch {
    return false;
  }
}

function centsOf(result: FiatLineResult | undefined): bigint | null {
  if (!result?.priced || result.fiatAmount == null) return null;
  const match = /^(\d+)\.(\d{2})$/.exec(result.fiatAmount);
  if (!match?.[1] || !match[2]) return null;
  return BigInt(match[1]) * 100n + BigInt(match[2]);
}

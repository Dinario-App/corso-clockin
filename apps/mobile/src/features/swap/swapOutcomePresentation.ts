import { copy } from '@/constants/copy';

export type SwapFailKind = 'not-enough' | 'price-moved' | 'blocked';

export type SwapFailPresentation = {
  kind: SwapFailKind;
  title: string;
  body: string;
};

export function resolveSwapFailPresentation(message: string): SwapFailPresentation {
  const lower = message.toLowerCase();
  if (
    lower.includes('insufficient') ||
    lower.includes('not enough') ||
    lower.includes('leave a little sol')
  ) {
    return {
      kind: 'not-enough',
      title: copy.v1.notEnoughSol,
      body: copy.v1.addMoneyThenAsk,
    };
  }
  if (
    lower.includes('quote changed') ||
    lower.includes('price moved') ||
    lower.includes('slippage')
  ) {
    return {
      kind: 'price-moved',
      title: copy.v1.priceMoved,
      body: copy.v1.nothingMoved,
    };
  }
  return {
    kind: 'blocked',
    title: copy.v1.thatDidntGoThrough,
    body: copy.v1.nothingMoved,
  };
}

export function formatGroupedDisplayAmount(amount: string): string {
  const [whole, fraction] = amount.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return fraction != null && fraction.length > 0
    ? `${grouped}.${fraction}`
    : grouped;
}

/** Compose-time Review only jumps to a fail frame for an insufficient balance. */
export function composeShowsFailFrame(message: string): boolean {
  return resolveSwapFailPresentation(message).kind === 'not-enough';
}

export function resolveShareThisMessage(args: {
  headline: string;
  sourceText: string | null;
  movedLabel: string;
  moved: string;
}): string {
  if (args.sourceText) return `${args.headline}\n${args.sourceText}`;
  return `${args.headline}\n${args.movedLabel}: ${args.moved}`;
}

export function resolveSignedReceipt(args: {
  outAmount: string;
  receiveSymbol: string;
  payOut: string;
  feeLabel: string;
}): { title: string; headline: string; moved: string; fee: string } {
  return {
    title: copy.v1.donePeriod,
    headline: copy.v1.youGot(args.outAmount, args.receiveSymbol),
    moved: args.payOut,
    fee: args.feeLabel,
  };
}

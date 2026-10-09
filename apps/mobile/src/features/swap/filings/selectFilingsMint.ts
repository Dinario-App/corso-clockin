export type FilingsRiskLeg = 'pay' | 'receive';

/**
 * The mint Review asks EDGAR about: the subject leg. A buy asks about what
 * you receive. A sell asks about what you pay. The server omits when that
 * mint is not an equity proxy.
 */
export function selectFilingsMint(args: {
  payMint: string;
  receiveMint: string;
  riskLeg: FilingsRiskLeg;
}): string {
  switch (args.riskLeg) {
    case 'pay':
      return args.payMint;
    case 'receive':
      return args.receiveMint;
    default: {
      const neverLeg: never = args.riskLeg;
      return neverLeg;
    }
  }
}

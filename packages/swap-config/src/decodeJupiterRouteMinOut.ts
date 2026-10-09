/**
 * Deterministic, offline decoder for Jupiter Aggregator v6 route instruction
 * fixed fields (in / quoted_out / slippage).
 *
 * Official primary sources used for semantics:
 * - Anchor disc: sha256("global:route_v2")[0..8] = bb64facc31c4af14
 * - jup-ag/rfq-v2-sdk aggregator IDL/source pinned at
 *   8a2437d142c4c5e6cf9966e6e03de28963ce016d: route_v2 fixed args are
 *   inAmount, quotedOutAmount, slippageBps, platformFeeBps,
 *   positiveSlippageBps, routePlan; fixed account roles are also published.
 * - developers.jup.ag Metis swap docs: program builds serialized swap; min-out is
 *   enforced inside the aggregator program via CPI, not as a client-visible outer
 *   SPL TransferChecked of the output mint.
 *
 * Fail-closed: unknown discriminators and short buffers return null (never guess).
 * Does NOT by itself authorize signing — destination/mint/authority binding is separate.
 */

export const JUPITER_V6_PROGRAM_ID =
  'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4';

/** Anchor discriminators for known exact-in route entrypoints (hex). */
export const JUPITER_ROUTE_DISCS = {
  /** global:route */
  route: 'e517cb977ae3ad2a',
  /** global:shared_accounts_route */
  sharedAccountsRoute: 'c1209b3341d69c81',
  routeV2: 'bb64facc31c4af14',
  /** global:shared_accounts_route_v2 */
  sharedAccountsRouteV2: 'd19853937cfed8e9',
} as const;

export type JupiterRouteKind = keyof typeof JUPITER_ROUTE_DISCS;

export type JupiterInstructionFamily = 'v1' | 'v2';

export type DecodedJupiterRouteMinOut = {
  kind: JupiterRouteKind;
  family: JupiterInstructionFamily;
  discriminatorHex: string;
  /** Exact-in amount committed in instruction data (base units). */
  inAmount: bigint;
  /** Quoted out amount committed in instruction data (base units). */
  quotedOutAmount: bigint;
  /** Slippage bps committed in instruction data. */
  slippageBps: number;
  platformFeeBps: number;
  /**
   * v2 only. The v1 IDL has no `positive_slippage_bps` arg at all, so this is
   * `null` on the v1 family — never 0, because 0 would read as "proven zero"
   * to a caller comparing against a reviewed value.
   */
  positiveSlippageBps: number | null;
  routePlanLength: number;
  /** Ceiling min-out used by Jupiter ExactIn quotes. */
  impliedMinOut: bigint;
  /** Raw data length (bytes). */
  dataLength: number;
  /** True only after the complete pinned RoutePlanStepV2 vector is decoded. */
  hasRoutePlanTail: boolean;
};

type RoutePlanStep = {
  bps: number;
  inputIndex: number;
  outputIndex: number;
};

class BorshCursor {
  offset: number;

  constructor(
    readonly data: Uint8Array,
    offset = 0,
  ) {
    this.offset = offset;
  }

  remaining(): number {
    return this.data.length - this.offset;
  }

  skip(length: number): boolean {
    if (!Number.isSafeInteger(length) || length < 0 || this.remaining() < length) {
      return false;
    }
    this.offset += length;
    return true;
  }

  u8(): number | null {
    if (this.remaining() < 1) return null;
    return this.data[this.offset++]!;
  }

  u16(): number | null {
    if (this.remaining() < 2) return null;
    const value = readU16LE(this.data, this.offset);
    this.offset += 2;
    return value;
  }

  u32(): number | null {
    if (this.remaining() < 4) return null;
    const value = readU32LE(this.data, this.offset);
    this.offset += 4;
    return value;
  }
}

function decodeBool(cursor: BorshCursor): boolean {
  const value = cursor.u8();
  return value === 0 || value === 1;
}

function decodeRemainingAccountsInfo(cursor: BorshCursor): boolean {
  const length = cursor.u32();
  if (length == null || length > 64) return false;
  for (let index = 0; index < length; index += 1) {
    const accountsType = cursor.u8();
    const accountLength = cursor.u8();
    if (accountsType == null || accountLength == null || accountLength === 0) {
      return false;
    }
  }
  return true;
}

type SwapField = 'bool' | 'u8' | 'u16' | 'u32' | 'u64' | 'u128'
  | { enum: readonly (readonly SwapField[])[] }
  | { struct: readonly SwapField[] }
  | { vec: SwapField }
  | { option: SwapField }
  | { array: readonly [SwapField, number] };
const SWAP_VARIANT_FIELDS: readonly (readonly SwapField[])[] = [
  [], // 0 Saber
  [], // 1 SaberAddDecimalsDeposit
  [], // 2 SaberAddDecimalsWithdraw
  [], // 3 TokenSwap
  [], // 4 Sencha
  [], // 5 Step
  [], // 6 Cropper
  [], // 7 Raydium
  ["bool"], // 8 Crema
  [], // 9 Lifinity
  [], // 10 Mercurial
  [], // 11 Cykura
  [{ enum: [[], []] }], // 12 Serum
  [], // 13 MarinadeDeposit
  [], // 14 MarinadeUnstake
  [{ enum: [[], []] }], // 15 Aldrin
  [{ enum: [[], []] }], // 16 AldrinV2
  ["bool"], // 17 Whirlpool
  ["bool"], // 18 Invariant
  [], // 19 Meteora
  [], // 20 GooseFX
  ["bool"], // 21 DeltaFi
  [], // 22 Balansol
  ["bool"], // 23 MarcoPolo
  [{ enum: [[], []] }], // 24 Dradex
  [], // 25 LifinityV2
  [], // 26 RaydiumClmm
  [{ enum: [[], []] }], // 27 Openbook
  [{ enum: [[], []] }], // 28 Phoenix
  ["u64", "u64"], // 29 Symmetry
  [], // 30 TokenSwapV2
  [], // 31 HeliumTreasuryManagementRedeemV0
  [], // 32 StakeDexStakeWrappedSol
  ["u32"], // 33 StakeDexSwapViaStake
  [], // 34 GooseFXV2
  [], // 35 Perps
  [], // 36 PerpsAddLiquidity
  [], // 37 PerpsRemoveLiquidity
  [], // 38 MeteoraDlmm
  [{ enum: [[], []] }], // 39 OpenBookV2
  [], // 40 RaydiumClmmV2
  ["u32"], // 41 StakeDexPrefundWithdrawStakeAndDepositStake
  ["u8", "bool", "bool"], // 42 Clone
  ["u8", "u8", "u32", "u32"], // 43 SanctumS
  ["u8", "u32"], // 44 SanctumSAddLiquidity
  ["u8", "u32"], // 45 SanctumSRemoveLiquidity
  [], // 46 RaydiumCP
  ["bool", { option: { struct: [{ vec: { struct: ["u8", "u8"] } }] } }], // 47 WhirlpoolSwapV2
  [], // 48 OneIntro
  [], // 49 PumpWrappedBuy
  [], // 50 PumpWrappedSell
  [], // 51 PerpsV2
  [], // 52 PerpsV2AddLiquidity
  [], // 53 PerpsV2RemoveLiquidity
  [], // 54 MoonshotWrappedBuy
  [], // 55 MoonshotWrappedSell
  [], // 56 StabbleStableSwap
  [], // 57 StabbleWeightedSwap
  ["bool"], // 58 Obric
  [], // 59 FoxBuyFromEstimatedCost
  ["bool"], // 60 FoxClaimPartial
  ["bool"], // 61 SolFi
  [], // 62 SolayerDelegateNoInit
  [], // 63 SolayerUndelegateNoInit
  [{ enum: [[], []] }], // 64 TokenMill
  [], // 65 DaosFunBuy
  [], // 66 DaosFunSell
  [], // 67 ZeroFi
  [], // 68 StakeDexWithdrawWrappedSol
  [], // 69 VirtualsBuy
  [], // 70 VirtualsSell
  ["u8", "u8"], // 71 Perena
  [], // 72 PumpSwapBuy
  [], // 73 PumpSwapSell
  [], // 74 Gamma
  [{ struct: [{ vec: { struct: ["u8", "u8"] } }] }], // 75 MeteoraDlmmSwapV2
  [], // 76 Woofi
  [], // 77 MeteoraDammV2
  [], // 78 MeteoraDynamicBondingCurveSwap
  [], // 79 StabbleStableSwapV2
  [], // 80 StabbleWeightedSwapV2
  ["u64"], // 81 RaydiumLaunchlabBuy
  ["u64"], // 82 RaydiumLaunchlabSell
  [], // 83 BoopdotfunWrappedBuy
  [], // 84 BoopdotfunWrappedSell
  [{ enum: [[], []] }], // 85 Plasma
  ["bool", "u8"], // 86 GoonFi
  ["u64", "bool"], // 87 HumidiFi
  [], // 88 MeteoraDynamicBondingCurveSwapWithRemainingAccounts
  [{ enum: [[], []] }], // 89 TesseraV
  [], // 90 PumpWrappedBuyV2
  [], // 91 PumpWrappedSellV2
  [], // 92 PumpSwapBuyV2
  [], // 93 PumpSwapSellV2
  ["bool"], // 94 Heaven
  ["bool"], // 95 SolFiV2
  [], // 96 Aquifer
  [], // 97 PumpWrappedBuyV3
  [], // 98 PumpWrappedSellV3
  [], // 99 PumpSwapBuyV3
  [], // 100 PumpSwapSellV3
  [], // 101 JupiterLendDeposit
  [], // 102 JupiterLendRedeem
  ["bool", { option: { struct: [{ vec: { struct: ["u8", "u8"] } }] } }], // 103 DefiTuna
  ["bool"], // 104 AlphaQ
  [], // 105 RaydiumV2
  ["bool"], // 106 SarosDlmm
  [{ enum: [[], []] }], // 107 Futarchy
  [], // 108 MeteoraDammV2WithRemainingAccounts
  [], // 109 Obsidian
  [{ enum: [[], []] }], // 110 WhaleStreet
  [{ vec: { enum: [["u64", "bool"], [{ enum: [[], []] }], ["u64", "bool"], [], [], ["bool"], [], ["bool"], ["bool"], ["bool"], ["bool", { option: { struct: [{ vec: { struct: ["u8", "u8"] } }] } }], [], ["bool"], [], [{ enum: [[], []] }], ["u64", { array: ["u8", 32] }, { array: ["u8", 16] }, "bool"], ["u64", "u64", { array: ["u8", 32] }, { array: ["u8", 16] }, "bool"]] } }, { option: "u8" }], // 111 DynamicV1
  [], // 112 PumpWrappedBuyV4
  [], // 113 PumpWrappedSellV4
  [], // 114 CarrotIssue
  [], // 115 CarrotRedeem
  [{ enum: [[], []] }], // 116 Manifest
  ["bool"], // 117 BisonFi
  ["u64", "bool"], // 118 HumidiFiV2
  ["bool"], // 119 PerenaStar
  [{ enum: [[], []] }, { vec: "u8" }], // 120 JupiterRfqV2
  ["bool"], // 121 GoonFiV2
  ["u128"], // 122 Scorch
  [{ array: ["u64", 5] }, "u64"], // 123 VaultLiquidUnstake
  [], // 124 XOrca
  [{ enum: [[], []] }], // 125 Quantum
  [{ enum: [[], []] }, "u64", "u64"], // 126 WhaleStreetV2
  ["bool"], // 127 Riptide
  [], // 128 RunnerRodeo
  ["bool"], // 129 TaurusFi
  [], // 130 Omnipair
  [], // 131 MSwap
  [{ enum: [[], [], [], [], [], [], [], []] }], // 132 Hylo
  [], // 133 VoltrDeposit
  [], // 134 VoltrWithdraw
  ["u8", "u8", "u32", "u32"], // 135 SanctumSV2
  ["bool"], // 136 LemmingsFi
  [], // 137 ScaleVmmBuy
  [], // 138 ScaleVmmSell
  [], // 139 ScaleAmmBuy
  [], // 140 ScaleAmmSell
  ["bool"], // 141 BisonFiV2
  [], // 142 Trends
  [], // 143 HumaDeposit
  [], // 144 HumaInstantWithdraw
  ["bool"], // 145 Kipseli
  [{ vec: { struct: [{ enum: [["u64", "bool"], [{ enum: [[], []] }], ["u64", "bool"], [], [], ["bool"], [], ["bool"], ["bool"], ["bool"], ["bool", { option: { struct: [{ vec: { struct: ["u8", "u8"] } }] } }], [], ["bool"], [], [{ enum: [[], []] }], ["u64", { array: ["u8", 32] }, { array: ["u8", 16] }, "bool"], ["u64", "u64", { array: ["u8", 32] }, { array: ["u8", 16] }, "bool"]] }, "u32"] } }, "u8", "u8"], // 146 DynamicV2
  [], // 147 PumpSwapBuyV3WithCashbackClaim
  [], // 148 PumpSwapSellV3WithCashbackClaim
  [], // 149 PumpWrappedBuyV4WithCashbackClaim
  [], // 150 PumpWrappedSellV4WithCashbackClaim
  ["bool"], // 151 GoonFiV3
  ["bool"], // 152 PumpWrappedBuyV5
  ["bool"], // 153 PumpWrappedSellV5
  [], // 154 ZeroFiSwapV2
  [{ enum: [[], []] }, "bool"], // 155 BisonFiPredict
  [], // 156 ByrealDynamicV3
  ["u64", "bool"], // 157 Flux
  [], // 158 VaultLiquidSellLst
  ["u64"], // 159 VaultLiquidBuyLst
  ["bool"], // 160 KipseliV2
  [{ enum: [[], []] }, "u32"], // 161 Deriverse
  ["bool"], // 162 Hadron
  [], // 163 BinaryFi
  ["bool"], // 164 Metric
  ["bool"], // 165 JupiterLendDexSwap
  ["bool"], // 166 Gatorswap
  ["bool", "bool"], // 167 Flint
  ["bool"], // 168 Denali
  [], // 169 PerenaStarV2Deposit
  ["u8"], // 170 PerenaStarV2WithdrawFromExternal
  [{ enum: [[], [], []] }], // 171 SanctumSols
  [{ enum: [[], [], [], [], [], [], [], []] }], // 172 HyloV2
  [], // 173 SanctumPamm
  [{ enum: [[], []] }], // 174 Archer
  [], // 175 TrenchWrappedBuy
  [], // 176 TrenchWrappedSell
  ["bool"], // 177 BisonFiMarketBacked
  [{ enum: [[], []] }], // 178 TesseraVV2
  [], // 179 Stableswap
  [], // 180 BinaryFiV2
  ["bool"], // 181 KipseliV3
  [{ enum: [[], []] }], // 182 PerenaStarV2TrancheDeposit
  [{ enum: [[], []] }, { option: "u8" }], // 183 PerenaStarV2TrancheWithdrawFromExternal
  ["bool"], // 184 Quay
  ["u64", { array: ["u8", 32] }, { array: ["u8", 16] }, "bool"], // 185 HumidiFiRouter
  ["u64", "u64", { array: ["u8", 32] }, { array: ["u8", 16] }, "bool"], // 186 HumidiFiRouterV2
  ["bool", "bool"], // 187 PumpWrappedBuyV6
];

function decodeSwapField(cursor: BorshCursor, field: SwapField): boolean {
  if (typeof field === 'string') {
    if (field === 'bool') return decodeBool(cursor);
    return cursor.skip({u8: 1, u16: 2, u32: 4, u64: 8, u128: 16}[field]);
  }
  if ('enum' in field) {
    const tag = cursor.u8();
    const fields = tag == null ? undefined : field.enum[tag];
    return fields !== undefined && fields.every((item) => decodeSwapField(cursor, item));
  }
  if ('struct' in field) return field.struct.every((item) => decodeSwapField(cursor, item));
  if ('option' in field) {
    const tag = cursor.u8();
    return tag === 0 || (tag === 1 && decodeSwapField(cursor, field.option));
  }
  const length = 'array' in field ? field.array[1] : cursor.u32();
  if (length == null || length > 1_232) return false;
  const item = 'array' in field ? field.array[0] : field.vec;
  for (let index = 0; index < length; index += 1) {
    if (!decodeSwapField(cursor, item)) return false;
  }
  return true;
}

function decodeSwapPayload(cursor: BorshCursor, tag: number): boolean {
  const fields = SWAP_VARIANT_FIELDS[tag];
  return fields !== undefined && fields.every((field) => decodeSwapField(cursor, field));
}

function decodeRoutePlan(
  data: Uint8Array,
  offset: number,
  length: number,
): { steps: RoutePlanStep[]; endOffset: number } | null {
  const cursor = new BorshCursor(data, offset);
  const steps: RoutePlanStep[] = [];
  for (let index = 0; index < length; index += 1) {
    const swapTag = cursor.u8();
    if (swapTag == null || !decodeSwapPayload(cursor, swapTag)) return null;
    const bps = cursor.u16();
    const inputIndex = cursor.u8();
    const outputIndex = cursor.u8();
    if (
      bps == null ||
      inputIndex == null ||
      outputIndex == null ||
      bps < 1 ||
      bps > 10_000 ||
      inputIndex === outputIndex
    ) {
      return null;
    }
    steps.push({ bps, inputIndex, outputIndex });
  }

  // Jupiter's pinned decoder documents a single RemainingAccountsInfo value
  // after the route args. Refuse any other trailing bytes.
  if (cursor.remaining() > 0 && !decodeRemainingAccountsInfo(cursor)) return null;
  if (cursor.remaining() !== 0) return null;
  return { steps, endOffset: cursor.offset };
}

type RoutePlanStepV1 = {
  percent: number;
  inputIndex: number;
  outputIndex: number;
};

function decodeRoutePlanV1(
  cursor: BorshCursor,
  length: number,
): RoutePlanStepV1[] | null {
  const steps: RoutePlanStepV1[] = [];
  for (let index = 0; index < length; index += 1) {
    const swapTag = cursor.u8();
    if (swapTag == null || !decodeSwapPayload(cursor, swapTag)) return null;
    const percent = cursor.u8();
    const inputIndex = cursor.u8();
    const outputIndex = cursor.u8();
    if (
      percent == null ||
      inputIndex == null ||
      outputIndex == null ||
      percent < 1 ||
      percent > 100 ||
      inputIndex === outputIndex
    ) {
      return null;
    }
    steps.push({ percent, inputIndex, outputIndex });
  }
  return steps;
}

/**
 * Fail-closed v1 topology: source index 0, a unique final output sink, a contiguous
 * acyclic graph, and exact 100-PERCENT conservation at each node.
 *
 * Deliberately a separate function from `hasValidRouteTopology`: reusing the
 * bps validator on percent data would accept a plan that routes 1% of the
 * input and silently discards the rest.
 */
function hasValidRouteTopologyV1(steps: RoutePlanStepV1[]): boolean {
  // Live V1 plans number sequential hops 0 -> 1 -> 2 -> ...; final output
  // is the unique sink, not necessarily node 1. Mint/account binding remains
  // the caller's separate signing gate; this proves graph conservation only.
  const consumedNodes = new Set(steps.map((step) => step.inputIndex));
  const terminalNodes = [...new Set(steps.map((step) => step.outputIndex))]
    .filter((node) => !consumedNodes.has(node));
  if (terminalNodes.length !== 1) return false;
  return hasValidWeightedTopology(
    steps.map((step) => ({
      weight: step.percent,
      inputIndex: step.inputIndex,
      outputIndex: step.outputIndex,
    })),
    100,
    terminalNodes[0]!,
  );
}

/**
 * Fail-closed V2 topology: source index 0, a unique final output sink, a
 * contiguous acyclic graph, and exact 10_000-bps conservation at each node.
 */
function hasValidRouteTopology(steps: RoutePlanStep[]): boolean {
  // Deployed V2 multi-hop plans number their terminal node 2, 3, ... .
  // Mint/account binding remains the caller's independent signing gate.
  const consumedNodes = new Set(steps.map((step) => step.inputIndex));
  const terminalNodes = [...new Set(steps.map((step) => step.outputIndex))]
    .filter((node) => !consumedNodes.has(node));
  if (terminalNodes.length !== 1) return false;
  return hasValidWeightedTopology(
    steps.map((step) => ({
      weight: step.bps,
      inputIndex: step.inputIndex,
      outputIndex: step.outputIndex,
    })),
    10_000,
    terminalNodes[0]!,
  );
}

type WeightedStep = {
  weight: number;
  inputIndex: number;
  outputIndex: number;
};

/**
 * Shared graph core. `total` is always supplied explicitly by the caller so a
 * percent plan can never be conserved against the bps total, or vice versa.
 */
function hasValidWeightedTopology(
  steps: WeightedStep[],
  total: number,
  finalOutputIndex = 1,
): boolean {
  const nodes = new Set<number>();
  const incoming = new Map<number, number>();
  const outgoing = new Map<number, number>();
  const adjacency = new Map<number, number[]>();
  const indegree = new Map<number, number>();

  for (const step of steps) {
    if (step.inputIndex > steps.length + 1 || step.outputIndex > steps.length + 1) {
      return false;
    }
    nodes.add(step.inputIndex);
    nodes.add(step.outputIndex);
    incoming.set(
      step.outputIndex,
      (incoming.get(step.outputIndex) ?? 0) + step.weight,
    );
    outgoing.set(
      step.inputIndex,
      (outgoing.get(step.inputIndex) ?? 0) + step.weight,
    );
    adjacency.set(step.inputIndex, [
      ...(adjacency.get(step.inputIndex) ?? []),
      step.outputIndex,
    ]);
    indegree.set(step.outputIndex, (indegree.get(step.outputIndex) ?? 0) + 1);
    indegree.set(step.inputIndex, indegree.get(step.inputIndex) ?? 0);
  }

  const maxNode = Math.max(...nodes);
  for (let index = 0; index <= maxNode; index += 1) {
    if (!nodes.has(index)) return false;
  }
  if (
    incoming.has(0) ||
    outgoing.has(finalOutputIndex) ||
    outgoing.get(0) !== total ||
    incoming.get(finalOutputIndex) !== total
  ) {
    return false;
  }
  for (const node of nodes) {
    if (node !== 0 && node !== finalOutputIndex && incoming.get(node) !== outgoing.get(node)) {
      return false;
    }
  }

  // Kahn traversal rejects cycles and disconnected route-plan components.
  const queue = [...nodes].filter((node) => (indegree.get(node) ?? 0) === 0);
  let visited = 0;
  while (queue.length > 0) {
    const node = queue.shift()!;
    visited += 1;
    for (const next of adjacency.get(node) ?? []) {
      const nextIndegree = (indegree.get(next) ?? 0) - 1;
      indegree.set(next, nextIndegree);
      if (nextIndegree === 0) queue.push(next);
    }
  }
  return visited === nodes.size;
}

function discHex(data: Uint8Array): string {
  if (data.length < 8) return '';
  let out = '';
  for (let i = 0; i < 8; i++) {
    out += data[i]!.toString(16).padStart(2, '0');
  }
  return out;
}

function readU64LE(data: Uint8Array, offset: number): bigint {
  const view = new DataView(data.buffer, data.byteOffset + offset, 8);
  return view.getBigUint64(0, true);
}

function readU16LE(data: Uint8Array, offset: number): number {
  return data[offset]! | (data[offset + 1]! << 8);
}

function readU32LE(data: Uint8Array, offset: number): number {
  return (
    data[offset]! |
    (data[offset + 1]! << 8) |
    (data[offset + 2]! << 16) |
    (data[offset + 3]! << 24)
  ) >>> 0;
}

function kindForDisc(hex: string): JupiterRouteKind | null {
  for (const [kind, value] of Object.entries(JUPITER_ROUTE_DISCS) as [
    JupiterRouteKind,
    string,
  ][]) {
    if (value === hex) return kind;
  }
  return null;
}

/**
 * Compute the ExactIn threshold shown by Jupiter's pinned quote example:
 * ceil(quoted amount * (10_000 - slippage bps) / 10_000).
 * Fail-closed: invalid slippage returns null.
 */
export function impliedMinOutFromQuote(
  quotedOutAmount: bigint,
  slippageBps: number,
): bigint | null {
  if (quotedOutAmount < 0n) return null;
  if (!Number.isInteger(slippageBps) || slippageBps < 0 || slippageBps > 10_000) {
    return null;
  }
  const numerator = quotedOutAmount * BigInt(10_000 - slippageBps);
  return (numerator + 9_999n) / 10_000n;
}

export function decodeJupiterRouteMinOut(
  data: Uint8Array,
): DecodedJupiterRouteMinOut | null {
  const discriminatorHexEarly = discHex(data);
  const kindEarly = kindForDisc(discriminatorHexEarly);
  if (kindEarly === 'route' || kindEarly === 'sharedAccountsRoute') {
    return decodeJupiterV1Route(data, kindEarly, discriminatorHexEarly);
  }

  const argsOffset = 8 + (kindEarly === 'sharedAccountsRouteV2' ? 1 : 0);
  const fixedEnvelopeLength = argsOffset + 8 + 8 + 2 + 2 + 2 + 4;
  if (data.length < fixedEnvelopeLength) return null;
  const discriminatorHex = discriminatorHexEarly;
  const kind = kindEarly;
  if (!kind) return null;

  if (kind !== 'routeV2' && kind !== 'sharedAccountsRouteV2') {
    return null;
  }

  const inAmount = readU64LE(data, argsOffset);
  const quotedOutAmount = readU64LE(data, argsOffset + 8);
  const slippageBps = readU16LE(data, argsOffset + 16);
  const platformFeeBps = readU16LE(data, argsOffset + 18);
  const positiveSlippageBps = readU16LE(data, argsOffset + 20);
  const routePlanLength = readU32LE(data, argsOffset + 22);
  if (
    inAmount <= 0n ||
    quotedOutAmount <= 0n ||
    platformFeeBps > 10_000 ||
    positiveSlippageBps > 10_000 ||
    routePlanLength < 1 ||
    routePlanLength > 64
  ) {
    return null;
  }
  const routePlan = decodeRoutePlan(data, fixedEnvelopeLength, routePlanLength);
  if (!routePlan || !hasValidRouteTopology(routePlan.steps)) return null;
  const implied = impliedMinOutFromQuote(quotedOutAmount, slippageBps);
  if (implied == null) return null;

  return {
    kind,
    family: 'v2',
    discriminatorHex,
    inAmount,
    quotedOutAmount,
    slippageBps,
    platformFeeBps,
    positiveSlippageBps,
    routePlanLength,
    impliedMinOut: implied,
    dataLength: data.length,
    hasRoutePlanTail: true,
  };
}

function decodeJupiterV1Route(
  data: Uint8Array,
  kind: 'route' | 'sharedAccountsRoute',
  discriminatorHex: string,
): DecodedJupiterRouteMinOut | null {
  // disc + [id] + plan_len + >=1 step + in + out + slippage + fee_bps
  const minimumLength =
    8 + (kind === 'sharedAccountsRoute' ? 1 : 0) + 4 + 4 + 8 + 8 + 2 + 1;
  if (data.length < minimumLength) return null;

  const cursor = new BorshCursor(data, 8);
  if (kind === 'sharedAccountsRoute' && cursor.u8() == null) return null;

  const routePlanLength = cursor.u32();
  if (routePlanLength == null || routePlanLength < 1 || routePlanLength > 64) {
    return null;
  }
  const steps = decodeRoutePlanV1(cursor, routePlanLength);
  if (!steps || !hasValidRouteTopologyV1(steps)) return null;

  // Fixed args follow the plan. Exactly 19 bytes, and nothing after them.
  if (cursor.remaining() !== 8 + 8 + 2 + 1) return null;
  const inAmount = readU64LE(data, cursor.offset);
  const quotedOutAmount = readU64LE(data, cursor.offset + 8);
  const slippageBps = readU16LE(data, cursor.offset + 16);
  const platformFeeBps = data[cursor.offset + 18]!;
  if (
    inAmount <= 0n ||
    quotedOutAmount <= 0n ||
    slippageBps > 10_000 ||
    platformFeeBps > 255
  ) {
    return null;
  }
  const implied = impliedMinOutFromQuote(quotedOutAmount, slippageBps);
  if (implied == null) return null;

  return {
    kind,
    family: 'v1',
    discriminatorHex,
    inAmount,
    quotedOutAmount,
    slippageBps,
    platformFeeBps,
    positiveSlippageBps: null,
    routePlanLength,
    impliedMinOut: implied,
    dataLength: data.length,
    hasRoutePlanTail: true,
  };
}

export type OuterSwapShapeSummary = {
  outerInstructionCount: number;
  sawJupiterRouter: boolean;
  outerTokenTransferCheckedCount: number;
  outerOutputMintTransferCheckedCount: number;
  outerOutputCredits: bigint;
  jupiterRoute: DecodedJupiterRouteMinOut | null;
  jupiterProgramIdIndexes: number[];
};

export function summarizeOuterMinOutProof(args: {
  instructions: Array<{
    programId: string;
    data: Uint8Array;
    /** Mint pubkey for TransferChecked, if decoded as such. */
    transferCheckedMint?: string;
    transferCheckedAmount?: bigint;
  }>;
  outputMint: string;
}): OuterSwapShapeSummary {
  let sawJupiterRouter = false;
  let outerTokenTransferCheckedCount = 0;
  let outerOutputMintTransferCheckedCount = 0;
  let outerOutputCredits = 0n;
  let jupiterRoute: DecodedJupiterRouteMinOut | null = null;
  const jupiterProgramIdIndexes: number[] = [];

  args.instructions.forEach((ix, index) => {
    if (ix.programId === JUPITER_V6_PROGRAM_ID) {
      sawJupiterRouter = true;
      jupiterProgramIdIndexes.push(index);
      if (!jupiterRoute) {
        jupiterRoute = decodeJupiterRouteMinOut(ix.data);
      }
    }
    if (ix.transferCheckedAmount != null) {
      outerTokenTransferCheckedCount += 1;
      if (ix.transferCheckedMint === args.outputMint) {
        outerOutputMintTransferCheckedCount += 1;
        outerOutputCredits += ix.transferCheckedAmount;
      }
    }
  });

  return {
    outerInstructionCount: args.instructions.length,
    sawJupiterRouter,
    outerTokenTransferCheckedCount,
    outerOutputMintTransferCheckedCount,
    outerOutputCredits,
    jupiterRoute,
    jupiterProgramIdIndexes,
  };
}

import { PublicKey } from '@solana/web3.js';
import { associatedTokenAddress } from '@/src/features/security/ataAddress';
import {
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from '@/src/features/security/swapProgramAllowlist';

export function isReviewedCorsoFeeBps(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 50 && value <= 255;
}

/**
 * Pinned config env var naming the Corso fee authority (base58 pubkey).
 * The fee ATAs are the ATAs of this authority for each output mint.
 *
 * Until it is set, this returns null and every charged swap fails closed.
 */
export const CORSO_FEE_AUTHORITY_ENV = 'EXPO_PUBLIC_CORSO_FEE_AUTHORITY';

/**
 * Read the Corso fee authority from pinned config.
 * Returns null when unset or not a valid pubkey — never invents an address.
 */
export function corsoFeeAuthority(): string | null {
  // Expo only inlines EXPO_PUBLIC_* reads that use static dot notation.
  const raw = process.env.EXPO_PUBLIC_CORSO_FEE_AUTHORITY?.trim();
  if (!raw) return null;
  try {
    return new PublicKey(raw).toBase58();
  } catch {
    return null;
  }
}

/**
 * Offline-derived Corso fee ATA for a mint.
 *
 * The token program is part of the ATA PDA seeds. Callers authorizing a
 * Token-2022 path must pass the structurally reviewed Token-2022 program id;
 * the legacy default preserves existing Tokenkeg call sites.
 */
export function corsoFeeAta(args: {
  mint: string;
  authority: string;
  tokenProgramId?: typeof TOKEN_PROGRAM_ID | typeof TOKEN_2022_PROGRAM_ID;
}): string {
  return associatedTokenAddress({
    mint: args.mint,
    owner: args.authority,
    tokenProgramId: args.tokenProgramId ?? TOKEN_PROGRAM_ID,
  });
}

export function corsoFeeAmount(args: {
  outAmount: bigint;
  feeBps: number;
}): bigint {
  if (
    !Number.isInteger(args.feeBps) ||
    args.feeBps < 0 ||
    args.feeBps > 10_000
  ) {
    throw new Error('Invalid Corso fee bps');
  }
  if (args.outAmount < 0n) {
    throw new Error('Invalid Corso fee base amount');
  }
  return (args.outAmount * BigInt(args.feeBps)) / 10_000n;
}

/** Manual quote adapter: TokenFacts selects the token program used in ATA seeds. */
export function corsoManualOutputFeeAta(args: {
  mint: string;
  authority: string;
  tokenProgram: 'spl-token' | 'token-2022';
}): string {
  return corsoFeeAta({mint:args.mint,authority:args.authority,tokenProgramId:args.tokenProgram === 'token-2022' ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID});
}

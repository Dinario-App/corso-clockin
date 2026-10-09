import { PublicKey } from '@solana/web3.js';
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from '@/src/features/security/swapProgramAllowlist';

/** Associated Token Account PDA (Token Program or Token-2022). */
export function associatedTokenAddress(args: {
  mint: string;
  owner: string;
  tokenProgramId?: string;
}): string {
  const programId = new PublicKey(
    args.tokenProgramId ?? TOKEN_PROGRAM_ID,
  );
  const [address] = PublicKey.findProgramAddressSync(
    [
      new PublicKey(args.owner).toBuffer(),
      programId.toBuffer(),
      new PublicKey(args.mint).toBuffer(),
    ],
    new PublicKey(ASSOCIATED_TOKEN_PROGRAM_ID),
  );
  return address.toBase58();
}

export function userAtasForMint(args: {
  mint: string;
  owner: string;
}): Set<string> {
  return new Set([
    associatedTokenAddress({
      mint: args.mint,
      owner: args.owner,
      tokenProgramId: TOKEN_PROGRAM_ID,
    }),
    associatedTokenAddress({
      mint: args.mint,
      owner: args.owner,
      tokenProgramId: TOKEN_2022_PROGRAM_ID,
    }),
  ]);
}

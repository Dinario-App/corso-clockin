import { formatFiatAmount } from '@/src/ui/format/numberCraft';

export const COUNT_UP_DURATION_MS = 600;

function parseFiatCents(amount: string | null): bigint | null {
  if (amount == null) return null;
  const match = /^(0|[1-9]\d*)(?:\.(\d{1,2}))?$/.exec(amount);
  if (!match) return null;
  return BigInt(match[1]!) * 100n + BigInt((match[2] ?? '').padEnd(2, '0'));
}
function formatCents(cents: bigint): string {
  const whole = cents / 100n;
  const fraction = (cents % 100n).toString().padStart(2, '0');
  return formatFiatAmount(`${whole}.${fraction}`) ?? '$0.00';
}

export function resolveCountUpPresentation(input: {
  amount: string | null;
  reduceMotion: boolean;
}): { animated: boolean; durationMs: number; finalText: string | null } {
  const cents = parseFiatCents(input.amount);
  if (cents == null) {
    return { animated: false, durationMs: 0, finalText: null };
  }
  return {
    animated: !input.reduceMotion && cents > 0n,
    durationMs: !input.reduceMotion && cents > 0n ? COUNT_UP_DURATION_MS : 0,
    finalText: formatCents(cents),
  };
}

export function resolveCountUpFrame(
  amount: string | null,
  progress: number,
): string | null {
  const cents = parseFiatCents(amount);
  if (cents == null) return null;
  const clamped = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  const millionths = BigInt(Math.round(clamped * 1_000_000));
  const frame = (cents * millionths + 500_000n) / 1_000_000n;
  return formatCents(frame);
}

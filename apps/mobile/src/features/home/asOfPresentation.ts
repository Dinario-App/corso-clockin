import { copy } from '@/constants/copy';

const OBSERVATION_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

export function formatClosedBarStamp(
  asOfMs: number,
  nowMs: number,
): string | null {
  if (!Number.isFinite(asOfMs) || asOfMs < 0) return null;
  const observed = new Date(asOfMs);
  if (Number.isNaN(observed.getTime())) return null;
  const time = `${String(observed.getHours()).padStart(2, '0')}:${String(
    observed.getMinutes(),
  ).padStart(2, '0')}`;
  if (!Number.isFinite(nowMs)) return time;
  const now = new Date(nowMs);
  if (Number.isNaN(now.getTime())) return time;
  const sameDay =
    observed.getFullYear() === now.getFullYear() &&
    observed.getMonth() === now.getMonth() &&
    observed.getDate() === now.getDate();
  if (sameDay) return time;
  const month = OBSERVATION_MONTHS[observed.getMonth()];
  if (month == null) return time;
  return `${month} ${observed.getDate()}, ${time}`;
}

export function formatObservationClock(
  asOfMs: number,
  clock: '24h' | '12h' = '24h',
): string | null {
  if (!Number.isFinite(asOfMs) || asOfMs < 0) return null;
  const observed = new Date(asOfMs);
  if (Number.isNaN(observed.getTime())) return null;
  const hours = observed.getHours();
  const minutes = String(observed.getMinutes()).padStart(2, '0');
  if (clock === '12h') {
    return `${hours % 12 === 0 ? 12 : hours % 12}:${minutes} ${
      hours < 12 ? 'AM' : 'PM'
    }`;
  }
  return `${String(hours).padStart(2, '0')}:${minutes}`;
}

export function resolveHomeStaleMarker(args: {
  stale: boolean;
  staleAsOfMs: number | null;
}): string | null {
  if (!args.stale || args.staleAsOfMs == null) return null;
  const clock = formatObservationClock(args.staleAsOfMs);
  return clock == null ? null : copy.home.showingLastKnownAsOf(clock);
}

export function resolveMovingContext(asOfMs: number): string | null {
  const clock = formatObservationClock(asOfMs);
  return clock == null ? null : copy.moving.context(clock);
}

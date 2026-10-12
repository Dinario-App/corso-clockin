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
  return withObservationDay(time, observed, nowMs);
}

/**
 * Prefix `time` with the observation's day (`Oct 7, `) when it isn't from
 * today on the device. Today, or an unreadable `nowMs`, leaves `time` alone.
 */
function withObservationDay(
  time: string,
  observed: Date,
  nowMs: number,
): string {
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

/**
 * The observation clock, with the day added when the observation isn't from
 * today: `14:05` today, `Oct 7, 14:05` on any other day. `{time}` is always
 * the observation's own; `nowMs` only decides whether to name the day.
 */
export function formatObservationStamp(
  asOfMs: number,
  nowMs: number,
  clock: '24h' | '12h' = '24h',
): string | null {
  const time = formatObservationClock(asOfMs, clock);
  if (time == null) return null;
  return withObservationDay(time, new Date(asOfMs), nowMs);
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

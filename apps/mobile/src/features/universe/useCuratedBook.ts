import { useEffect, useMemo, useState } from 'react';
import {
  parseSeriousUniverse,
  type SeriousName,
} from '@/src/features/home/seriousUniverse';
import {
  composeCuratedBook,
  type CuratedBook,
} from '@/src/features/universe/curatedBook';

export const CURATED_BOOK_READ_DEADLINE_MS = 4000;

let deadlineMs = CURATED_BOOK_READ_DEADLINE_MS;
let served: Promise<SeriousName[] | null> | null = null;

function readServedNames(): Promise<SeriousName[] | null> {
  if (served) return served;
  const base = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/$/, '');
  if (!base) return Promise.resolve(null);
  const abort = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<null>((resolve) => {
    timer = setTimeout(() => {
      abort.abort();
      resolve(null);
    }, deadlineMs);
  });
  const fetched = fetch(`${base}/v1/universe/serious`, { signal: abort.signal })
    .then((response) => (response.ok ? response.json() : null))
    .then((body: unknown) => (body == null ? null : parseSeriousUniverse(body)))
    .catch(() => null);
  const read = Promise.race([fetched, deadline]).then((names) => {
    clearTimeout(timer);
    if (names == null && served === read) served = null;
    return names;
  });
  served = read;
  return read;
}

/** Test seam: forget the shared read, and optionally shorten the deadline. */
export function resetCuratedBookReadForTests(
  nextDeadlineMs: number = CURATED_BOOK_READ_DEADLINE_MS,
) {
  served = null;
  deadlineMs = nextDeadlineMs;
}

export type CuratedBookState = 'loading' | 'served' | 'failed';

export function useCuratedBook(
  enabled: boolean,
  cluster: 'devnet' | 'mainnet-beta' | null = null,
): { book: CuratedBook; settled: boolean; state: CuratedBookState } {
  const [names, setNames] = useState<SeriousName[]>([]);
  const [state, setState] = useState<CuratedBookState>('loading');

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    void readServedNames().then((read) => {
      if (cancelled) return;
      setNames(read ?? []);
      setState(read == null ? 'failed' : 'served');
    });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const book = useMemo(
    () => composeCuratedBook(names, cluster),
    [names, cluster],
  );
  return { book, settled: state !== 'loading', state };
}

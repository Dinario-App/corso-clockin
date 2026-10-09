import {
  EDGAR_FORM_CODES,
  FILINGS_CHIP_KEY,
  FILINGS_MAX,
  FILINGS_SOURCE,
  FILINGS_STALE_MS,
  type EdgarFormCode,
  type FilingsChip,
  type FilingsResponse,
  type FilingLink,
} from './types';

const FORM_CODES = new Set<string>(EDGAR_FORM_CODES);
const FILED_ON_RE = /^\d{4}-\d{2}-\d{2}$/;
const ARCHIVE_PREFIX = 'https://www.sec.gov/Archives/edgar/data/';

export type PresentFilingsChipRead = {
  snapshot: FilingsResponse | null;
  /** Mint Review asked for. A ready snapshot for another mint is ignored. */
  mint: string | null;
  nowMs: number;
};

/**
 * Display-only Review chip. Unmapped, unavailable, stale, over-cap, or
 * wrong-mint snapshots return null so the chip omits. Does not participate
 * in Sign.
 */
export function presentFilingsChip(
  read: PresentFilingsChipRead,
): FilingsChip | null {
  const snapshot = read.snapshot;
  if (!snapshot || snapshot.status !== 'ready') return null;
  if (snapshot.mint !== read.mint) return null;
  if (snapshot.filings.length === 0 || snapshot.filings.length > FILINGS_MAX) {
    return null;
  }
  const lines = [];
  for (const filing of snapshot.filings) {
    const line = presentLine(filing, read.nowMs);
    if (!line) return null;
    lines.push(line);
  }
  return { key: FILINGS_CHIP_KEY, lines };
}

function presentLine(filing: FilingLink, nowMs: number) {
  if (!FORM_CODES.has(filing.form)) return null;
  if (filing.title !== titleForForm(filing.form)) return null;
  if (!FILED_ON_RE.test(filing.filedOn)) return null;
  if (!filing.href.startsWith(ARCHIVE_PREFIX)) return null;
  const filedAtMs = Date.parse(`${filing.filedOn}T00:00:00.000Z`);
  if (!Number.isFinite(filedAtMs)) return null;
  if (filedAtMs > nowMs + 24 * 60 * 60 * 1000) return null;
  if (nowMs - filedAtMs > FILINGS_STALE_MS) return null;
  if (!printable(filing.filer)) return null;
  const freshnessDate = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(filedAtMs));
  return {
    form: filing.form,
    title: filing.title,
    filer: filing.filer,
    filedOn: filing.filedOn,
    href: filing.href,
    label: `${filing.title} · ${filing.filer}`,
    freshness: `${freshnessDate} · ${FILINGS_SOURCE}`,
  };
}

function titleForForm(form: EdgarFormCode): string {
  switch (form) {
    case '4':
    case '4/A':
      return 'Form 4';
    case '13F-HR':
    case '13F-HR/A':
      return 'Form 13F';
    default: {
      const neverForm: never = form;
      return neverForm;
    }
  }
}

function printable(value: string): boolean {
  const trimmed = value.replace(/\s+/g, ' ').trim();
  return trimmed === value && /^[\x20-\x7E]{1,120}$/.test(value);
}

import { EXPORT_PAGE_PATH } from '@/src/features/export/exportConfig';

export type ExportUrlResult =
  | { ok: true; url: string }
  | { ok: false; reason: 'origin_invalid' | 'identifier_in_url' };

export type ExportIdentifiers = {
  address?: string | null;
  privyUserId?: string | null;
  privyWalletId?: string | null;
};

function identifierList(ids: ExportIdentifiers | undefined): string[] {
  if (!ids) return [];
  return [ids.address, ids.privyUserId, ids.privyWalletId]
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    .map((v) => v.trim().toLowerCase());
}

/**
 * True when any supplied identifier is recoverable from the URL string.
 * Substring match on the whole URL (not just query) so a path segment,
 * a fragment, or a percent-decoded form all count as a leak.
 */
export function urlLeaksIdentifier(
  url: string,
  ids: ExportIdentifiers,
): boolean {
  const candidates = identifierList(ids);
  if (candidates.length === 0) return false;

  const forms = new Set<string>();
  const raw = String(url);
  forms.add(raw.toLowerCase());
  try {
    forms.add(decodeURIComponent(raw).toLowerCase());
  } catch {
    // Malformed percent-encoding — the raw form above is still checked.
  }

  for (const candidate of candidates) {
    for (const form of forms) {
      if (form.includes(candidate)) return true;
    }
  }
  return false;
}

/**
 * Build the one URL the export WebView is ever allowed to load.
 * Constant path, no query, no fragment. Fails closed.
 */
export function buildExportUrl(
  origin: string,
  ids?: ExportIdentifiers,
): ExportUrlResult {
  let url: URL;
  try {
    url = new URL(EXPORT_PAGE_PATH, origin);
  } catch {
    return { ok: false, reason: 'origin_invalid' };
  }

  if (url.protocol !== 'https:') return { ok: false, reason: 'origin_invalid' };

  // Belt and braces: strip anything a malformed origin could have carried in.
  url.search = '';
  url.hash = '';
  url.username = '';
  url.password = '';

  const built = url.toString();

  if (built.includes('?') || built.includes('#')) {
    return { ok: false, reason: 'identifier_in_url' };
  }
  if (ids && urlLeaksIdentifier(built, ids)) {
    return { ok: false, reason: 'identifier_in_url' };
  }

  return { ok: true, url: built };
}

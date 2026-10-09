export const LEGAL_URLS = {
  terms: 'https://corso.trade/terms',
  privacy: 'https://corso.trade/privacy',
  support: 'https://corso.trade/support',
  delete: 'https://corso.trade/delete',
  supportEmail: 'mailto:support@corso.trade',
} as const;

export type LegalUrlKey = keyof typeof LEGAL_URLS;

import { ACCOUNT_SETTINGS_HREF } from '@/src/features/account/accountRootPresentation';

export const BOOK_ASK_HREF = '/ask' as const;
export const BOOK_ACTIVITY_HREF = '/(app)/activity' as const;
/** ⚙ → Profile settings. */
export const BOOK_SETTINGS_HREF = ACCOUNT_SETTINGS_HREF;

export function bookMajorHref(mint: string) {
  return { pathname: '/asset/[mint]', params: { mint } } as const;
}

/** The sleeve summary opens 06. */
export const BOOK_SLEEVE_HREF = '/sleeve' as const;

/** Add cash composes USD before the guarded USDC checkout. */
export const BOOK_ADD_CASH_HREF = '/add-cash' as const;
export function openBookAddCash(navigation: {
  push: (href: typeof BOOK_ADD_CASH_HREF) => void;
}): void {
  navigation.push(BOOK_ADD_CASH_HREF);
}

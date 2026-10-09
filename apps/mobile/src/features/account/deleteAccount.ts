import { clearPerUserLocalStores } from '@/src/features/session/localClearRegistry';

const DELETE_ACCOUNT_ERROR = 'Account deletion failed. Try again.';
const DELETE_ACCOUNT_UNAVAILABLE = 'Account deletion is unavailable.';

export type AccountDeletionResult = Readonly<{
  deleted: true;
  localClearIncomplete: boolean;
  failedStores: readonly string[];
}>;

type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

function accountDeletionUrl(raw: string | null | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;
  try {
    const base = new URL(value);
    if (
      base.protocol !== 'https:' ||
      base.username ||
      base.password ||
      base.search ||
      base.hash
    ) {
      return null;
    }
    return new URL('/v1/auth/account', base).toString();
  } catch {
    return null;
  }
}

export async function deleteAccount(input: {
  apiBaseUrl?: string | null;
  getAccessToken: () => Promise<string | null>;
  fetchImpl?: FetchLike;
}): Promise<AccountDeletionResult> {
  const endpoint = accountDeletionUrl(
    input.apiBaseUrl ?? process.env.EXPO_PUBLIC_API_URL,
  );
  if (!endpoint) throw new Error(DELETE_ACCOUNT_UNAVAILABLE);

  const token = await input.getAccessToken();
  if (!token || token.trim() !== token) {
    throw new Error(DELETE_ACCOUNT_UNAVAILABLE);
  }

  const response = await (input.fetchImpl ?? fetch)(endpoint, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (response.status !== 204) {
    throw new Error(DELETE_ACCOUNT_ERROR);
  }
  const { unfinished } = await clearPerUserLocalStores('account-deletion');
  return {
    deleted: true,
    localClearIncomplete: unfinished.length > 0,
    failedStores: unfinished,
  };
}

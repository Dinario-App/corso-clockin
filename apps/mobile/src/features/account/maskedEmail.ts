/** Display-only projection of the existing identity; never retained or logged. */
export function maskedSessionEmail(
  user: {
    linked_accounts: readonly {
      type: string;
      address?: string;
      email?: string | null;
    }[];
  } | null | undefined,
  isReady: boolean,
): string | null {
  if (!isReady || !user) return null;
  const emailAccount = user.linked_accounts.find(
    account => account.type === 'email',
  );
  const email = emailAccount?.address ?? user.linked_accounts.find(
    account => typeof account.email === 'string',
  )?.email;
  if (typeof email !== 'string' || !/^[^@\s]+@[^@\s]+$/u.test(email)) return null;
  const [local, domain] = email.split('@');
  return `${Array.from(local)[0]}•••@${domain}`;
}

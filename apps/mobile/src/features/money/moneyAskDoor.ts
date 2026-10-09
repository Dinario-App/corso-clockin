export const ASK_HREF = '/ask' as const;

export type MoneyAskDoor = {
  pathname: typeof ASK_HREF;
  params: { ask: string };
};

export function resolveMoneyAskDoor(text: string): MoneyAskDoor {
  return { pathname: ASK_HREF, params: { ask: text.trim() } };
}

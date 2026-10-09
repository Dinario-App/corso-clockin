/** The tokens this one request can name. Upper-cased; symbol comparison only. */
export type AskScope = {
  /** Symbols in the request's holdings. */
  held: readonly string[];
  /** Symbols on the Moving rail the client was showing (max ten — the strip). */
  moving: readonly string[];
  /** Symbols the token search answered with a verified, non-condemned mint. */
  resolvable: readonly string[];
  /** The question carried a base58 mint, so the token is already named exactly. */
  pastedMint: boolean;
};

const EMPTY: AskScope = Object.freeze({
  held: Object.freeze([]),
  moving: Object.freeze([]),
  resolvable: Object.freeze([]),
  pastedMint: false,
});

export function buildAskScope(args: {
  held?: readonly string[];
  moving?: readonly string[];
  resolvable?: readonly string[];
  pastedMint?: boolean;
}): AskScope {
  const upper = (values: readonly string[] | undefined): readonly string[] =>
    Object.freeze([
      ...new Set(
        (values ?? [])
          .map((value) => value.trim().toUpperCase())
          .filter((value) => value.length > 0),
      ),
    ]);
  return Object.freeze({
    held: upper(args.held),
    moving: upper(args.moving),
    resolvable: upper(args.resolvable),
    pastedMint: args.pastedMint === true,
  });
}

/** The scope of a request that carries nothing — every symbol is unresolvable. */
export function emptyAskScope(): AskScope {
  return EMPTY;
}

export function heldOnlyScope(heldSymbols: readonly string[]): AskScope {
  return buildAskScope({ held: heldSymbols });
}

export function isSymbolInScope(
  symbol: string | null | undefined,
  scope: AskScope,
): boolean {
  if (!symbol) return false;
  const needle = symbol.trim().toUpperCase();
  if (needle.length === 0) return false;
  return (
    scope.held.includes(needle) ||
    scope.moving.includes(needle) ||
    scope.resolvable.includes(needle)
  );
}

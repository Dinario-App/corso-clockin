const SESSION_TYPES = new Set([
  'privy_embedded',
  'imported_seed',
  'connected_external',
]);

/**
 * Root-router admission for session-bearing screens.
 *
 * Only a settled phase plus a known, non-empty session identity opens the
 * route group. Booting, missing, malformed, and future session shapes stay
 * closed until the session layer can classify them deliberately.
 */
export function resolveSessionRouteGuard(input: {
  phase: unknown;
  session: unknown;
}): boolean {
  if (input.phase !== 'ready') return false;
  if (typeof input.session !== 'object' || input.session === null) return false;

  try {
    const session = input.session as { type?: unknown; address?: unknown };
    return (
      typeof session.type === 'string' &&
      SESSION_TYPES.has(session.type) &&
      typeof session.address === 'string' &&
      session.address.trim().length > 0
    );
  } catch {
    return false;
  }
}

export function mergeFontDefaultStyle(
  fontFamily: string,
  existing?: object | object[] | null,
  fontVariant?: readonly string[],
): { fontFamily: string } & Record<string, unknown> {
  const base: { fontFamily: string } & Record<string, unknown> = { fontFamily };
  if (fontVariant != null) base.fontVariant = [...fontVariant];
  if (existing == null) return base;
  if (Array.isArray(existing)) {
    return Object.assign(base, ...existing.filter(Boolean)) as {
      fontFamily: string;
    } & Record<string, unknown>;
  }
  return Object.assign(base, existing) as {
    fontFamily: string;
  } & Record<string, unknown>;
}

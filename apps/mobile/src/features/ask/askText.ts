import {
  isTrustedAskCopy,
  type TrustedCopy as ServerTrustedCopy,
} from './server-copy/textProvenance';
import { copy } from '@/constants/copy';

declare const provenance: unique symbol;
export type ModelText = Readonly<{
  kind: 'model';
  text: string;
  [provenance]: 'model';
}>;
declare class DeviceCopyIdentity {
  private readonly deviceCopyIdentity: void;
}
type DeviceTrustedCopy = Readonly<{ kind: 'trusted'; text: string }> &
  DeviceCopyIdentity;
export type TrustedCopy = DeviceTrustedCopy | ServerTrustedCopy;
export type AskText = ModelText | TrustedCopy;

const deviceCopies = new WeakSet<object>();
export function isTrustedCopy(value: unknown): value is TrustedCopy {
  return Boolean(
    value &&
      typeof value === 'object' &&
      (deviceCopies.has(value) || isTrustedAskCopy(value)),
  );
}
function makeTrusted(text: string): DeviceTrustedCopy {
  const value = Object.freeze({ kind: 'trusted', text }) as DeviceTrustedCopy;
  deviceCopies.add(value);
  return value;
}
function requireTrusted(parts: readonly TrustedCopy[]): void {
  if (!parts.every(isTrustedCopy))
    throw new TypeError('Invalid trusted copy identity');
}

type Catalog = typeof copy;
type TextKey<S extends keyof Catalog> = {
  [K in keyof Catalog[S]]: Catalog[S][K] extends
    | string
    | ((...args: never[]) => string)
    ? K
    : never;
}[keyof Catalog[S]];
type CopyArgs<
  S extends keyof Catalog,
  K extends TextKey<S>,
> = Catalog[S][K] extends (...args: infer A) => string
  ? { [I in keyof A]: A[I] extends string ? TrustedCopy : never }
  : [];

/** Resolve from the catalog only; a formatter accepts only trusted catalog arguments. */
export function trustedCopy<S extends keyof Catalog, K extends TextKey<S>>(
  section: S,
  key: K,
  ...args: CopyArgs<S, K>
): TrustedCopy {
  requireTrusted(args as readonly TrustedCopy[]);
  const entry = copy[section][key] as
    | string
    | ((...values: string[]) => string);
  const text =
    typeof entry === 'function'
      ? entry(...(args as readonly TrustedCopy[]).map((arg) => arg.text))
      : entry;
  return makeTrusted(text);
}

// Compile-only contract: neither literals nor structural imitations mint provenance.
type RequireText<T extends AskText> = T;
// @ts-expect-error raw strings must enter through a boundary or catalog producer
type RawTextIsNotProvenance = RequireText<string>;
// @ts-expect-error the private nominal brand is required in addition to a tag
type TagIsNotProvenance = RequireText<{ kind: 'trusted'; text: string }>;

/** Composition retains trust only when every constituent is catalog copy. */
export function joinTrustedCopy(parts: readonly TrustedCopy[]): TrustedCopy {
  requireTrusted(parts);
  return makeTrusted(parts.map((part) => part.text).join(' '));
}

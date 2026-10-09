import { askCopy, askFixedCopy } from './copy.js';
import { MODEL_FAILURE_COPY } from './modelSeam.js';
import { REFUSAL_COPY_BY_CODE } from './refusals.js';

// Resolve lazily because the mixed-data formatters delegate fixed branches here.
function copyCatalogs() {
  return {
    ask: askCopy,
    askFixed: askFixedCopy,
    modelFailure: MODEL_FAILURE_COPY,
    refusal: REFUSAL_COPY_BY_CODE,
  };
}
type Catalogs = ReturnType<typeof copyCatalogs>;
type FixedKey<C> = {
  [K in keyof C]: C[K] extends string | readonly string[] ? K : never;
}[keyof C];
export type TrustedCopyRef = {
  [C in keyof Catalogs]: {
    catalog: C;
    key: FixedKey<Catalogs[C]>;
    index?: number;
  };
}[keyof Catalogs];
declare class TrustedCopyIdentity {
  private readonly trustedCopyIdentity: void;
}
export type TrustedCopy = {
  readonly kind: 'trusted';
  readonly text: string;
  readonly ref: TrustedCopyRef;
} & TrustedCopyIdentity;
const trustedInstances = new WeakSet<object>();
export function isTrustedAskCopy(value: unknown): value is TrustedCopy {
  return (
    value !== null && typeof value === 'object' && trustedInstances.has(value)
  );
}

/** Resolve authority from the fixed catalog key, never from caller-provided text. */
export function readTrustedCopyRef(raw: unknown): TrustedCopy | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  const catalogs = copyCatalogs();
  if (
    typeof value.catalog !== 'string' ||
    !Object.hasOwn(catalogs, value.catalog) ||
    typeof value.key !== 'string'
  )
    return null;
  const catalog = catalogs[value.catalog as keyof Catalogs];
  if (!Object.hasOwn(catalog, value.key)) return null;
  const entry = (catalog as Record<string, unknown>)[value.key];
  let text: string;
  if (typeof entry === 'string' && value.index === undefined) text = entry;
  else if (
    Array.isArray(entry) &&
    typeof value.index === 'number' &&
    Number.isInteger(value.index) &&
    value.index >= 0 &&
    typeof entry[value.index] === 'string'
  )
    text = entry[value.index];
  else return null;
  const ref = Object.freeze({
    catalog: value.catalog,
    key: value.key,
    ...(value.index === undefined ? {} : { index: value.index }),
  }) as TrustedCopyRef;
  const copy = Object.freeze({ kind: 'trusted', text, ref }) as TrustedCopy;
  trustedInstances.add(copy);
  return copy;
}

export function trustedAskCopy(ref: TrustedCopyRef): TrustedCopy {
  const copy = readTrustedCopyRef(ref);
  if (!copy) throw new TypeError('Invalid fixed Ask copy reference');
  return copy;
}
export function trustedAskChips(
  key: {
    [K in keyof typeof askFixedCopy]: (typeof askFixedCopy)[K] extends string[]
      ? K
      : never;
  }[keyof typeof askFixedCopy],
): TrustedCopy[] {
  return askFixedCopy[key].map((_, index) =>
    trustedAskCopy({ catalog: 'askFixed', key, index }),
  );
}

declare const modelTextBrand: unique symbol;
/** Conservative text channel: model, mixed/interpolated, or legacy/unproven text. */
export type ModelText = string & { readonly [modelTextBrand]: true };
export function untrustedAskText(text: string): ModelText {
  return text as ModelText;
}
declare class ProducedIdentity {
  private readonly producedIdentity: void;
}
export type Produced = ProducedIdentity;
export type AskText = ModelText | TrustedCopy;
export type RequireAskText<T> = T extends Produced
  ? T
  : T extends readonly unknown[]
    ? { [K in keyof T]: RequireAskText<T[K]> }
    : T extends object
      ? {
          [K in keyof T]: K extends 'answer' | 'question'
            ? AskText
            : K extends 'chips'
              ? readonly AskText[]
              : RequireAskText<T[K]>;
        }
      : T;

export type CopyRefs = {
  answer?: TrustedCopyRef;
  question?: TrustedCopyRef;
  chips?: (TrustedCopyRef | null)[];
};
const provenance = new WeakMap<object, CopyRefs>();
type Plain<T> = T extends Produced
  ? T
  : T extends TrustedCopy | ModelText
    ? string
    : T extends readonly unknown[]
      ? { -readonly [K in keyof T]: Plain<T[K]> }
      : T extends object
        ? { -readonly [K in keyof T]: Plain<T[K]> } & Produced
        : T;

/** Compatibility object: text stays string-valued; authority stays out of band. */
export function produceAskCopy<const T extends object>(
  body: T & RequireAskText<T>,
): Plain<T> & Produced {
  const visit = (value: unknown): unknown => {
    if (value === null || typeof value !== 'object') return value;
    if (isTrustedAskCopy(value)) return value.text;
    if (Array.isArray(value)) return value.map(visit);
    const out: Record<string, unknown> = {};
    const refs: CopyRefs = {};
    const existing = provenance.get(value);
    if (existing) Object.assign(refs, existing);
    for (const [key, field] of Object.entries(value)) {
      if (key === 'copyRefs') continue;
      out[key] = visit(field);
      if ((key === 'answer' || key === 'question') && isTrustedAskCopy(field)) {
        refs[key] = field.ref;
      }
      if (key === 'chips' && Array.isArray(field)) {
        const chips = field.map((chip) =>
          isTrustedAskCopy(chip) ? chip.ref : null,
        );
        if (chips.some(Boolean)) refs.chips = chips;
      }
    }
    if (Object.keys(refs).length) provenance.set(out, refs);
    return out;
  };
  return visit(body) as Plain<T> & Produced;
}

/** Raw objects cannot supply authority: discard wire-shaped metadata first. */
export function serializeAskCopy<T extends object & Produced>(
  body: T,
): Plain<T> {
  const visit = (value: unknown): unknown => {
    if (value === null || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map(visit);
    const out = Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== 'copyRefs')
        .map(([key, field]) => [key, visit(field)]),
    );
    const refs = provenance.get(value);
    if (refs) out.copyRefs = refs;
    return out;
  };
  return visit(body) as Plain<T>;
}

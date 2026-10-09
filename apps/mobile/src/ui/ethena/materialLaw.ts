import {
  resolveCorsoGlass,
  type CorsoGlassMaterial,
  type FloatGlassTint,
} from '@/src/ui/glass/corsoGlassRecipe';
import { ETHENA_ACCESSIBLE_RIM } from '@/constants/theme.ethena';

export type EthenaPlane =
  /** In the scroll, resting on the ground. */
  | 'ground'
  /** Floating above the scroll — the dock and the sheet. */
  | 'float'
  | 'floatAction'
  /** The one control per screen that summons a float. */
  | 'summons'
  /** A forward CTA — `FORWARD_CTA_VERBS`. Nothing else. */
  | 'cta';

export const FORWARD_CTA_VERBS = [
  'Continue',
  'Buy',
  'Sell',
  'Add cash',
  'Get started',
] as const;
export type ForwardCtaVerb = (typeof FORWARD_CTA_VERBS)[number];

export type EthenaMaterial = {
  readonly plane: EthenaPlane;
  readonly material: CorsoGlassMaterial;
  /** The float tint under the glass; `null` on a material that does not refract. */
  readonly tint: FloatGlassTint | null;
  /** A solid fill, or the two stops of the icy gradient. */
  readonly fill: string | readonly [string, string];
  readonly borderColor: string | null;
  readonly borderWidth: number;
  /** Blur radius in dp; `0` means this object does not refract. */
  readonly blur: number;
  readonly label: string;
};

const PLANE_MATERIAL: Readonly<
  Record<
    EthenaPlane,
    { material: CorsoGlassMaterial; tint: FloatGlassTint | null }
  >
> = Object.freeze({
  ground: { material: 'ground-tray', tint: null },
  float: { material: 'float-glass', tint: 'float' },
  floatAction: { material: 'float-glass', tint: 'float' },
  summons: { material: 'summon-ring', tint: 'float2' },
  cta: { material: 'icy-cta', tint: null },
});

export function resolveEthenaMaterial(
  plane: EthenaPlane,
  options: { increaseContrast?: boolean } = {},
): EthenaMaterial {
  const { material, tint } = PLANE_MATERIAL[plane];
  const recipe = resolveCorsoGlass(material, tint ?? undefined);
  const increaseContrast = options.increaseContrast === true;
  return {
    plane,
    material,
    tint,
    fill: recipe.fill,
    borderColor: increaseContrast ? ETHENA_ACCESSIBLE_RIM : recipe.rimColor,
    borderWidth: increaseContrast
      ? Math.max(1, recipe.rimWidth)
      : recipe.rimWidth,
    blur: recipe.blur,
    label: recipe.label,
  };
}

export function isIcy(material: EthenaMaterial): boolean {
  return Array.isArray(material.fill);
}

/* ─── The screen manifest — what the law is checked against ───────────────── */

export type EthenaObject = {
  readonly testID: string;
  readonly plane: EthenaPlane;
  /** The visible label, when the object carries one. Icy placement is checked
   *  against this, so a CTA that is not a forward verb is caught by its words. */
  readonly label?: string;
  /**
   * The action group this object sits in (see the header). Required on every
   * icy object: an icy object with no group could never be counted against a
   * peer in its decision.
   */
  readonly group?: EthenaActionGroup;
  /** This press signs. A commit must sit in a decision group. */
  readonly commits?: true;
};

export type EthenaActionGroup = {
  /** The container View's testID. */
  readonly testID: string;
  readonly kind: 'decision' | 'entry';
};

export type EthenaScreen = {
  readonly name:
    | '02-home-book'
    | '04-review-sign'
    | '05-ask-sheet'
    | '08-receipt';
  readonly objects: readonly EthenaObject[];
};

export type LawBreach = { readonly screen: string; readonly why: string };

export function findLawBreaches(screen: EthenaScreen): LawBreach[] {
  const breaches: LawBreach[] = [];
  const at = (why: string) => breaches.push({ screen: screen.name, why });

  const seen = new Set<string>();
  for (const object of screen.objects) {
    if (seen.has(object.testID))
      at(`two objects share the testID ${object.testID}`);
    seen.add(object.testID);
  }

  const summoners = screen.objects.filter(
    (object) => object.plane === 'summons',
  );
  if (summoners.length > 1) {
    at(
      `${summoners.length} summoning controls (max 1): ` +
        summoners.map((object) => object.testID).join(' | '),
    );
  }

  const groups = new Map<string, EthenaActionGroup['kind']>();
  for (const { group } of screen.objects) {
    if (!group) continue;
    const kind = groups.get(group.testID);
    if (kind && kind !== group.kind)
      at(`group ${group.testID} is marked both ${kind} and ${group.kind}`);
    groups.set(group.testID, group.kind);
  }

  const icy = screen.objects.filter((object) => object.plane === 'cta');
  for (const object of icy) {
    if (
      !object.label ||
      !(FORWARD_CTA_VERBS as readonly string[]).includes(object.label)
    ) {
      at(`icy on a non-CTA: ${object.testID} "${object.label ?? ''}"`);
    }
    if (!object.group) at(`icy outside an action group: ${object.testID}`);
  }
  for (const [testID, kind] of groups) {
    if (kind !== 'decision') continue;
    const inGroup = icy.filter((object) => object.group?.testID === testID);
    if (inGroup.length > 1) {
      at(
        `${inGroup.length} icy fills in decision group ${testID} (max 1): ` +
          inGroup.map((object) => object.testID).join(' | '),
      );
    }
  }
  for (const object of screen.objects) {
    if (object.commits && object.group?.kind !== 'decision')
      at(`a commit outside a decision group: ${object.testID}`);
  }

  for (const object of screen.objects) {
    const material = resolveEthenaMaterial(object.plane);
    if (object.plane === 'ground' && material.blur > 0) {
      at(`glass off the floating plane: ${object.testID}`);
    }
    if (object.plane === 'ground' && isIcy(material)) {
      at(`tray fill + icy on one object: ${object.testID}`);
    }
  }

  return breaches;
}

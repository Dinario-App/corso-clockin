import { colors } from '@/constants/theme';
import { safetyCopy } from '@/constants/copy';

export type RugcheckRiskTier = 'Good' | 'Warning' | 'Danger';

export type RugcheckReviewPresentation = Readonly<{
  tier: RugcheckRiskTier | 'unknown';
  showVerifiedCheck: boolean;
  ambientDescription: string | null;
  dangerDescription: string | null;
  dangerTone: 'riskDanger' | null;
  requiresAcknowledgement: boolean;
  acknowledgementKind: 'danger' | 'unchecked' | null;
}>;

export function resolveRugcheckReviewPresentation(args: {
  tier: RugcheckRiskTier | null;
  descriptions: readonly string[];
  uncheckedUnverified?: boolean;
  unknownRequiresAcknowledgement?: boolean;
}): RugcheckReviewPresentation {
  const description = args.descriptions[0]?.trim() || null;
  if (args.tier === 'Good') {
    return {
      tier: 'Good',
      showVerifiedCheck: true,
      ambientDescription: null,
      dangerDescription: null,
      dangerTone: null,
      requiresAcknowledgement: false,
      acknowledgementKind: null,
    };
  }
  if (args.tier === 'Warning') {
    return {
      tier: 'Warning',
      showVerifiedCheck: false,
      ambientDescription: description,
      dangerDescription: null,
      dangerTone: null,
      requiresAcknowledgement: false,
      acknowledgementKind: null,
    };
  }
  if (args.tier === 'Danger') {
    return {
      tier: 'Danger',
      showVerifiedCheck: false,
      ambientDescription: null,
      dangerDescription: description,
      dangerTone: 'riskDanger',
      requiresAcknowledgement: true,
      acknowledgementKind: 'danger',
    };
  }
  if (args.uncheckedUnverified === true) {
    return {
      tier: 'unknown',
      showVerifiedCheck: false,
      ambientDescription: null,
      dangerDescription: safetyCopy.uncheckedUnverified,
      dangerTone: 'riskDanger',
      requiresAcknowledgement: true,
      acknowledgementKind: 'unchecked',
    };
  }
  return {
    tier: 'unknown',
    showVerifiedCheck: false,
    ambientDescription: null,
    dangerDescription: null,
    dangerTone: null,
    requiresAcknowledgement: args.unknownRequiresAcknowledgement === true,
    acknowledgementKind:
      args.unknownRequiresAcknowledgement === true ? 'unchecked' : null,
  };
}

export function rugcheckAllowsConfirm(
  presentation: RugcheckReviewPresentation | null,
  dangerAcknowledged: boolean,
): boolean {
  return !presentation?.requiresAcknowledgement || dangerAcknowledged;
}

const RISK_DANGER_LINE_STYLE = Object.freeze({
  color: colors.riskDanger,
  fontWeight: '600' as const,
});

export type RugcheckDangerLinePresentation = Readonly<{
  text: string;
  style: typeof RISK_DANGER_LINE_STYLE;
}>;

/** One shared danger treatment for picker and Review; safe tokens return no line. */
export function resolveRugcheckDangerLinePresentation(
  presentation: RugcheckReviewPresentation | null,
): RugcheckDangerLinePresentation | null {
  if (
    presentation?.dangerTone !== 'riskDanger' ||
    !presentation.dangerDescription
  ) {
    return null;
  }
  return Object.freeze({
    text: presentation.dangerDescription,
    style: RISK_DANGER_LINE_STYLE,
  });
}

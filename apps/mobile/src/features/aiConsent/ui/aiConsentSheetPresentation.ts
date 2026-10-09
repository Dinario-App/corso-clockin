import { copy } from '@/constants/copy';
import { brandFor } from '@/src/features/aiConsent/consentBrand';
import type { ConsentRequest } from '@/src/features/aiConsent/consentRequests';
import { PROFILE_PRIVACY_HREF } from '@/src/features/profile/settingsRoutePresentation';
import { CTA_HEIGHT } from '@/src/ui/controls/ctaTonePresentation';
import { PILL_HEIGHTS } from '@/src/ui/controls/pillPresentation';

/** Both pills: Allow is the white `PrimaryCTA`, decline the dark `SecondaryCTA`. Equal on purpose. */
export const AI_CONSENT_PILL_HEIGHT = 52;
export const AI_CONSENT_PILL_GAP = 13;

export type AiConsentSheetPresentation = Readonly<{
  requestId: string;
  variant: ConsentRequest['kind'];
  sheet: Readonly<{
    kind: 'consent';
    surface: 'solid';
    closeButton: true;
    /** Close circle, scrim and Android back all mean "dismissed, no decision". */
    dismissible: true;
    signing: false;
  }>;
  title: string;
  paragraphs: readonly string[];
  privacyLinkLabel: string;
  privacyHref: typeof PROFILE_PRIVACY_HREF;
  allowLabel: string;
  declineLabel: string;
  pillHeights: Readonly<{ allow: number; decline: number }>;
  pillGap: number;
}>;

const SHEET = Object.freeze({
  kind: 'consent',
  surface: 'solid',
  closeButton: true,
  dismissible: true,
  signing: false,
} as const);

const PILL_HEIGHTS_BOTH = Object.freeze({ allow: CTA_HEIGHT, decline: PILL_HEIGHTS.lg });

export function resolveAiConsentSheetPresentation(
  request: ConsentRequest,
): AiConsentSheetPresentation | null {
  const common: Pick<
    AiConsentSheetPresentation,
    'requestId' | 'variant' | 'sheet' | 'privacyLinkLabel' | 'privacyHref' | 'pillHeights' | 'pillGap'
  > = {
    requestId: request.id,
    variant: request.kind,
    sheet: SHEET,
    privacyLinkLabel: copy.profile.aboutPrivacy,
    privacyHref: PROFILE_PRIVACY_HREF,
    pillHeights: PILL_HEIGHTS_BOTH,
    pillGap: AI_CONSENT_PILL_GAP,
  };
  if (request.kind === 'default_assistant') {
    return {
      ...common,
      title: copy.aiConsent.defaultTitle,
      paragraphs: [copy.aiConsent.defaultBody],
      allowLabel: copy.aiConsent.defaultAllow,
      declineLabel: copy.aiConsent.defaultNotNow,
    };
  }
  const named = brandFor(request.provider);
  if (named === null) return null;
  return {
    ...common,
    title: copy.aiConsent.connectedTitle(named.brand),
    paragraphs: [
      copy.aiConsent.connectedBody1(named.brand, named.company),
      copy.aiConsent.connectedBody2(named.company),
    ],
    allowLabel: copy.aiConsent.connectedAllow,
    declineLabel: copy.aiConsent.connectedDecline,
  };
}

import { copy } from '@/constants/copy';

export type DeskUtilitySectionKey = 'collateral' | 'hedge' | 'margin' | 'rfq';

export type DeskUtilitySection = Readonly<{
  key: DeskUtilitySectionKey;
  title: string;
  body: string;
  optional: boolean;
}>;

const text = copy.deskUtilities.sections;

export const DESK_UTILITY_SECTIONS: readonly DeskUtilitySection[] =
  Object.freeze([
    { key: 'collateral', ...text.collateral, optional: false },
    { key: 'hedge', ...text.hedge, optional: false },
    { key: 'margin', ...text.margin, optional: false },
    { key: 'rfq', ...text.rfq, optional: true },
  ] satisfies DeskUtilitySection[]);

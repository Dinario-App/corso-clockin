import { CorsoText } from '@/src/theme/CorsoText';
import { resolveAccountChrome } from './accountChromePresentation';

export type AccountSectionHeadingProps = {
  label: string;
  /** First heading on a screen — drops the 28pt lead-in above it. */
  first?: boolean;
  testID?: string;
};

export function AccountSectionHeading({
  label,
  first = false,
  testID,
}: AccountSectionHeadingProps) {
  const chrome = resolveAccountChrome();
  return (
    <CorsoText
      accessibilityRole="header"
      style={[chrome.sectionHeadingStyle, first ? { marginTop: 0 } : null]}
      testID={testID}
    >
      {label}
    </CorsoText>
  );
}

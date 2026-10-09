import type { ReactNode } from 'react';
import { ScreenHeader } from '@/src/ui/navigation/ScreenHeader';
import type { ScreenHeaderFamily } from '@/src/ui/navigation/screenHeaderPresentation';

export type AccountScreenHeaderProps = {
  title: string;
  onBack: () => void;
  backAccessibilityLabel: string;
  /**
   * A back door that is closed for a reason — Send disables it while a
   * signature is in flight. The circle stays drawn and dims, because a control
   * that vanishes mid-signing reads as a crash.
   */
  backDisabled?: boolean;
  /** The step dots on the safe-reveal flow; nothing anywhere else. */
  right?: ReactNode;
  /** Send draws this row inside a sheet — see `ScreenHeader`. */
  surfaceInset?: number;
  /** `'desk'` on an Ethena-family screen — see `ScreenHeaderFamily`. */
  family?: ScreenHeaderFamily;
  testID?: string;
};

export function AccountScreenHeader({
  title,
  onBack,
  backAccessibilityLabel,
  backDisabled = false,
  right,
  surfaceInset,
  family,
  testID,
}: AccountScreenHeaderProps) {
  return (
    <ScreenHeader
      title={title}
      onBack={onBack}
      backAccessibilityLabel={backAccessibilityLabel}
      backDisabled={backDisabled}
      right={right}
      surfaceInset={surfaceInset}
      family={family}
      testID={testID}
    />
  );
}

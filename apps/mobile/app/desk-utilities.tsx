import { Redirect } from 'expo-router';
import { copy } from '@/constants/copy';
import { readDeskBuildFlag } from '@/src/features/desk/deskEnv';
import { DeskUtilitiesScreen } from '@/src/features/desk/DeskUtilitiesScreen';
import { goBackOr } from '@/src/features/navigation/goBackOr';
import { BACK_FALLBACK } from '@/src/features/navigation/guardedBack';
import { MajorDetailCircle } from '@/src/ui/majorDetail/MajorDetailCircle';

export default function DeskUtilitiesRoute() {
  if (!readDeskBuildFlag()) return <Redirect href="/(app)" />;
  return (
    <DeskUtilitiesScreen
      back={
        <MajorDetailCircle
          glyph="chevron-left"
          onPress={() => goBackOr(BACK_FALLBACK.accountTab)}
          accessibilityLabel={copy.v1.back}
          testID="desk-utilities-back"
        />
      }
    />
  );
}

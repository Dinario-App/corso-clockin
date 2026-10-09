import { StyleSheet, View } from 'react-native';
import { copy } from '@/constants/copy';
import { TextButton } from '@/src/ui/controls/TextButton';
import { Banner } from '@/src/ui/feedback/Banner';
import { spacing } from '@/src/ui/tokens';

let noticePending = false;
let noticeMessage: string = copy.profile.deleteEverythingLocalIncomplete;

/** Carries one truthful one-shot outcome across the logout navigation. */
export function queueDeleteAccountIncompleteNotice(
  message: string = copy.profile.deleteEverythingLocalIncomplete,
): void {
  noticePending = true;
  noticeMessage = message;
}

export function readDeleteAccountIncompleteNotice(): boolean {
  return noticePending;
}

export function clearDeleteAccountIncompleteNotice(): void {
  noticePending = false;
}

type DeleteAccountIncompleteNoticeProps = {
  visible: boolean;
  onDismiss: () => void;
};

export function DeleteAccountIncompleteNotice({
  visible,
  onDismiss,
}: DeleteAccountIncompleteNoticeProps) {
  if (!visible) return null;

  return (
    <View
      style={styles.root}
      testID="welcome-delete-local-incomplete"
      onLayout={clearDeleteAccountIncompleteNotice}
    >
      <Banner message={noticeMessage} tone="warning" />
      <TextButton
        label={copy.v1.done}
        onPress={onDismiss}
        tone="ink"
        size="inline"
        testID="welcome-delete-local-incomplete-dismiss"
      />
    </View>
  );
}

export function __resetDeleteAccountIncompleteNoticeForTests(): void {
  noticePending = false;
  noticeMessage = copy.profile.deleteEverythingLocalIncomplete;
}

const styles = StyleSheet.create({
  root: {
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.gutter,
    alignItems: 'center',
  },
});

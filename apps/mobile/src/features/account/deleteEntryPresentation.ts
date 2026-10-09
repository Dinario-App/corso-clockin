import { copy } from '@/constants/copy';

export type DeleteEntryPresentationInput = Readonly<{
  /** `null` means Privy's identity state is not ready yet. */
  hasCorsoServerAccount: boolean | null;
  hasImportedWalletOnPhone: boolean;
  hasConnectedWalletOnPhone: boolean;
}>;

export type DeleteEntryPresentation = Readonly<{
  action: 'delete-account' | 'remove-from-phone';
  ready: boolean;
  label: string;
  aboutLabel: string;
  accessibilityLabel: string;
  aboutAccessibilityLabel: string;
  dangerNote: string;
  title: string;
  body: string;
  confirmPhrase: string;
  confirmPlaceholder: string;
  cta: string;
  passcodeTitle: string | null;
  passcodeBody: string | null;
}>;

function deletePresentation(ready: boolean): DeleteEntryPresentation {
  return {
    action: 'delete-account',
    ready,
    label: copy.profile.deleteEverything,
    aboutLabel: copy.profile.aboutDelete,
    accessibilityLabel: copy.profile.deleteEverything,
    aboutAccessibilityLabel: copy.profile.aboutDelete,
    dangerNote: copy.profile.removeFromPhone.dangerNoteDelete,
    title: copy.profile.deleteEverything,
    body: copy.profile.deleteEverythingBody,
    confirmPhrase: 'DELETE',
    confirmPlaceholder: copy.profile.deleteEverythingConfirm,
    cta: copy.profile.deleteEverything,
    passcodeTitle: null,
    passcodeBody: null,
  };
}

export function resolveDeleteEntryPresentation(
  input: DeleteEntryPresentationInput,
): DeleteEntryPresentation {
  const ready = input.hasCorsoServerAccount !== null;
  if (
    !ready ||
    input.hasCorsoServerAccount ||
    (!input.hasImportedWalletOnPhone && !input.hasConnectedWalletOnPhone)
  ) {
    return deletePresentation(ready);
  }

  const remove = copy.profile.removeFromPhone;
  if (input.hasImportedWalletOnPhone && input.hasConnectedWalletOnPhone) {
    return {
      action: 'remove-from-phone',
      ready: true,
      label: remove.label,
      aboutLabel: remove.label,
      accessibilityLabel: remove.a11yBoth,
      aboutAccessibilityLabel: remove.a11yBoth,
      dangerNote: remove.dangerNoteRemoveWords,
      title: remove.title,
      body: remove.bodyBoth,
      confirmPhrase: remove.confirmPhrase,
      confirmPlaceholder: remove.confirmPlaceholder,
      cta: remove.cta,
      passcodeTitle: remove.passcodeTitle,
      passcodeBody: remove.passcodeBodyBoth,
    };
  }

  if (input.hasImportedWalletOnPhone) {
    return {
      action: 'remove-from-phone',
      ready: true,
      label: remove.label,
      aboutLabel: remove.label,
      accessibilityLabel: remove.a11yWords,
      aboutAccessibilityLabel: remove.a11yWords,
      dangerNote: remove.dangerNoteRemoveWords,
      title: remove.title,
      body: remove.bodyWords,
      confirmPhrase: remove.confirmPhrase,
      confirmPlaceholder: remove.confirmPlaceholder,
      cta: remove.cta,
      passcodeTitle: remove.passcodeTitle,
      passcodeBody: remove.passcodeBodyWords,
    };
  }

  return {
    action: 'remove-from-phone',
    ready: true,
    label: remove.label,
    aboutLabel: remove.label,
    accessibilityLabel: remove.a11yConnected,
    aboutAccessibilityLabel: remove.a11yConnected,
    dangerNote: remove.dangerNoteRemoveConnected,
    title: remove.title,
    body: remove.bodyConnected,
    confirmPhrase: remove.confirmPhrase,
    confirmPlaceholder: remove.confirmPlaceholder,
    cta: remove.cta,
    passcodeTitle: remove.passcodeTitle,
    passcodeBody: remove.passcodeBodyConnected,
  };
}

export type RemoveFromPhoneOutcome = Readonly<{
  kind: 'error' | 'notice';
  message: string;
}>;

export function resolveRemoveFromPhoneOutcome(
  input: Readonly<{
    hasImportedWalletOnPhone: boolean;
    hasConnectedWalletOnPhone: boolean;
    failedStores: readonly string[];
  }>,
): RemoveFromPhoneOutcome {
  const remove = copy.profile.removeFromPhone;
  const wordsFailed = input.failedStores.includes('importedMnemonic');
  const connectedFailed = input.failedStores.includes('mwaSession');
  const anythingFailed = input.failedStores.length > 0;

  if (input.hasImportedWalletOnPhone && input.hasConnectedWalletOnPhone) {
    if (wordsFailed && connectedFailed) {
      return { kind: 'error', message: remove.failedBoth };
    }
    if (wordsFailed) {
      return { kind: 'error', message: remove.failedBothWordsKept };
    }
    if (connectedFailed) {
      return { kind: 'error', message: remove.failedBothLinkKept };
    }
    return {
      kind: 'notice',
      message: anythingFailed ? remove.incompleteBoth : remove.done,
    };
  }

  if (input.hasImportedWalletOnPhone) {
    if (wordsFailed) return { kind: 'error', message: remove.failedWords };
    return {
      kind: 'notice',
      message: anythingFailed ? remove.incompleteWords : remove.done,
    };
  }

  if (connectedFailed) {
    return { kind: 'error', message: remove.failedConnected };
  }
  return {
    kind: 'notice',
    message: anythingFailed ? remove.incompleteConnected : remove.done,
  };
}

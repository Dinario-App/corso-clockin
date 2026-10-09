export const accountCopy = {
  sectionMoney: 'Money',
  sectionPreferences: 'Preferences',
  sectionSecurity: 'Security',
  sectionAutomation: 'Automation',

  nameSave: 'Save',

  copyAddress: 'Copy address',
  addressCopied: 'Copied',
  addressCopyFailed: 'Could not copy',

  botsRow: 'Bots',
  botsRowSub: 'Rules that run while you sleep',
  paperRow: 'Paper bots',
  paperRowSub: 'Practice a rule on past prices. No money moves',

  sendSub: 'To a Solana address',
  buySub: 'Add money with a card',
  receiveSub: 'Your address and QR code',
  swapSub: 'One token for another',
  securitySub: 'Recovery phrase and app lock',
  securitySubExport: 'Passcode, recovery and app lock',
  settingsSub: 'Network, notifications, about',

  signOutSub: 'Sign back in the same way',
  /** Strict line for imported or unknown session types. */
  signOutSubImport: 'Your words are the only way back in',
  dangerNote: 'Your money stays on Solana. This only removes the wallet from Corso.',

  menuDismissA11y: 'Dismiss the account card',

  sendGateEmpty: 'Add money before you can send.',
  sendGateUnreadable: "Corso can't read your balance right now, so Send is off.",
  sendGateOff: 'Send is not switched on for this build.',

  recoveryPhraseTitle: 'Recovery phrase',

  receiveCaution: "Only send Solana assets to this address. Anything else won't arrive.",
} as const;

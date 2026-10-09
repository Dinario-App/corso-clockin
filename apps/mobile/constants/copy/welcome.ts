export const welcomeCopy = {
  resume: {
    replaceTitle: 'Replace the phrase on this phone?',
    replaceBody:
      "This phone has a different recovery phrase saved. Continuing erases it for good. Corso doesn't have a copy, so only your own backup can bring that wallet back.",
    replaceCta: 'Erase and continue',
    replaceCancel: 'Keep it',
  },
  returningDinario: {
    headline: 'The Dinario app is now Corso.',
    body: [
      'Corso does not move anything you had in Dinario. To see it, open the app you used to approve Dinario payments.',
      'Continue with Google or email to open a new Corso balance.',
      'Your Dinario funds do not show in Corso.',
    ],
    cta: 'Continue',
  },
} as const;

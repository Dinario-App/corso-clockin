export const todayCardProposedCopy = {
  label: 'Today',
  askAboutToday: 'Ask about today',
  mood: (classification: string, value: number) =>
    `Crypto mood · ${classification} ${value}`,
} as const;

export const todayCardProposedCopy = {
  label: 'Today',
  askAboutToday: 'Ask about today',
  mood: (moodWord: string, value: number) =>
    `Crypto mood · ${moodWord} ${value}`,
} as const;

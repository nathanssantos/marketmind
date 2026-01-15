export const EMOJI = {
  success: '✅',
  error: '❌',
  warning: '⚠️',
  info: 'ℹ️',
  skip: '⏭️',
  chart: '📈',
  money: '💹',
  clock: '⏰',
  rocket: '🚀',
  gear: '⚙️',
  wrench: '🔧',
  lock: '🔒',
  pin: '📌',
  refresh: '🔄',
  search: '🔍',
  target: '🎯',
  fire: '🔥',
  star: '⭐',
  inbox: '📥',
  tools: '🛠️',
} as const;

export type EmojiName = keyof typeof EMOJI;

export const getEmoji = (name: EmojiName): string => EMOJI[name];

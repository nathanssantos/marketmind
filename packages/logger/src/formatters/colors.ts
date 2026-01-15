export const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
  white: '\x1b[37m',
} as const;

export type ColorName = keyof typeof COLORS;

export const colorize = (text: string, color: ColorName): string =>
  `${COLORS[color]}${text}${COLORS.reset}`;

export const stripAnsi = (str: string): string =>
  str.replace(new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g'), '');

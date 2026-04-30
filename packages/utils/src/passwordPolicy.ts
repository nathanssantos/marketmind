export const PASSWORD_POLICY = {
  MIN_LENGTH: 10,
  REQUIRE_UPPERCASE: true,
  REQUIRE_LOWERCASE: true,
  REQUIRE_DIGIT: true,
  REQUIRE_SYMBOL: true,
} as const;

export type PasswordIssue =
  | 'tooShort'
  | 'noUppercase'
  | 'noLowercase'
  | 'noDigit'
  | 'noSymbol'
  | 'common';

export interface PasswordValidationResult {
  valid: boolean;
  issues: PasswordIssue[];
}

const COMMON_PASSWORDS = new Set([
  '12345678',
  '123456789',
  '1234567890',
  'password',
  'password1',
  'password123',
  'qwerty',
  'qwerty123',
  'qwertyuiop',
  'admin',
  'admin123',
  'letmein',
  'welcome',
  'welcome1',
  'welcome123',
  'iloveyou',
  'abc123',
  'abcd1234',
  'Password1',
  'Password123',
  'Passw0rd',
  'monkey',
  'dragon',
  'football',
  'sunshine',
  'master',
  'superman',
  'batman',
  'trustno1',
  'changeme',
]);

const SYMBOL_RE = /[^a-zA-Z0-9]/;
const UPPER_RE = /[A-Z]/;
const LOWER_RE = /[a-z]/;
const DIGIT_RE = /\d/;

export const validatePassword = (input: string): PasswordValidationResult => {
  const issues: PasswordIssue[] = [];
  if (input.length < PASSWORD_POLICY.MIN_LENGTH) issues.push('tooShort');
  if (PASSWORD_POLICY.REQUIRE_UPPERCASE && !UPPER_RE.test(input)) issues.push('noUppercase');
  if (PASSWORD_POLICY.REQUIRE_LOWERCASE && !LOWER_RE.test(input)) issues.push('noLowercase');
  if (PASSWORD_POLICY.REQUIRE_DIGIT && !DIGIT_RE.test(input)) issues.push('noDigit');
  if (PASSWORD_POLICY.REQUIRE_SYMBOL && !SYMBOL_RE.test(input)) issues.push('noSymbol');
  if (COMMON_PASSWORDS.has(input.toLowerCase())) issues.push('common');
  return { valid: issues.length === 0, issues };
};

export interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4;
  satisfied: number;
  total: number;
}

export const passwordStrength = (input: string): PasswordStrength => {
  const checks: boolean[] = [
    input.length >= PASSWORD_POLICY.MIN_LENGTH,
    UPPER_RE.test(input),
    LOWER_RE.test(input),
    DIGIT_RE.test(input),
    SYMBOL_RE.test(input),
  ];
  const satisfied = checks.filter(Boolean).length;
  const total = checks.length;
  let score: 0 | 1 | 2 | 3 | 4 = 0;
  if (satisfied >= 5 && input.length >= 14) score = 4;
  else if (satisfied >= 5) score = 3;
  else if (satisfied >= 4) score = 2;
  else if (satisfied >= 3) score = 1;
  return { score, satisfied, total };
};

import { describe, expect, it } from 'vitest';
import { validatePassword, passwordStrength } from '../passwordPolicy';

describe('validatePassword', () => {
  it('accepts a strong password', () => {
    expect(validatePassword('MyStr0ng!Password').valid).toBe(true);
  });

  it('rejects too-short passwords', () => {
    expect(validatePassword('Aa1!').issues).toContain('tooShort');
  });

  it('rejects passwords missing an uppercase letter', () => {
    expect(validatePassword('mystr0ng!password').issues).toContain('noUppercase');
  });

  it('rejects passwords missing a lowercase letter', () => {
    expect(validatePassword('MYSTR0NG!PASSWORD').issues).toContain('noLowercase');
  });

  it('rejects passwords missing a digit', () => {
    expect(validatePassword('MyStrong!Password').issues).toContain('noDigit');
  });

  it('rejects passwords missing a symbol', () => {
    expect(validatePassword('MyStr0ngPassword').issues).toContain('noSymbol');
  });

  it('flags well-known common passwords (case insensitive)', () => {
    expect(validatePassword('Password123').issues).toContain('common');
  });

  it('returns multiple issues at once', () => {
    const result = validatePassword('abc');
    expect(result.valid).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining(['tooShort', 'noUppercase', 'noDigit', 'noSymbol']),
    );
  });
});

describe('passwordStrength', () => {
  it('scores 0 for trivial input', () => {
    expect(passwordStrength('a').score).toBe(0);
  });

  it('scores 4 for a 14+ char password meeting all rules', () => {
    expect(passwordStrength('MyStr0ng!PasswordVeryLong').score).toBe(4);
  });

  it('reports satisfied/total counts', () => {
    const result = passwordStrength('Aa1!aaaaaa');
    expect(result.total).toBe(5);
    expect(result.satisfied).toBe(5);
  });
});

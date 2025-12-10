
import '@testing-library/jest-dom';
import type * as matchers from '@testing-library/jest-dom/matchers';

declare module 'vitest' {
  interface Assertion<T = any> extends matchers.TestingLibraryMatchers<T, void> {}
  interface AsymmetricMatchersContaining extends matchers.TestingLibraryMatchers {}
}

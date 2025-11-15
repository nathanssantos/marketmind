import { describe, it, expect } from 'vitest';

describe('Test Setup', () => {
  it('should run basic test', () => {
    expect(1 + 1).toBe(2);
  });

  it('should have access to testing library matchers', () => {
    const element = document.createElement('div');
    element.textContent = 'Hello World';
    expect(element).toHaveTextContent('Hello World');
  });
});

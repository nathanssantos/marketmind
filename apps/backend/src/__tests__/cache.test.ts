import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SimpleCache, KeyedCache } from '../utils/cache';

describe('SimpleCache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return null when empty', () => {
    const cache = new SimpleCache<string>();
    expect(cache.get()).toBeNull();
  });

  it('should store and retrieve data', () => {
    const cache = new SimpleCache<string>();
    cache.set('hello');
    expect(cache.get()).toBe('hello');
  });

  it('should return null after TTL expires', () => {
    const cache = new SimpleCache<string>(1000);
    cache.set('hello');

    vi.advanceTimersByTime(999);
    expect(cache.get()).toBe('hello');

    vi.advanceTimersByTime(1);
    expect(cache.get()).toBeNull();
  });

  it('should use default TTL of 5 minutes', () => {
    const cache = new SimpleCache<string>();
    cache.set('hello');

    vi.advanceTimersByTime(5 * 60 * 1000 - 1);
    expect(cache.get()).toBe('hello');

    vi.advanceTimersByTime(1);
    expect(cache.get()).toBeNull();
  });

  it('should clear data', () => {
    const cache = new SimpleCache<string>();
    cache.set('hello');
    cache.clear();
    expect(cache.get()).toBeNull();
  });

  it('should update TTL with setTTL', () => {
    const cache = new SimpleCache<string>(10000);
    cache.set('hello');
    cache.setTTL(500);

    vi.advanceTimersByTime(500);
    expect(cache.get()).toBeNull();
  });

  it('should report validity correctly', () => {
    const cache = new SimpleCache<string>(1000);

    expect(cache.isValid()).toBe(false);

    cache.set('hello');
    expect(cache.isValid()).toBe(true);

    vi.advanceTimersByTime(1000);
    expect(cache.isValid()).toBe(false);
  });

  it('should overwrite previous data on set', () => {
    const cache = new SimpleCache<number>();
    cache.set(1);
    cache.set(2);
    expect(cache.get()).toBe(2);
  });

  it('should store complex objects', () => {
    const cache = new SimpleCache<{ name: string; values: number[] }>();
    const data = { name: 'test', values: [1, 2, 3] };
    cache.set(data);
    expect(cache.get()).toEqual(data);
  });
});

describe('KeyedCache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return null for missing keys', () => {
    const cache = new KeyedCache<string>();
    expect(cache.get('missing')).toBeNull();
  });

  it('should store and retrieve by key', () => {
    const cache = new KeyedCache<string>();
    cache.set('a', 'alpha');
    cache.set('b', 'beta');

    expect(cache.get('a')).toBe('alpha');
    expect(cache.get('b')).toBe('beta');
  });

  it('should return null after TTL expires and evict entry on get', () => {
    const cache = new KeyedCache<string>(1000);
    cache.set('key', 'value');

    vi.advanceTimersByTime(999);
    expect(cache.get('key')).toBe('value');

    vi.advanceTimersByTime(1);
    expect(cache.get('key')).toBeNull();
    expect(cache.size()).toBe(0);
  });

  it('should delete specific key', () => {
    const cache = new KeyedCache<string>();
    cache.set('a', 'alpha');
    cache.set('b', 'beta');

    cache.delete('a');
    expect(cache.get('a')).toBeNull();
    expect(cache.get('b')).toBe('beta');
  });

  it('should clear all entries', () => {
    const cache = new KeyedCache<string>();
    cache.set('a', 'alpha');
    cache.set('b', 'beta');

    cache.clear();
    expect(cache.get('a')).toBeNull();
    expect(cache.get('b')).toBeNull();
    expect(cache.size()).toBe(0);
  });

  it('should update TTL with setTTL', () => {
    const cache = new KeyedCache<string>(10000);
    cache.set('key', 'value');
    cache.setTTL(500);

    vi.advanceTimersByTime(500);
    expect(cache.get('key')).toBeNull();
  });

  it('should report has correctly for valid entries', () => {
    const cache = new KeyedCache<string>(1000);

    expect(cache.has('key')).toBe(false);

    cache.set('key', 'value');
    expect(cache.has('key')).toBe(true);

    vi.advanceTimersByTime(1000);
    expect(cache.has('key')).toBe(false);
    expect(cache.size()).toBe(0);
  });

  it('should return correct size', () => {
    const cache = new KeyedCache<string>();

    expect(cache.size()).toBe(0);

    cache.set('a', 'alpha');
    expect(cache.size()).toBe(1);

    cache.set('b', 'beta');
    expect(cache.size()).toBe(2);

    cache.delete('a');
    expect(cache.size()).toBe(1);
  });

  it('should overwrite value for same key', () => {
    const cache = new KeyedCache<number>();
    cache.set('key', 1);
    cache.set('key', 2);
    expect(cache.get('key')).toBe(2);
    expect(cache.size()).toBe(1);
  });

  it('should use default TTL of 5 minutes', () => {
    const cache = new KeyedCache<string>();
    cache.set('key', 'value');

    vi.advanceTimersByTime(5 * 60 * 1000 - 1);
    expect(cache.get('key')).toBe('value');

    vi.advanceTimersByTime(1);
    expect(cache.get('key')).toBeNull();
  });

  it('should handle multiple keys with different timestamps', () => {
    const cache = new KeyedCache<string>(2000);

    cache.set('first', 'a');
    vi.advanceTimersByTime(1000);
    cache.set('second', 'b');

    vi.advanceTimersByTime(1000);
    expect(cache.get('first')).toBeNull();
    expect(cache.get('second')).toBe('b');

    vi.advanceTimersByTime(1000);
    expect(cache.get('second')).toBeNull();
  });
});

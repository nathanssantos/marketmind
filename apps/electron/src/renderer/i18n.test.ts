import { describe, expect, it } from 'vitest';
import i18n, { changeLanguageLazy, loadLanguageBundle } from './i18n';

describe('i18n lazy bundles', () => {
  it('ships English eagerly', () => {
    // Smoke test the eager bundle is registered (a known top-level key exists).
    expect(i18n.language).toBe('en');
    const sample = i18n.t('common.close', { lng: 'en' });
    expect(sample).not.toBe('common.close');
  });

  it('does not load Portuguese until requested', () => {
    expect(i18n.hasResourceBundle('pt', 'translation')).toBe(false);
  });

  it('loads + registers Portuguese bundle on demand', async () => {
    await loadLanguageBundle('pt');
    expect(i18n.hasResourceBundle('pt', 'translation')).toBe(true);
    const ptSample = i18n.t('common.close', { lng: 'pt' });
    expect(typeof ptSample).toBe('string');
    expect(ptSample.length).toBeGreaterThan(0);
  });

  it('changeLanguageLazy loads + switches', async () => {
    await changeLanguageLazy('es');
    expect(i18n.language).toBe('es');
    expect(i18n.hasResourceBundle('es', 'translation')).toBe(true);
  });

  it('is idempotent — second call to loadLanguageBundle returns immediately', async () => {
    await loadLanguageBundle('pt'); // already loaded from earlier test
    await loadLanguageBundle('pt'); // no throw, no double-register
    expect(i18n.hasResourceBundle('pt', 'translation')).toBe(true);
  });

  it('ignores unknown languages', async () => {
    await loadLanguageBundle('xx');
    expect(i18n.hasResourceBundle('xx', 'translation')).toBe(false);
  });
});

import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';

import enTranslation from './locales/en/translation.json';

// English ships in the main bundle so first paint has copy. The other
// languages are loaded on demand via `loadLanguageBundle` — saves ~280 KB raw
// (~85 KB gz) off first load.
const lazyLoaders: Record<string, () => Promise<{ default: Record<string, unknown> } | Record<string, unknown>>> = {
  pt: () => import('./locales/pt/translation.json'),
  es: () => import('./locales/es/translation.json'),
  fr: () => import('./locales/fr/translation.json'),
};

const loaded = new Set<string>(['en']);

export const loadLanguageBundle = async (lang: string): Promise<void> => {
  if (loaded.has(lang)) return;
  const loader = lazyLoaders[lang];
  if (!loader) return;
  const mod = await loader();
  const translations = (mod as { default?: Record<string, unknown> }).default ?? (mod as Record<string, unknown>);
  i18n.addResourceBundle(lang, 'translation', translations, true, true);
  loaded.add(lang);
};

export const changeLanguageLazy = async (lang: string): Promise<void> => {
  await loadLanguageBundle(lang);
  await i18n.changeLanguage(lang);
};

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: enTranslation },
    },
    lng: 'en',
    fallbackLng: 'en',
    supportedLngs: ['en', 'pt', 'es', 'fr'],
    detection: {
      order: [],
      caches: [],
    },
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  });

export default i18n;

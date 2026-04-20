import { useEffect, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { QUERY_CONFIG } from '@shared/constants';
import { trpc } from '../utils/trpc';

const LANGUAGE_KEY = 'language';
const SUPPORTED_LANGUAGES = ['en', 'pt', 'es', 'fr'];

interface LanguageSyncProviderProps {
  children: ReactNode;
}

export const LanguageSyncProvider = ({ children }: LanguageSyncProviderProps) => {
  const { i18n } = useTranslation();
  const isHydratedRef = useRef(false);

  const { data: currentUser } = trpc.auth.me.useQuery(undefined, {
    retry: false,
    staleTime: QUERY_CONFIG.STALE_TIME.LONG,
  });

  const isAuthenticated = !!currentUser;

  const { data: preferences } = trpc.preferences.getByCategory.useQuery(
    { category: 'ui' },
    {
      enabled: isAuthenticated,
      staleTime: QUERY_CONFIG.STALE_TIME.LONG,
      retry: false,
    }
  );

  useEffect(() => {
    if (preferences && !isHydratedRef.current) {
      const savedLanguage = preferences[LANGUAGE_KEY] as string | undefined;
      if (savedLanguage && SUPPORTED_LANGUAGES.includes(savedLanguage) && savedLanguage !== i18n.language) {
        void i18n.changeLanguage(savedLanguage);
      }
      isHydratedRef.current = true;
    }
  }, [preferences, i18n]);

  return <>{children}</>;
};

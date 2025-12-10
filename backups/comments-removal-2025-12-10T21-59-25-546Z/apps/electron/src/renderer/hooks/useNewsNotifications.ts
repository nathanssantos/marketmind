import { toaster } from '@/renderer/utils/toaster';
import type { NewsArticle } from '@marketmind/types';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

interface UseNewsNotificationsOptions {
  enabled: boolean;
  minImportance: number;
  articles: NewsArticle[];
}

export const useNewsNotifications = ({
  enabled,
  minImportance,
  articles,
}: UseNewsNotificationsOptions) => {
  const { t } = useTranslation();
  const seenArticlesRef = useRef<Set<string>>(new Set());
  const isFirstLoadRef = useRef(true);

  useEffect(() => {
    if (!enabled || articles.length === 0) return;

    if (isFirstLoadRef.current) {
      articles.forEach((article) => seenArticlesRef.current.add(article.id));
      isFirstLoadRef.current = false;
      return;
    }

    const newImportantArticles = articles.filter(
      (article) =>
        !seenArticlesRef.current.has(article.id) &&
        (article.relevance ?? 0) * 100 >= minImportance
    );

    newImportantArticles.forEach((article) => {
      seenArticlesRef.current.add(article.id);

      const sentimentColors = {
        positive: 'green',
        negative: 'red',
        neutral: 'gray',
      };

      const colorPalette = article.sentiment
        ? sentimentColors[article.sentiment]
        : 'blue';

      toaster.create({
        title: t('news.toast.newImportantNews'),
        description: article.title,
        type: 'info',
        duration: 8000,
        action: {
          label: t('news.toast.readMore'),
          onClick: () => window.open(article.url, '_blank'),
        },
        meta: {
          colorPalette,
        },
      });
    });
  }, [articles, enabled, minImportance, t]);

  const resetSeenArticles = () => {
    seenArticlesRef.current.clear();
    isFirstLoadRef.current = true;
  };

  return { resetSeenArticles };
};

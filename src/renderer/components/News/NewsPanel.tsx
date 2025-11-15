import { Box, Stack, Text, Link, Badge, Spinner, HStack, VStack } from '@chakra-ui/react';
import { FiExternalLink, FiTrendingUp, FiTrendingDown, FiMinus } from 'react-icons/fi';
import type { NewsArticle } from '@shared/types';
import { useNews } from '../../hooks/useNews';
import { formatDistanceToNow } from 'date-fns';

interface NewsPanelProps {
  symbols?: string[];
  limit?: number;
  showSentiment?: boolean;
  refetchInterval?: number;
}

const SentimentBadge = ({ sentiment }: { sentiment?: NewsArticle['sentiment'] }) => {
  if (!sentiment) return null;

  const config = {
    positive: { colorPalette: 'green', icon: FiTrendingUp, label: 'Positive' },
    negative: { colorPalette: 'red', icon: FiTrendingDown, label: 'Negative' },
    neutral: { colorPalette: 'gray', icon: FiMinus, label: 'Neutral' },
  };

  const { colorPalette, icon: Icon, label } = config[sentiment];

  return (
    <Badge colorPalette={colorPalette} variant="subtle">
      <HStack gap={1}>
        <Icon size={12} />
        <Text>{label}</Text>
      </HStack>
    </Badge>
  );
};

const NewsCard = ({ article, showSentiment }: { article: NewsArticle; showSentiment: boolean }) => {
  return (
    <Box
      p={4}
      borderWidth="1px"
      borderRadius="md"
      borderColor="border.subtle"
      bg="bg.surface"
      _hover={{ bg: 'bg.muted', borderColor: 'border.emphasized' }}
      transition="all 0.2s"
    >
      <VStack align="stretch" gap={2}>
        <HStack justify="space-between" align="start" gap={2}>
          <Link
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            flex={1}
            _hover={{ textDecoration: 'none' }}
            onClick={(e) => {
              e.preventDefault();
              window.open(article.url, '_blank');
            }}
          >
            <Text fontWeight="semibold" fontSize="sm" lineHeight="1.4">
              {article.title}
            </Text>
          </Link>
          <FiExternalLink size={14} />
        </HStack>

        <Text fontSize="xs" color="fg.muted" lineHeight="1.4">
          {article.description}
        </Text>

        <HStack justify="space-between" align="center" flexWrap="wrap" gap={2}>
          <HStack gap={2} flexWrap="wrap">
            <Text fontSize="xs" color="fg.muted">
              {article.source}
            </Text>
            <Text fontSize="xs" color="fg.muted">
              •
            </Text>
            <Text fontSize="xs" color="fg.muted">
              {formatDistanceToNow(article.publishedAt, { addSuffix: true })}
            </Text>
          </HStack>

          <HStack gap={2}>
            {showSentiment && <SentimentBadge sentiment={article.sentiment} />}
            {article.symbols && article.symbols.length > 0 && (
              <HStack gap={1}>
                {article.symbols.slice(0, 3).map((symbol) => (
                  <Badge key={symbol} size="xs" variant="outline">
                    {symbol}
                  </Badge>
                ))}
              </HStack>
            )}
          </HStack>
        </HStack>
      </VStack>
    </Box>
  );
};

export const NewsPanel = ({
  symbols,
  limit = 10,
  showSentiment = true,
  refetchInterval,
}: NewsPanelProps) => {
  const { articles, loading, error } = useNews({
    symbols,
    limit,
    enabled: true,
    refetchInterval,
  });

  if (loading && articles.length === 0) {
    return (
      <Box p={8} display="flex" justifyContent="center" alignItems="center">
        <Spinner size="lg" />
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={4} bg="red.50" borderRadius="md">
        <Text color="red.700" fontSize="sm">
          Failed to load news: {error.message}
        </Text>
      </Box>
    );
  }

  if (articles.length === 0) {
    return (
      <Box p={8} textAlign="center">
        <Text color="fg.muted" fontSize="sm">
          No news articles found
        </Text>
      </Box>
    );
  }

  return (
    <Stack gap={3} p={4}>
      {articles.map((article) => (
        <NewsCard key={article.id} article={article} showSentiment={showSentiment} />
      ))}
    </Stack>
  );
};

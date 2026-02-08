import type { SavedScreener, ScreenerFilterCondition } from '@marketmind/types';
import { Flex, HStack, IconButton, Stack, Text } from '@chakra-ui/react';
import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { LuPlay, LuTrash2 } from 'react-icons/lu';

interface SavedScreenersListProps {
  savedScreeners: SavedScreener[];
  onLoad: (filters: ScreenerFilterCondition[]) => void;
  onDelete: (id: string) => void;
  isDeleting: boolean;
}

export const SavedScreenersList = memo(({ savedScreeners, onLoad, onDelete, isDeleting }: SavedScreenersListProps) => {
  const { t } = useTranslation();

  const handleLoad = useCallback((screener: SavedScreener) => {
    onLoad(screener.config.filters);
  }, [onLoad]);

  if (savedScreeners.length === 0) return null;

  return (
    <Stack gap={1}>
      <Text fontSize="2xs" fontWeight="semibold" color="fg.muted">
        {t('screener.saved.title')} ({savedScreeners.length})
      </Text>
      {savedScreeners.map((screener) => (
        <Flex
          key={screener.id}
          align="center"
          justify="space-between"
          px={2}
          py={1}
          borderRadius="md"
          bg="bg.muted"
          _hover={{ bg: 'bg.emphasized' }}
        >
          <Text fontSize="2xs" fontWeight="medium">{screener.name}</Text>
          <HStack gap={0}>
            <IconButton
              size="2xs"
              variant="ghost"
              colorPalette="blue"
              aria-label={t('screener.saved.load')}
              onClick={() => handleLoad(screener)}
            >
              <LuPlay size={12} />
            </IconButton>
            <IconButton
              size="2xs"
              variant="ghost"
              colorPalette="red"
              aria-label={t('common.delete')}
              onClick={() => onDelete(screener.id)}
              disabled={isDeleting}
            >
              <LuTrash2 size={12} />
            </IconButton>
          </HStack>
        </Flex>
      ))}
    </Stack>
  );
});

SavedScreenersList.displayName = 'SavedScreenersList';

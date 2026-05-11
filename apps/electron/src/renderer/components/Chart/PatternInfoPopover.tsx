import { Box, Flex, HStack, Stack, Text } from '@chakra-ui/react';
import { Badge, Button, CloseButton } from '@renderer/components/ui';
import type { PatternHit } from '@marketmind/trading-core';
import { useEffect, useRef, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { LuPencil } from 'react-icons/lu';

const SENTIMENT_COLORS: Record<PatternHit['sentiment'], { bg: string; label: string }> = {
  bullish: { bg: 'trading.profit', label: 'patterns.sentiment.bullish' },
  bearish: { bg: 'trading.loss', label: 'patterns.sentiment.bearish' },
  neutral: { bg: 'fg.muted', label: 'patterns.sentiment.neutral' },
};

const CATEGORY_LABEL_KEY: Record<string, string> = {
  'reversal-single': 'chart.patterns.categories.reversal-single',
  'reversal-multi': 'chart.patterns.categories.reversal-multi',
  continuation: 'chart.patterns.categories.continuation',
  indecision: 'chart.patterns.categories.indecision',
};

export interface PatternInfoPopoverProps {
  /** Anchor coordinates relative to the page viewport (e.clientX/clientY at click). */
  anchor: { x: number; y: number };
  hit: PatternHit;
  category?: string;
  description?: string;
  /** Bar timestamp (ms epoch) — formatted for the header. */
  barTime?: number;
  onClose: () => void;
  /** When present, shows an "Edit pattern" button that calls back. */
  onEdit?: () => void;
}

/**
 * Floating info card anchored at a click point on the chart. Used by the
 * pattern-glyph click handler in ChartCanvas. Closes on outside-click or
 * Escape. M2 will add an "Edit pattern" footer button that opens the
 * PatternConfigDialog.
 */
export const PatternInfoPopover = ({
  anchor,
  hit,
  category,
  description,
  barTime,
  onClose,
  onEdit,
}: PatternInfoPopoverProps): ReactElement => {
  const { t } = useTranslation();
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent): void => {
      if (cardRef.current?.contains(e.target as Node)) return;
      onClose();
    };
    const esc = (e: KeyboardEvent): void => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', esc);
    };
  }, [onClose]);

  const sentiment = SENTIMENT_COLORS[hit.sentiment];
  const time = barTime ? new Date(barTime).toLocaleString() : null;
  const catKey = category ? CATEGORY_LABEL_KEY[category] : undefined;

  return (
    <Box
      position="fixed"
      top={`${anchor.y + 8}px`}
      left={`${anchor.x + 8}px`}
      zIndex="popover"
      ref={cardRef}
    >
      <Box
        bg="bg.panel"
        borderWidth="1px"
        borderColor="border"
        borderRadius="md"
        boxShadow="lg"
        minW="240px"
        maxW="320px"
      >
        <Stack gap={2} p={3}>
          <Flex align="flex-start" justify="space-between" gap={2}>
            <Stack gap={1}>
              <HStack gap={2} align="center">
                <Box w="8px" h="8px" borderRadius="full" bg={sentiment.bg} />
                <Text fontSize="sm" fontWeight="semibold" lineHeight="1.2">
                  {hit.label}
                </Text>
              </HStack>
              <HStack gap={1.5}>
                <Badge size="xs" variant="subtle">
                  {t(sentiment.label, { defaultValue: hit.sentiment })}
                </Badge>
                {catKey ? (
                  <Badge size="xs" variant="subtle">
                    {t(catKey, { defaultValue: category })}
                  </Badge>
                ) : null}
              </HStack>
            </Stack>
            <CloseButton size="2xs" onClick={onClose} aria-label={t('common.close', { defaultValue: 'Close' })} />
          </Flex>
          {description ? (
            <Text fontSize="xs" color="fg.muted" lineHeight="1.4">
              {description}
            </Text>
          ) : null}
          {time ? (
            <Text fontSize="2xs" color="fg.muted" fontVariantNumeric="tabular-nums">
              {time}
            </Text>
          ) : null}
          {onEdit ? (
            <Flex justify="flex-end" pt={1}>
              <Button size="2xs" variant="outline" onClick={onEdit}>
                <LuPencil />
                {t('chart.patterns.edit', { defaultValue: 'Edit pattern' })}
              </Button>
            </Flex>
          ) : null}
        </Stack>
      </Box>
    </Box>
  );
};

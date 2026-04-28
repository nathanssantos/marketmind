import { Box, Flex, Text } from '@chakra-ui/react';
import { IconButton } from '@renderer/components/ui';
import { useAutoTradingLogs, type FrontendLogEntry } from '@renderer/hooks/useAutoTradingLogs';
import { useUIPref } from '@renderer/store/preferencesStore';
import { memo, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { LuChevronDown, LuChevronUp, LuMinus, LuPlus, LuTrash2 } from 'react-icons/lu';

const FONT_SIZE_STEPS = [6, 7, 8, 9, 10, 11, 12, 13, 14] as const;
const DEFAULT_FONT_SIZE_INDEX = 6;

interface LogLineProps {
  entry: FrontendLogEntry;
  fontSize: number;
}

const LogLine = memo(({ entry, fontSize }: LogLineProps) => {
  const time = new Date(entry.timestamp).toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const levelColor = {
    info: 'gray.400',
    warn: 'yellow.400',
    error: 'red.400',
    debug: 'blue.400',
  }[entry.level];

  return (
    <Flex
      gap={1}
      fontSize={`${fontSize}px`}
      fontFamily="mono"
      lineHeight="1.4"
      py="1px"
      _hover={{ bg: 'whiteAlpha.50' }}
    >
      <Text color="fg.muted" flexShrink={0}>{time}</Text>
      <Text flexShrink={0}>{entry.emoji}</Text>
      {entry.symbol && (
        <Text color="cyan.fg" fontWeight="medium" flexShrink={0}>
          [{entry.symbol}]
        </Text>
      )}
      <Text color={levelColor} wordBreak="break-word">
        {entry.message}
      </Text>
    </Flex>
  );
});

LogLine.displayName = 'LogLine';

interface AutoTradeConsoleProps {
  walletId: string;
  hasActiveWatchers?: boolean;
}

export const AutoTradeConsole = memo(({ walletId, hasActiveWatchers = false }: AutoTradeConsoleProps) => {
  const { t } = useTranslation();
  const { logs, isLoading, clearLogs } = useAutoTradingLogs(walletId, hasActiveWatchers);

  const containerRef = useRef<HTMLDivElement>(null);
  const [fontSizeIndex, setFontSizeIndex] = useUIPref<number>('autoTradeConsoleFontSizeIndex', DEFAULT_FONT_SIZE_INDEX);
  const [isExpanded, setIsExpanded] = useUIPref<boolean>('autoTradeConsoleIsExpanded', true);
  const [autoScroll, setAutoScroll] = useUIPref<boolean>('autoTradeConsoleAutoScroll', true);

  const fontSize = FONT_SIZE_STEPS[fontSizeIndex] ?? 12;

  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    setAutoScroll(isAtBottom);
  }, [setAutoScroll]);

  const increaseFontSize = useCallback(() => {
    setFontSizeIndex(prev => Math.min(prev + 1, FONT_SIZE_STEPS.length - 1));
  }, [setFontSizeIndex]);

  const decreaseFontSize = useCallback(() => {
    setFontSizeIndex(prev => Math.max(prev - 1, 0));
  }, [setFontSizeIndex]);

  if (!hasActiveWatchers && logs.length === 0 && !isLoading) return null;

  return (
    <Box
      bg="bg.subtle"
      borderRadius="md"
      border="1px solid"
      borderColor="border"
      overflow="hidden"
      mt={3}
    >
      <Flex
        justify="space-between"
        align="center"
        wrap="wrap"
        gap={2}
        px={3}
        py={2}
        bg="bg.subtle"
        borderBottom="1px solid"
        borderColor="border"
      >
        <Flex align="center" gap={2}>
          <Text fontSize="sm" fontWeight="bold" color="fg.muted">
            {t('autoTrading.console.title')}
          </Text>
          <Text fontSize="xs" color="fg.muted">
            ({logs.length})
          </Text>
        </Flex>

        <Flex gap={1}>
          <IconButton
            aria-label={t('autoTrading.console.decreaseFont')}
            size="2xs"
            variant="ghost"
            onClick={decreaseFontSize}
            disabled={fontSizeIndex === 0}
          >
            <LuMinus />
          </IconButton>
          <IconButton
            aria-label={t('autoTrading.console.increaseFont')}
            size="2xs"
            variant="ghost"
            onClick={increaseFontSize}
            disabled={fontSizeIndex === FONT_SIZE_STEPS.length - 1}
          >
            <LuPlus />
          </IconButton>
          <IconButton
            aria-label={t('autoTrading.console.clear')}
            size="2xs"
            variant="ghost"
            onClick={clearLogs}
          >
            <LuTrash2 />
          </IconButton>
          <IconButton
            aria-label={isExpanded ? t('common.collapse') : t('common.expand')}
            size="2xs"
            variant="ghost"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? <LuChevronUp /> : <LuChevronDown />}
          </IconButton>
        </Flex>
      </Flex>

      {isExpanded && (
        <Box
          ref={containerRef}
          onScroll={handleScroll}
          maxH="300px"
          minH="60px"
          overflowY="auto"
          px={3}
          py={2}
          css={{
            '&::-webkit-scrollbar': { width: '6px' },
            '&::-webkit-scrollbar-track': { background: 'transparent' },
            '&::-webkit-scrollbar-thumb': {
              background: 'var(--chakra-colors-gray-600)',
              borderRadius: '3px',
            },
          }}
        >
          {logs.length === 0 ? (
            <Text color="fg.muted" fontSize="xs" fontStyle="italic">
              {t('autoTrading.console.waiting')}
            </Text>
          ) : (
            logs.map((entry) => (
              <LogLine key={entry.id} entry={entry} fontSize={fontSize} />
            ))
          )}
        </Box>
      )}
    </Box>
  );
});

AutoTradeConsole.displayName = 'AutoTradeConsole';

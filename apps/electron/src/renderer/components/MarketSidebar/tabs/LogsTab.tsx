import { Box, Flex, Stack, Text } from '@chakra-ui/react';
import { Callout, IconButton } from '@renderer/components/ui';
import { useAutoTradingLogs, type FrontendLogEntry } from '@renderer/hooks/useAutoTradingLogs';
import { useActiveWallet } from '@renderer/hooks/useActiveWallet';
import { useBackendAutoTrading } from '@renderer/hooks/useBackendAutoTrading';
import { useUIPref } from '@renderer/store/preferencesStore';
import { memo, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { LuMinus, LuPlus, LuTrash2 } from 'react-icons/lu';
import {
  clampFontSizeIndex,
  fontSizeForIndex,
  isScrolledToBottom,
  LOGS_TAB_DEFAULT_FONT_SIZE_INDEX,
  LOGS_TAB_FONT_SIZE_STEPS,
} from './logsTabUtils';

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

const LogsTabComponent = () => {
  const { t } = useTranslation();

  const { activeWallet } = useActiveWallet();
  const activeWalletId = activeWallet?.id;

  const { watcherStatus } = useBackendAutoTrading(activeWalletId ?? '');
  const hasActiveWatchers = (watcherStatus?.activeWatchers?.length ?? 0) > 0;

  const { logs, clearLogs } = useAutoTradingLogs(activeWalletId ?? '', hasActiveWatchers);

  const containerRef = useRef<HTMLDivElement>(null);
  const [fontSizeIndex, setFontSizeIndex] = useUIPref<number>('logsTabFontSizeIndex', LOGS_TAB_DEFAULT_FONT_SIZE_INDEX);
  const [autoScroll, setAutoScroll] = useUIPref<boolean>('logsTabAutoScroll', true);

  const fontSize = fontSizeForIndex(fontSizeIndex);

  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    setAutoScroll(isScrolledToBottom(scrollTop, scrollHeight, clientHeight));
  }, [setAutoScroll]);

  const increaseFontSize = useCallback(() => {
    setFontSizeIndex((prev) => clampFontSizeIndex(prev + 1));
  }, [setFontSizeIndex]);

  const decreaseFontSize = useCallback(() => {
    setFontSizeIndex((prev) => clampFontSizeIndex(prev - 1));
  }, [setFontSizeIndex]);

  if (!activeWalletId) {
    return (
      <Stack gap={3} p={4}>
        <Callout tone="warning" compact>
          {t('trading.portfolio.noWallet')}
        </Callout>
      </Stack>
    );
  }

  return (
    <Stack gap={0} h="full">
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
            {t('marketSidebar.logs.title')}
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
            disabled={fontSizeIndex === LOGS_TAB_FONT_SIZE_STEPS.length - 1}
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
        </Flex>
      </Flex>

      <Box
        ref={containerRef}
        onScroll={handleScroll}
        flex={1}
        overflowY="auto"
        bg="bg.subtle"
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
            {t('marketSidebar.logs.waiting')}
          </Text>
        ) : (
          logs.map((entry) => (
            <LogLine key={entry.id} entry={entry} fontSize={fontSize} />
          ))
        )}
      </Box>
    </Stack>
  );
};

export const LogsTab = memo(LogsTabComponent);

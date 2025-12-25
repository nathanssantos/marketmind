import { Avatar, Flex, Spinner, Text } from '@chakra-ui/react';
import type { AIMessage } from '@marketmind/types';
import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { LuSparkles } from 'react-icons/lu';
import AutoSizer from 'react-virtualized-auto-sizer';
import { List, useDynamicRowHeight, useListRef, type RowComponentProps } from 'react-window';
import { usePatternHover } from '../../context/PatternHoverContext';
import { useToast } from '../../hooks/useToast';
import '../../markdown.css';
import { MessageItem } from './MessageItem';
import { useMessageList } from './useMessageList';

const DEFAULT_ROW_HEIGHT = 120;
const VIRTUALIZATION_THRESHOLD = 20;

interface MessageRowProps {
  messages: AIMessage[];
  loading: boolean;
  onPatternHover: (id: number | null) => void;
  dynamicRowHeight: ReturnType<typeof useDynamicRowHeight>;
}

const MessageRow = ({
  index,
  style,
  ariaAttributes,
  messages,
  loading,
  onPatternHover,
  dynamicRowHeight,
}: RowComponentProps<MessageRowProps>) => {
  const measureRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (measureRef.current) {
      dynamicRowHeight.observeRowElements([measureRef.current]);
    }
  }, [dynamicRowHeight]);

  if (index === messages.length && loading) {
    return (
      <div style={style} {...ariaAttributes}>
        <LoadingIndicator />
      </div>
    );
  }

  const message = messages[index];

  return (
    <div style={style} {...ariaAttributes}>
      {message && (
        <div ref={measureRef}>
          <MessageItem
            message={message}
            onPatternHover={onPatternHover}
          />
        </div>
      )}
    </div>
  );
};

export const MessageList = () => {
  const { t } = useTranslation();
  const { messages, loading, error, clearError } = useMessageList();
  const { setHoveredPatternId } = usePatternHover();
  const toast = useToast();
  const lastErrorRef = useRef<string | null>(null);
  const listRef = useListRef(null);
  const dynamicRowHeight = useDynamicRowHeight({ defaultRowHeight: DEFAULT_ROW_HEIGHT });

  useEffect(() => {
    if (error && error !== lastErrorRef.current) {
      lastErrorRef.current = error;
      toast.error('Erro', error);
      queueMicrotask(() => {
        clearError();
      });
    }
  }, [error, toast, clearError]);

  useEffect(() => {
    if (listRef.current && messages.length > 0) {
      listRef.current.scrollToRow({ index: messages.length - 1, align: 'end' });
    }
  }, [messages.length, listRef]);

  const handlePatternHover = useCallback(
    (id: number | null) => {
      setHoveredPatternId(id);
    },
    [setHoveredPatternId]
  );

  if (messages.length === 0 && !loading && !error) {
    return (
      <Flex
        direction="column"
        align="center"
        justify="center"
        height="100%"
        gap={3}
        color="fg.muted"
        px={4}
      >
        <LuSparkles size={48} />
        <Text fontSize="lg" fontWeight="medium">
          {t('chat.emptyStateTitle')}
        </Text>
        <Text fontSize="sm" textAlign="center" maxWidth="300px">
          {t('chat.emptyStateDescription')}
        </Text>
      </Flex>
    );
  }

  const useVirtualization = messages.length >= VIRTUALIZATION_THRESHOLD;

  if (!useVirtualization) {
    return (
      <Flex direction="column" flex={1} overflowY="auto" px={4} py={4} gap={2}>
        {messages.map((message: AIMessage) => (
          <MessageItem
            key={message.id}
            message={message}
            onPatternHover={handlePatternHover}
          />
        ))}
        {loading && <LoadingIndicator />}
      </Flex>
    );
  }

  const rowCount = messages.length + (loading ? 1 : 0);

  return (
    <Flex direction="column" flex={1} px={4}>
      <AutoSizer>
        {({ height, width }) => (
          <List
            listRef={listRef}
            rowCount={rowCount}
            rowHeight={dynamicRowHeight}
            rowComponent={MessageRow}
            rowProps={{
              messages,
              loading,
              onPatternHover: handlePatternHover,
              dynamicRowHeight,
            }}
            defaultHeight={height}
            style={{ height, width }}
            overscanCount={5}
          />
        )}
      </AutoSizer>
    </Flex>
  );
};

const LoadingIndicator = () => (
  <Flex gap={2} direction="column" alignItems="flex-start" py={2}>
    <Flex direction="column" align="flex-start" gap={1}>
      <Avatar.Root size="xs" bg="purple.500">
        <Avatar.Icon>
          <LuSparkles />
        </Avatar.Icon>
      </Avatar.Root>
      <Text fontSize="xs" color="fg.muted" fontWeight="medium">
        AI
      </Text>
    </Flex>
    <Flex align="center" gap={2}>
      <Spinner size="sm" />
      <Text fontSize="sm" color="fg.muted">
        Thinking...
      </Text>
    </Flex>
  </Flex>
);

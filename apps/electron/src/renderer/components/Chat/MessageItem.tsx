import { Avatar, Box, Flex, Text } from '@chakra-ui/react';
import type { AIMessage } from '@marketmind/types';
import { memo } from 'react';
import { LuSparkles, LuUser } from 'react-icons/lu';
import ReactMarkdown from 'react-markdown';
import { MarkdownWithPatternRefs } from './MarkdownWithPatternRefs';

interface MessageItemProps {
  message: AIMessage;
  onPatternHover: (id: number | null) => void;
  style?: React.CSSProperties;
}

export const MessageItem = memo(
  ({ message, onPatternHover, style }: MessageItemProps) => {
    const isUser = message.role === 'user';

    return (
      <div style={style}>
        <Flex
          gap={2}
          direction="column"
          alignItems={isUser ? 'flex-end' : 'flex-start'}
          py={2}
        >
          <Flex
            direction="column"
            align={isUser ? 'flex-end' : 'flex-start'}
            gap={1}
          >
            <Avatar.Root size="xs" bg={isUser ? 'blue.500' : 'purple.500'}>
              <Avatar.Icon>{isUser ? <LuUser /> : <LuSparkles />}</Avatar.Icon>
            </Avatar.Root>
            <Flex align="center" gap={2}>
              <Text fontSize="xs" color="fg.muted" fontWeight="medium">
                {isUser ? 'You' : message.model || 'AI'}
              </Text>
              <Text fontSize="xs" color="fg.muted">
                {new Date(message.openTime).toLocaleTimeString()}
              </Text>
            </Flex>
          </Flex>
          <Box
            bg={isUser ? 'blue.500' : 'bg.muted'}
            color={isUser ? 'white' : 'fg'}
            px={4}
            py={2}
            borderRadius="lg"
            maxWidth="90%"
            className="markdown"
          >
            {isUser ? (
              <ReactMarkdown>{message.content}</ReactMarkdown>
            ) : (
              <MarkdownWithPatternRefs
                content={message.content}
                onPatternHover={onPatternHover}
              />
            )}
          </Box>
        </Flex>
      </div>
    );
  },
  (prevProps, nextProps) =>
    prevProps.message.id === nextProps.message.id &&
    prevProps.message.content === nextProps.message.content
);

MessageItem.displayName = 'MessageItem';

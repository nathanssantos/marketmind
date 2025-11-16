import { Avatar, Box, Flex, Spinner, Text } from '@chakra-ui/react';
import type { AIMessage } from '@shared/types';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { HiSparkles, HiUser } from 'react-icons/hi2';
import ReactMarkdown from 'react-markdown';
import { useAIStudyHover } from '../../context/AIStudyHoverContext';
import { useToast } from '../../hooks/useToast';
import '../../markdown.css';
import { MarkdownWithStudyRefs } from './MarkdownWithStudyRefs';
import { useMessageList } from './useMessageList';

export const MessageList = () => {
  const { t } = useTranslation();
  const { messages, loading, error, messagesEndRef, clearError } = useMessageList();
  const { setHoveredStudyId } = useAIStudyHover();
  const toast = useToast();
  const lastErrorRef = useRef<string | null>(null);

  useEffect(() => {
    if (error && error !== lastErrorRef.current) {
      lastErrorRef.current = error;
      toast.error('Erro', error);
      queueMicrotask(() => {
        clearError();
      });
    }
  }, [error, toast, clearError]);

  return (
    <Flex
      direction="column"
      flex={1}
      overflowY="auto"
      px={4}
      py={4}
      gap={4}
    >
      {messages.length === 0 && !loading && !error ? (
        <Flex
          direction="column"
          align="center"
          justify="center"
          height="100%"
          gap={3}
          color="fg.muted"
        >
          <HiSparkles size={48} />
          <Text fontSize="lg" fontWeight="medium">
            {t('chat.emptyStateTitle')}
          </Text>
          <Text fontSize="sm" textAlign="center" maxWidth="300px">
            {t('chat.emptyStateDescription')}
          </Text>
        </Flex>
      ) : (
        <>
          {messages.map((message: AIMessage) => (
            <Flex
              key={message.id}
              gap={3}
              direction={message.role === 'user' ? 'row-reverse' : 'row'}
            >
              <Avatar.Root
                size="sm"
                bg={message.role === 'user' ? 'blue.500' : 'purple.500'}
              >
                <Avatar.Icon>
                  {message.role === 'user' ? <HiUser /> : <HiSparkles />}
                </Avatar.Icon>
              </Avatar.Root>
              <Flex direction="column" flex={1} gap={1}>
                <Flex
                  align="center"
                  gap={2}
                  justify={message.role === 'user' ? 'flex-end' : 'flex-start'}
                >
                  <Text fontSize="xs" color="fg.muted">
                    {message.role === 'user' ? 'You' : message.model || 'AI'}
                  </Text>
                  <Text fontSize="xs" color="fg.muted">
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </Text>
                </Flex>
                <Box
                  bg={message.role === 'user' ? 'blue.500' : 'bg.muted'}
                  color={message.role === 'user' ? 'white' : 'fg'}
                  px={4}
                  py={2}
                  borderRadius="lg"
                  maxWidth="85%"
                  alignSelf={message.role === 'user' ? 'flex-end' : 'flex-start'}
                  className="markdown"
                >
                  {message.role === 'assistant' ? (
                    <MarkdownWithStudyRefs 
                      content={message.content}
                      onStudyHover={setHoveredStudyId}
                    />
                  ) : (
                    <ReactMarkdown>
                      {message.content}
                    </ReactMarkdown>
                  )}
                </Box>
              </Flex>
            </Flex>
          ))}
          {loading && (
            <Flex align="center" gap={3}>
              <Avatar.Root size="sm" bg="purple.500">
                <Avatar.Icon>
                  <HiSparkles />
                </Avatar.Icon>
              </Avatar.Root>
              <Flex align="center" gap={2}>
                <Spinner size="sm" />
                <Text fontSize="sm" color="fg.muted">
                  Thinking...
                </Text>
              </Flex>
            </Flex>
          )}
          <div ref={messagesEndRef} />
        </>
      )}
    </Flex>
  );
};

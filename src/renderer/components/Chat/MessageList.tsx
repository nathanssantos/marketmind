import { Avatar, Box, Flex, Spinner, Text } from '@chakra-ui/react';
import type { AIMessage } from '@shared/types';
import { HiSparkles, HiUser } from 'react-icons/hi2';
import ReactMarkdown from 'react-markdown';
import '../../markdown.css';
import { useMessageList } from './useMessageList';

export const MessageList = () => {
  const { messages, loading, messagesEndRef } = useMessageList();

  return (
    <Flex
      direction="column"
      flex={1}
      overflowY="auto"
      px={4}
      py={4}
      gap={4}
    >
      {messages.length === 0 && !loading ? (
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
            Start a conversation
          </Text>
          <Text fontSize="sm" textAlign="center" maxWidth="300px">
            Ask me to analyze the chart, explain patterns, or provide trading insights
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
                  <ReactMarkdown>
                    {message.content}
                  </ReactMarkdown>
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

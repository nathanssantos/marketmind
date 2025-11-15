import { Box, Button, Input, Stack, Text, VStack, Code, Heading } from '@chakra-ui/react';
import { useState } from 'react';
import { useAI } from '../hooks/useAI';

export const AITest = () => {
  const {
    isConfigured,
    isLoading,
    error,
    activeConversation,
    configure,
    sendMessage,
    createConversation,
  } = useAI();

  const [apiKey, setApiKey] = useState('');
  const [message, setMessage] = useState('');

  const handleConfigure = () => {
    if (!apiKey.trim()) return;

    configure({
      provider: 'openai',
      apiKey: apiKey.trim(),
      model: 'gpt-4o',
      temperature: 0.7,
      maxTokens: 4096,
    });

    createConversation();
  };

  const handleSendMessage = async () => {
    if (!message.trim()) return;

    await sendMessage(message.trim());
    setMessage('');
  };

  return (
    <Box p={8} maxW="800px" mx="auto">
      <VStack gap={6} align="stretch">
        <Heading size="lg">AI Integration Test</Heading>

        {!isConfigured ? (
          <Stack gap={4}>
            <Text>Enter your OpenAI API key to test:</Text>
            <Input
              type="password"
              placeholder="sk-..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
            <Button onClick={handleConfigure} colorScheme="blue">
              Configure AI
            </Button>
          </Stack>
        ) : (
          <VStack gap={4} align="stretch">
            <Text color="green.500">✓ AI Configured</Text>

            <Stack gap={2}>
              <Text fontWeight="bold">Send a message:</Text>
              <Input
                placeholder="Type a message..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                disabled={isLoading}
              />
              <Button
                onClick={handleSendMessage}
                colorScheme="blue"
                loading={isLoading}
                disabled={!message.trim() || isLoading}
              >
                Send
              </Button>
            </Stack>

            {error && (
              <Box p={4} bg="red.500" color="white" borderRadius="md">
                <Text fontWeight="bold">Error:</Text>
                <Text>{error}</Text>
              </Box>
            )}

            {activeConversation && activeConversation.messages.length > 0 && (
              <VStack gap={3} align="stretch" mt={4}>
                <Text fontWeight="bold">Conversation:</Text>
                {activeConversation.messages.map((msg) => (
                  <Box
                    key={msg.id}
                    p={4}
                    bg={msg.role === 'user' ? 'blue.500' : 'gray.700'}
                    color="white"
                    borderRadius="md"
                  >
                    <Text fontSize="xs" opacity={0.7} mb={2}>
                      {msg.role === 'user' ? 'You' : 'AI'} • {new Date(msg.timestamp).toLocaleTimeString()}
                    </Text>
                    <Code
                      display="block"
                      whiteSpace="pre-wrap"
                      p={2}
                      bg="blackAlpha.300"
                      borderRadius="md"
                    >
                      {msg.content}
                    </Code>
                  </Box>
                ))}
              </VStack>
            )}
          </VStack>
        )}
      </VStack>
    </Box>
  );
};

import { Box, Button, Input, Stack, Text, VStack, Heading } from '@chakra-ui/react';
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
        <Box>
          <Heading size="lg" mb={2} color="white">🤖 AI Integration Test</Heading>
          <Text fontSize="sm" color="gray.300">
            Test the OpenAI integration before building the full chat interface
          </Text>
        </Box>

        {!isConfigured ? (
          <Stack gap={4}>
            <Box p={4} bg="blue.900" borderRadius="md" borderLeft="4px solid" borderColor="blue.500">
              <Text fontWeight="bold" mb={2} color="blue.100">📝 Instructions:</Text>
              <Text fontSize="sm" mb={2} color="blue.50">
                1. Get your API key from{' '}
                <Text as="span" color="blue.200" textDecoration="underline">
                  platform.openai.com/api-keys
                </Text>
              </Text>
              <Text fontSize="sm" mb={2} color="blue.50">
                2. Paste it below (it will be stored in localStorage)
              </Text>
              <Text fontSize="sm" color="blue.50">
                3. Click "Configure AI" to start testing
              </Text>
            </Box>
            
            <Box>
              <Text fontWeight="bold" mb={2} color="white">OpenAI API Key:</Text>
              <Input
                type="password"
                placeholder="sk-proj-..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                bg="gray.800"
                borderColor="gray.700"
                _hover={{ borderColor: 'gray.600' }}
                _focus={{ borderColor: 'blue.500' }}
                color="white"
              />
              <Text fontSize="xs" color="gray.400" mt={1}>
                Your API key is stored locally and never sent anywhere except OpenAI
              </Text>
            </Box>
            
            <Button 
              onClick={handleConfigure} 
              colorScheme="blue"
              size="lg"
              disabled={!apiKey.trim()}
            >
              Configure AI
            </Button>
          </Stack>
        ) : (
          <VStack gap={4} align="stretch">
            <Box p={3} bg="green.900" borderRadius="md" borderLeft="4px solid" borderColor="green.500">
              <Text fontWeight="bold" color="green.100">✓ AI Configured Successfully</Text>
              <Text fontSize="sm" color="green.50" mt={1}>
                Model: GPT-4o • Temperature: 0.7 • Max Tokens: 4096
              </Text>
            </Box>

            <Box>
              <Text fontWeight="bold" mb={2} color="white">💬 Send a test message:</Text>
              <Text fontSize="sm" color="gray.300" mb={3}>
                Try asking: "What is a golden cross pattern in trading?"
              </Text>
              <Input
                placeholder="Type your message here..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                disabled={isLoading}
                bg="gray.800"
                borderColor="gray.700"
                _hover={{ borderColor: 'gray.600' }}
                _focus={{ borderColor: 'blue.500' }}
                color="white"
              />
              <Button
                onClick={handleSendMessage}
                colorScheme="blue"
                loading={isLoading}
                disabled={!message.trim() || isLoading}
                mt={2}
                w="full"
              >
                {isLoading ? 'Sending...' : 'Send Message'}
              </Button>
            </Box>

            {error && (
              <Box p={4} bg="red.900" color="red.100" borderRadius="md" borderLeft="4px solid" borderColor="red.500">
                <Text fontWeight="bold" mb={1} color="red.100">❌ Error:</Text>
                <Text fontSize="sm" color="red.50">{error}</Text>
                <Text fontSize="xs" mt={2} color="red.200">
                  Common issues: Invalid API key, insufficient credits, or network problems
                </Text>
              </Box>
            )}

            {activeConversation && activeConversation.messages.length > 0 && (
              <VStack gap={3} align="stretch" mt={4}>
                <Text fontWeight="bold" color="white">📝 Conversation History:</Text>
                {activeConversation.messages.map((msg) => (
                  <Box
                    key={msg.id}
                    p={4}
                    bg={msg.role === 'user' ? 'blue.900' : 'gray.800'}
                    borderRadius="md"
                    borderLeft="4px solid"
                    borderColor={msg.role === 'user' ? 'blue.500' : 'purple.500'}
                  >
                    <Text fontSize="xs" color="gray.300" mb={2}>
                      {msg.role === 'user' ? '👤 You' : '🤖 AI Assistant'} • {new Date(msg.timestamp).toLocaleTimeString()}
                    </Text>
                    <Text whiteSpace="pre-wrap" fontSize="sm" color="white">
                      {msg.content}
                    </Text>
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

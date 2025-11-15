import { Box, Button, Input, Stack, Text, VStack, Heading } from '@chakra-ui/react';
import { useState, useEffect } from 'react';
import { useAI } from '../hooks/useAI';
import type { AIProviderType } from '@shared/types';

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

  const [apiKey, setApiKey] = useState(import.meta.env.VITE_ANTHROPIC_API_KEY || '');
  const [message, setMessage] = useState('');
  const [provider, setProvider] = useState<AIProviderType>('anthropic');
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(4096);

  useEffect(() => {
    const key = provider === 'anthropic' 
      ? import.meta.env.VITE_ANTHROPIC_API_KEY 
      : import.meta.env.VITE_OPENAI_API_KEY;
    
    setApiKey(key || '');
  }, [provider]);

  const handleConfigure = () => {
    if (!apiKey.trim()) return;

    const model = provider === 'openai' ? 'gpt-4o' : 'claude-sonnet-4-5-20250929';

    configure({
      provider,
      apiKey: apiKey.trim(),
      model,
      temperature,
      maxTokens,
    });

    createConversation();
  };

  const handleSendMessage = async () => {
    if (!message.trim()) return;

    await sendMessage(message.trim());
    setMessage('');
  };

  return (
    <Box p={8} maxW="800px" mx="auto" userSelect="text">
      <VStack gap={6} align="stretch">
        <Box>
          <Heading size="lg" mb={2} color="white">🤖 AI Integration Test</Heading>
          <Text fontSize="sm" color="gray.300">
            Test the AI integration with OpenAI or Claude (Anthropic)
          </Text>
        </Box>

        {!isConfigured ? (
          <Stack gap={4}>
            <Box p={4} bg="blue.900" borderRadius="md" borderLeft="4px solid" borderColor="blue.500">
              <Text fontWeight="bold" mb={2} color="blue.100">📝 Instructions:</Text>
              <Text fontSize="sm" mb={2} color="blue.50">
                1. Choose your AI provider (Claude or OpenAI)
              </Text>
              <Text fontSize="sm" mb={2} color="blue.50">
                2. Get your API key from:
              </Text>
              <Text fontSize="sm" ml={4} mb={1} color="blue.200">
                • Claude: <Text as="span" textDecoration="underline">console.anthropic.com</Text>
              </Text>
              <Text fontSize="sm" ml={4} mb={2} color="blue.200">
                • OpenAI: <Text as="span" textDecoration="underline">platform.openai.com/api-keys</Text>
              </Text>
              <Text fontSize="sm" mb={2} color="blue.50">
                3. Paste it below (stored in localStorage)
              </Text>
              <Text fontSize="sm" color="blue.50">
                4. Click "Configure AI" to start testing
              </Text>
            </Box>
            
            <Box>
              <Text fontWeight="bold" mb={2} color="white">AI Provider:</Text>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value as AIProviderType)}
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  backgroundColor: '#1a202c',
                  color: 'white',
                  border: '1px solid #4a5568',
                  borderRadius: '0.375rem',
                  cursor: 'pointer',
                }}
              >
                <option value="anthropic" style={{ background: '#1a202c' }}>
                  Claude 4.5 Sonnet (Anthropic)
                </option>
                <option value="openai" style={{ background: '#1a202c' }}>
                  GPT-4o (OpenAI)
                </option>
              </select>
            </Box>

            <Box>
              <Text fontWeight="bold" mb={2} color="white">API Key:</Text>
              <Input
                type="password"
                placeholder={provider === 'anthropic' ? 'sk-ant-...' : 'sk-proj-...'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                bg="gray.800"
                borderColor="gray.700"
                _hover={{ borderColor: 'gray.600' }}
                _focus={{ borderColor: 'blue.500' }}
                color="white"
              />
              <Text fontSize="xs" color="gray.400" mt={1}>
                Your API key is stored locally and never sent anywhere except {provider === 'anthropic' ? 'Anthropic' : 'OpenAI'}
              </Text>
            </Box>

            <Stack direction={{ base: 'column', md: 'row' }} gap={4}>
              <Box flex={1}>
                <Text fontWeight="bold" mb={2} color="white">Temperature:</Text>
                <Input
                  type="number"
                  min="0"
                  max="2"
                  step="0.1"
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value) || 0.7)}
                  bg="gray.800"
                  borderColor="gray.700"
                  _hover={{ borderColor: 'gray.600' }}
                  _focus={{ borderColor: 'blue.500' }}
                  color="white"
                />
                <Text fontSize="xs" color="gray.400" mt={1}>
                  Controls randomness (0 = focused, 2 = creative)
                </Text>
              </Box>

              <Box flex={1}>
                <Text fontWeight="bold" mb={2} color="white">Max Tokens:</Text>
                <Input
                  type="number"
                  min="256"
                  max="64000"
                  step="256"
                  value={maxTokens}
                  onChange={(e) => setMaxTokens(parseInt(e.target.value) || 4096)}
                  bg="gray.800"
                  borderColor="gray.700"
                  _hover={{ borderColor: 'gray.600' }}
                  _focus={{ borderColor: 'blue.500' }}
                  color="white"
                />
                <Text fontSize="xs" color="gray.400" mt={1}>
                  Maximum response length
                </Text>
              </Box>
            </Stack>
            
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
                Provider: {provider === 'anthropic' ? 'Claude (Anthropic)' : 'OpenAI'} • 
                Model: {provider === 'anthropic' ? 'Claude Sonnet 4.5' : 'GPT-4o'} • 
                Temperature: {temperature} • Max Tokens: {maxTokens.toLocaleString()}
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

import { Button } from '@/renderer/components/ui/button';
import { Input } from '@/renderer/components/ui/input';
import { Box, Heading, Stack, Text, VStack } from '@chakra-ui/react';
import type { AIProviderType } from '@shared/types';
import { useEffect, useMemo, useState } from 'react';
import { useAI } from '../hooks/useAI';

export const AITest = () => {
  const {
    isConfigured,
    isLoading,
    error,
    activeConversation,
    configure,
    updateConfig,
    sendMessage,
    createConversation,
  } = useAI();

  const [apiKey, setApiKey] = useState(import.meta.env.VITE_ANTHROPIC_API_KEY || '');
  const [message, setMessage] = useState('What are the most reliable classic buy signals in technical analysis?');
  const [provider, setProvider] = useState<AIProviderType>('anthropic');
  const [model, setModel] = useState('claude-sonnet-4-5-20250929');
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(4096);
  const [showSettings, setShowSettings] = useState(false);

  const apiKeyEnvVar = useMemo(() => {
    switch (provider) {
      case 'anthropic':
        return import.meta.env.VITE_ANTHROPIC_API_KEY;
      case 'openai':
        return import.meta.env.VITE_OPENAI_API_KEY;
      case 'gemini':
        return import.meta.env.VITE_GEMINI_API_KEY;
      default:
        return '';
    }
  }, [provider]);

  const defaultModel = useMemo(() => {
    switch (provider) {
      case 'anthropic':
        return 'claude-sonnet-4-5-20250929';
      case 'openai':
        return 'gpt-4o';
      case 'gemini':
        return 'gemini-2.0-flash-exp';
      default:
        return '';
    }
  }, [provider]);

  const apiKeyPlaceholder = useMemo(() => {
    switch (provider) {
      case 'anthropic':
        return 'sk-ant-...';
      case 'openai':
        return 'sk-proj-...';
      case 'gemini':
        return 'AIza...';
      default:
        return '';
    }
  }, [provider]);

  const providerDisplayName = useMemo(() => {
    switch (provider) {
      case 'anthropic':
        return 'Anthropic';
      case 'openai':
        return 'OpenAI';
      case 'gemini':
        return 'Google';
      default:
        return '';
    }
  }, [provider]);

  const pricingInfo = useMemo(() => {
    switch (provider) {
      case 'anthropic':
        return 'Prices in $/MTok (Input/Output). Haiku = fastest, Sonnet = balanced, Opus = most capable';
      case 'openai':
        return 'GPT-4o: $2.50/MTok in, $10/MTok out | Mini: $0.15/$0.60';
      case 'gemini':
        return 'Gemini 2.0 Flash is FREE! 1.5 Flash-8B cheapest paid at $0.0375/$0.15';
      default:
        return '';
    }
  }, [provider]);

  const modelOptions = useMemo(() => {
    switch (provider) {
      case 'anthropic':
        return [
          { value: 'claude-sonnet-4-5-20250929', label: 'Claude 4.5 Sonnet (Best balance) - $3/$15' },
          { value: 'claude-haiku-4-5-20251001', label: 'Claude 4.5 Haiku (Fastest) - $1/$5' },
          { value: 'claude-opus-4-1-20250805', label: 'Claude 4.1 Opus (Most capable) - $15/$75' },
          { value: 'claude-3-7-sonnet-20250219', label: 'Claude 3.7 Sonnet - $3/$15' },
          { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet - $3/$15' },
          { value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku (Cheapest) - $0.80/$4' },
        ];
      case 'openai':
        return [
          { value: 'gpt-4o', label: 'GPT-4o (Latest) - $2.50/$10' },
          { value: 'gpt-4o-mini', label: 'GPT-4o Mini (Faster, cheaper) - $0.15/$0.60' },
        ];
      case 'gemini':
        return [
          { value: 'gemini-2.0-flash-exp', label: 'Gemini 2.0 Flash (Experimental) - FREE' },
          { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro (Best quality) - $1.25/$5' },
          { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash (Fast) - $0.075/$0.30' },
          { value: 'gemini-1.5-flash-8b', label: 'Gemini 1.5 Flash-8B (Cheapest) - $0.0375/$0.15' },
        ];
      default:
        return [];
    }
  }, [provider]);

  useEffect(() => {
    setApiKey(apiKeyEnvVar || '');
    setModel(defaultModel);
  }, [apiKeyEnvVar, defaultModel]);

  const handleConfigure = () => {
    if (!apiKey.trim()) return;

    configure({
      provider,
      model,
      temperature,
      maxTokens,
    });

    createConversation();
    setShowSettings(false);
  };

  const handleUpdateConfig = () => {
    if (!apiKey.trim()) return;

    updateConfig({
      provider,
      model,
      temperature,
      maxTokens,
    });

    setShowSettings(false);
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

        {!isConfigured || showSettings ? (
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
              <Text fontSize="sm" ml={4} mb={1} color="blue.200">
                • OpenAI: <Text as="span" textDecoration="underline">platform.openai.com/api-keys</Text>
              </Text>
              <Text fontSize="sm" ml={4} mb={2} color="blue.200">
                • Gemini: <Text as="span" textDecoration="underline">aistudio.google.com/apikey</Text>
              </Text>
              <Text fontSize="sm" mb={2} color="blue.50">
                3. Paste it below (stored in localStorage)
              </Text>
              <Text fontSize="sm" color="blue.50">
                4. Click "{isConfigured ? 'Update Settings' : 'Configure AI'}" to start testing
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
                  Anthropic (Claude)
                </option>
                <option value="openai" style={{ background: '#1a202c' }}>
                  OpenAI (GPT)
                </option>
                <option value="gemini" style={{ background: '#1a202c' }}>
                  Google (Gemini)
                </option>
              </select>
            </Box>

            <Box>
              <Text fontWeight="bold" mb={2} color="white">Model:</Text>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
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
                {modelOptions.map(option => (
                  <option key={option.value} value={option.value} style={{ background: '#1a202c' }}>
                    {option.label}
                  </option>
                ))}
              </select>
              <Text fontSize="xs" color="gray.400" mt={1}>
                {pricingInfo}
              </Text>
            </Box>

            <Box>
              <Text fontWeight="bold" mb={2} color="white">API Key:</Text>
              <Input
                type="password"
                placeholder={apiKeyPlaceholder}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                bg="gray.800"
                borderColor="gray.700"
                _hover={{ borderColor: 'gray.600' }}
                _focus={{ borderColor: 'blue.500' }}
                color="white"
              />
              <Text fontSize="xs" color="gray.400" mt={1}>
                Your API key is stored locally and never sent anywhere except {providerDisplayName}
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
            
            <Stack direction="row" gap={4} justify="flex-end">
              {isConfigured && (
                <Button 
                  onClick={() => setShowSettings(false)} 
                  colorScheme="gray"
                  variant="solid"
                  size="lg"
                >
                  Cancel
                </Button>
              )}
              <Button 
                onClick={isConfigured ? handleUpdateConfig : handleConfigure} 
                colorScheme="blue"
                size="lg"
                disabled={!apiKey.trim()}
              >
                {isConfigured ? 'Update Settings' : 'Configure AI'}
              </Button>
            </Stack>
          </Stack>
        ) : (
          <VStack gap={4} align="stretch">
            <Box p={3} bg="green.900" borderRadius="md" borderLeft="4px solid" borderColor="green.500">
              <Stack direction="row" justify="space-between" align="start">
                <Box flex={1}>
                  <Text fontWeight="bold" color="green.100" mb={2}>✓ AI Configured Successfully</Text>
                  <VStack align="start" gap={1}>
                    <Text fontSize="sm" color="green.50">
                      <Text as="span" fontWeight="semibold">Provider:</Text> {providerDisplayName}
                    </Text>
                    <Text fontSize="sm" color="green.50">
                      <Text as="span" fontWeight="semibold">Model:</Text> {model}
                    </Text>
                    <Text fontSize="sm" color="green.50">
                      <Text as="span" fontWeight="semibold">Temperature:</Text> {temperature}
                    </Text>
                    <Text fontSize="sm" color="green.50">
                      <Text as="span" fontWeight="semibold">Max Tokens:</Text> {maxTokens.toLocaleString()}
                    </Text>
                  </VStack>
                </Box>
                <Button 
                  onClick={() => setShowSettings(true)}
                  size="sm"
                  colorScheme="green"
                  variant="outline"
                  color="green.200"
                  px={4}
                  _hover={{ bg: 'green.800', color: 'white' }}
                >
                  Change Settings
                </Button>
              </Stack>
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
                      {msg.role === 'user' ? '👤 You' : '🤖 AI Assistant'}
                      {msg.model && msg.role === 'assistant' && ` (${msg.model})`} • {new Date(msg.timestamp).toLocaleTimeString()}
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

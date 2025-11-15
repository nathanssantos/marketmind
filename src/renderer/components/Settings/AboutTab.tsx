import { Box, Link, Separator, Stack, Text } from '@chakra-ui/react';
import { HiArrowTopRightOnSquare } from 'react-icons/hi2';

export const AboutTab = () => {
  return (
    <Stack gap={6}>
      <Box>
        <Text fontSize="2xl" fontWeight="bold" mb={2}>
          MarketMind
        </Text>
        <Text fontSize="md" color="fg.muted" mb={4}>
          Version 0.6.0
        </Text>
        <Text fontSize="sm" color="fg.muted">
          An AI-powered trading assistant that combines advanced financial chart visualization 
          with artificial intelligence to provide insights on cryptocurrencies, stocks, and other tradeable assets.
        </Text>
      </Box>

      <Separator />

      <Box>
        <Text fontSize="md" fontWeight="medium" mb={3}>
          Features
        </Text>
        <Stack gap={2} fontSize="sm" color="fg.muted">
          <Text>• Real-time cryptocurrency market data (Binance)</Text>
          <Text>• Advanced candlestick charts with 5 moving averages</Text>
          <Text>• AI analysis with OpenAI, Claude, and Gemini</Text>
          <Text>• Interactive chat interface with conversation history</Text>
          <Text>• Light and dark themes</Text>
          <Text>• WebSocket live updates</Text>
        </Stack>
      </Box>

      <Separator />

      <Box>
        <Text fontSize="md" fontWeight="medium" mb={3}>
          Technology Stack
        </Text>
        <Stack gap={2} fontSize="sm" color="fg.muted">
          <Text>• Electron 39.2.0 - Desktop framework</Text>
          <Text>• React 19.2.0 - UI framework</Text>
          <Text>• TypeScript 5.9.3 - Type safety</Text>
          <Text>• Chakra UI 3.29.0 - Component library</Text>
          <Text>• Vite 7.2.2 - Build tool</Text>
          <Text>• Zustand 5.0.8 - State management</Text>
        </Stack>
      </Box>

      <Separator />

      <Box>
        <Text fontSize="md" fontWeight="medium" mb={3}>
          Resources
        </Text>
        <Stack gap={2} fontSize="sm">
          <Link href="https://github.com/nathanssantos/marketmind" target="_blank" color="blue.500" display="flex" alignItems="center" gap={1}>
            GitHub Repository
            <HiArrowTopRightOnSquare />
          </Link>
          <Link href="https://github.com/nathanssantos/marketmind/blob/main/docs/AI_CONTEXT.md" target="_blank" color="blue.500" display="flex" alignItems="center" gap={1}>
            Documentation
            <HiArrowTopRightOnSquare />
          </Link>
          <Link href="https://github.com/nathanssantos/marketmind/blob/main/docs/CHANGELOG.md" target="_blank" color="blue.500" display="flex" alignItems="center" gap={1}>
            Changelog
            <HiArrowTopRightOnSquare />
          </Link>
        </Stack>
      </Box>

      <Box bg="bg.muted" p={4} borderRadius="md">
        <Text fontSize="sm" color="fg.muted">
          © 2025 MarketMind. Built with ❤️ for traders and investors.
        </Text>
      </Box>
    </Stack>
  );
};

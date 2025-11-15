import { Box, ChakraProvider, Text, VStack } from '@chakra-ui/react';
import type { ReactElement } from 'react';
import { ChartCanvas } from './components/Chart/ChartCanvas';
import type { MovingAverageConfig } from './components/Chart/useMovingAverageRenderer';
import { system } from './theme';
import { SAMPLE_CANDLES } from './utils/sampleData';

const MOVING_AVERAGES: MovingAverageConfig[] = [
  {
    period: 9,
    type: 'EMA',
    color: '#ff9800',
    lineWidth: 2,
    visible: true,
  },
];

function App(): ReactElement {
  return (
    <ChakraProvider value={system}>
      <Box minH="100vh" bg="gray.50" _dark={{ bg: 'gray.900' }} p={8}>
        <VStack gap={6} align="stretch">
          <Box textAlign="center">
            <Text fontSize="4xl" fontWeight="bold" mb={2}>
              📊 MarketMind
            </Text>
            <Text fontSize="xl" color="gray.600" _dark={{ color: 'gray.400' }}>
              AI-powered consultant for technical analysis
            </Text>
          </Box>

          <ChartCanvas 
            candles={SAMPLE_CANDLES} 
            height="700px"
            movingAverages={MOVING_AVERAGES}
          />
        </VStack>
      </Box>
    </ChakraProvider>
  );
}

export default App;

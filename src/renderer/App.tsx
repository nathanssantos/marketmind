import { Box, ChakraProvider } from '@chakra-ui/react';
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
      <Box w="100vw" h="100vh" bg="gray.900">
        <ChartCanvas 
          candles={SAMPLE_CANDLES} 
          width="100%"
          height="100%"
          movingAverages={MOVING_AVERAGES}
        />
      </Box>
    </ChakraProvider>
  );
}

export default App;

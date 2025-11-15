import { Box, ChakraProvider } from '@chakra-ui/react';
import type { ReactElement } from 'react';
import { useState } from 'react';
import { ChartCanvas } from './components/Chart/ChartCanvas';
import { ChartControls } from './components/Chart/ChartControls';
import type { MovingAverageConfig } from './components/Chart/useMovingAverageRenderer';
import { system } from './theme';
import { SAMPLE_CANDLES } from './utils/sampleData';

const DEFAULT_MOVING_AVERAGES: MovingAverageConfig[] = [
  {
    period: 9,
    type: 'EMA',
    color: '#ff9800',
    lineWidth: 2,
    visible: true,
  },
  {
    period: 20,
    type: 'SMA',
    color: '#2196f3',
    lineWidth: 2,
    visible: true,
  },
  {
    period: 50,
    type: 'SMA',
    color: '#4caf50',
    lineWidth: 2,
    visible: false,
  },
];

function App(): ReactElement {
  const [showVolume, setShowVolume] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [chartType, setChartType] = useState<'candlestick' | 'line'>('candlestick');
  const [movingAverages, setMovingAverages] = useState<MovingAverageConfig[]>(
    DEFAULT_MOVING_AVERAGES
  );

  return (
    <ChakraProvider value={system}>
      <Box w="100vw" h="100vh" bg="gray.900" position="relative">
        <ChartControls
          showVolume={showVolume}
          showGrid={showGrid}
          chartType={chartType}
          movingAverages={movingAverages}
          onShowVolumeChange={setShowVolume}
          onShowGridChange={setShowGrid}
          onChartTypeChange={setChartType}
          onMovingAveragesChange={setMovingAverages}
        />
        <ChartCanvas 
          candles={SAMPLE_CANDLES} 
          width="100%"
          height="100%"
          showVolume={showVolume}
          showGrid={showGrid}
          chartType={chartType}
          movingAverages={movingAverages}
        />
      </Box>
    </ChakraProvider>
  );
}

export default App;

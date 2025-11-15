import { Box, ChakraProvider, Stack } from '@chakra-ui/react';
import type { ReactElement } from 'react';
import { ChartCanvas } from './components/Chart/ChartCanvas';
import { ChartControls } from './components/Chart/ChartControls';
import { AdvancedControls, type AdvancedControlsConfig } from './components/Chart/AdvancedControls';
import type { MovingAverageConfig } from './components/Chart/useMovingAverageRenderer';
import { PinnedControlsProvider } from './components/Chart/PinnedControlsContext';
import type { Timeframe } from './components/Chart/TimeframeSelector';
import { useDebounce } from './hooks/useDebounce';
import { useLocalStorage } from './hooks/useLocalStorage';
import { system } from './theme';
import { SAMPLE_CANDLES } from './utils/sampleData';
import { CHART_CONFIG } from '@shared/constants/chartConfig';

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
  {
    period: 100,
    type: 'SMA',
    color: '#9c27b0',
    lineWidth: 2,
    visible: false,
  },
  {
    period: 200,
    type: 'SMA',
    color: '#f44336',
    lineWidth: 2,
    visible: false,
  },
];

function App(): ReactElement {
  const [showVolume, setShowVolume] = useLocalStorage('marketmind:showVolume', true);
  const [showGrid, setShowGrid] = useLocalStorage('marketmind:showGrid', true);
  const [chartType, setChartType] = useLocalStorage<'candlestick' | 'line'>('marketmind:chartType', 'candlestick');
  const [timeframe, setTimeframe] = useLocalStorage<Timeframe>('marketmind:timeframe', '1d');
  const [movingAverages, setMovingAverages] = useLocalStorage<MovingAverageConfig[]>(
    'marketmind:movingAverages',
    DEFAULT_MOVING_AVERAGES
  );
  const [advancedConfig, setAdvancedConfig] = useLocalStorage<AdvancedControlsConfig>('marketmind:advancedConfig', {
    rightMargin: CHART_CONFIG.CHART_RIGHT_MARGIN,
    volumeHeightRatio: CHART_CONFIG.VOLUME_HEIGHT_RATIO,
    candleSpacing: CHART_CONFIG.CANDLE_SPACING,
    candleWickWidth: CHART_CONFIG.CANDLE_WICK_WIDTH,
    gridLineWidth: CHART_CONFIG.GRID_LINE_WIDTH,
    paddingTop: CHART_CONFIG.CANVAS_PADDING_TOP,
    paddingBottom: CHART_CONFIG.CANVAS_PADDING_BOTTOM,
    paddingLeft: CHART_CONFIG.CANVAS_PADDING_LEFT,
    paddingRight: CHART_CONFIG.CANVAS_PADDING_RIGHT,
  });

  // Debounce advanced config changes to avoid excessive re-renders
  const debouncedAdvancedConfig = useDebounce(advancedConfig, 300);

  return (
    <ChakraProvider value={system}>
      <PinnedControlsProvider>
        <Box w="100vw" h="100vh" bg="gray.900" position="relative">
          {/* Controls Container */}
          <Stack 
            position="absolute" 
            top={4} 
            left={4} 
            gap={4} 
            zIndex={10}
          >
            <ChartControls
              showVolume={showVolume}
              showGrid={showGrid}
              chartType={chartType}
              movingAverages={movingAverages}
              advancedConfig={advancedConfig}
              timeframe={timeframe}
              onShowVolumeChange={setShowVolume}
              onShowGridChange={setShowGrid}
              onChartTypeChange={setChartType}
              onMovingAveragesChange={setMovingAverages}
              onAdvancedConfigChange={setAdvancedConfig}
              onTimeframeChange={setTimeframe}
            />
            <AdvancedControls
              config={advancedConfig}
              onConfigChange={setAdvancedConfig}
            />
          </Stack>
          
          <ChartCanvas 
            candles={SAMPLE_CANDLES} 
            width="100%"
            height="100%"
            showVolume={showVolume}
            showGrid={showGrid}
            chartType={chartType}
            movingAverages={movingAverages}
            advancedConfig={debouncedAdvancedConfig}
          />
        </Box>
      </PinnedControlsProvider>
    </ChakraProvider>
  );
}

export default App;

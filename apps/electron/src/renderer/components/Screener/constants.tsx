import type { TimeInterval, ScreenerPresetCategory } from '@marketmind/types';
import type { SelectOption } from '@renderer/components/ui';
import {
  LuArrowDownRight,
  LuArrowUpRight,
  LuActivity,
  LuChartBar,
  LuClock,
  LuMoveRight,
  LuRefreshCw,
  LuTarget,
  LuTrendingDown,
  LuTrendingUp,
  LuUnlink,
  LuZap,
  LuArrowDownLeft,
  LuArrowUpLeft,
} from 'react-icons/lu';

export const SCANNER_ICON_MAP: Record<string, React.ReactNode> = {
  TrendingUp: <LuTrendingUp />,
  TrendingDown: <LuTrendingDown />,
  Unlink: <LuUnlink />,
  ArrowDownCircle: <LuArrowDownLeft />,
  ArrowUpCircle: <LuArrowUpLeft />,
  Zap: <LuZap />,
  BarChart3: <LuChartBar />,
  Target: <LuTarget />,
  RefreshCw: <LuRefreshCw />,
  Activity: <LuActivity />,
  ArrowUpRight: <LuArrowUpRight />,
  ArrowDownRight: <LuArrowDownRight />,
  MoveRight: <LuMoveRight />,
  Clock: <LuClock />,
};

export const SCANNER_TIMEFRAME_OPTIONS: { value: TimeInterval; label: string }[] = [
  { value: '15m', label: '15m' },
  { value: '30m', label: '30m' },
  { value: '1h', label: '1h' },
  { value: '4h', label: '4h' },
];

export const SCREENER_INTERVAL_OPTIONS: SelectOption[] = [
  ...SCANNER_TIMEFRAME_OPTIONS,
  { value: '1d', label: '1d' },
];

export const SCANNER_CATEGORY_ORDER: ScreenerPresetCategory[] = [
  'momentum',
  'volume',
  'volatility',
  'mean_reversion',
  'market_data',
];

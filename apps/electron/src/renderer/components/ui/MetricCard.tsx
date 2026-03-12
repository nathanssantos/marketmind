import { Box, Flex, Icon, Text } from '@chakra-ui/react';
import { getPnLColor } from '@/renderer/theme';
import type { ReactNode } from 'react';
import { LuTrendingDown, LuTrendingUp } from 'react-icons/lu';
import { useColorMode } from './color-mode';

type MetricFormat = 'currency' | 'percent' | 'number';
type TrendDirection = 'up' | 'down' | 'neutral';

interface MetricCardProps {
  label: string;
  value: string | number;
  trend?: TrendDirection;
  trendValue?: string;
  format?: MetricFormat;
  currency?: string;
  size?: 'sm' | 'md' | 'lg';
  helpText?: ReactNode;
  colorByValue?: boolean;
}

const sizeConfig = {
  sm: { labelSize: 'xs', valueSize: 'md', trendSize: 'xs' },
  md: { labelSize: 'sm', valueSize: 'lg', trendSize: 'xs' },
  lg: { labelSize: 'sm', valueSize: 'xl', trendSize: 'sm' },
} as const;

const formatValue = (value: string | number, format: MetricFormat, currency: string): string => {
  if (typeof value === 'string') return value;

  switch (format) {
    case 'currency':
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value);
    case 'percent':
      return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
    case 'number':
    default:
      return value.toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      });
  }
};

const getTrendColor = (trend: TrendDirection): string => {
  switch (trend) {
    case 'up':
      return 'green.500';
    case 'down':
      return 'red.500';
    case 'neutral':
    default:
      return 'fg.muted';
  }
};

export const MetricCard = ({
  label,
  value,
  trend,
  trendValue,
  format = 'number',
  currency = 'USD',
  size = 'md',
  helpText,
  colorByValue = false,
}: MetricCardProps) => {
  const { colorMode } = useColorMode();
  const config = sizeConfig[size];
  const formattedValue = formatValue(value, format, currency);

  const numericValue = typeof value === 'number' ? value : parseFloat(String(value)) || 0;
  const valueColor = colorByValue ? getPnLColor(numericValue, colorMode) : undefined;

  return (
    <Box>
      <Text fontSize={config.labelSize} color="fg.muted" mb={1}>
        {label}
      </Text>
      <Flex align="baseline" gap={2}>
        <Text fontSize={config.valueSize} fontWeight="semibold" color={valueColor}>
          {formattedValue}
        </Text>
        {trend && trend !== 'neutral' && (
          <Flex align="center" gap={0.5} color={getTrendColor(trend)}>
            <Icon as={trend === 'up' ? LuTrendingUp : LuTrendingDown} boxSize={3} />
            {trendValue && (
              <Text fontSize={config.trendSize} fontWeight="medium">
                {trendValue}
              </Text>
            )}
          </Flex>
        )}
      </Flex>
      {helpText && (
        <Text fontSize="xs" color="fg.muted" mt={1}>
          {helpText}
        </Text>
      )}
    </Box>
  );
};

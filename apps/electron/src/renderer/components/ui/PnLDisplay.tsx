import { Text } from '@chakra-ui/react';
import { useColorMode } from '@/renderer/components/ui/color-mode';
import { getPnLColor } from '@/renderer/theme';
import type { ReactNode } from 'react';

type PnLFormat = 'currency' | 'percent' | 'number';

interface PnLDisplayProps {
  value: number;
  format?: PnLFormat;
  currency?: string;
  showSign?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  fontWeight?: 'normal' | 'medium' | 'semibold' | 'bold';
  prefix?: ReactNode;
  suffix?: ReactNode;
}

const formatCurrencyValue = (value: number, currency: string): string => {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

const formatValue = (value: number, format: PnLFormat, currency: string, showSign: boolean): string => {
  const sign = showSign && value > 0 ? '+' : '';

  switch (format) {
    case 'currency':
      return sign + formatCurrencyValue(value, currency);
    case 'percent':
      return sign + value.toFixed(2) + '%';
    case 'number':
    default:
      return sign + value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
};

const sizeMap = {
  xs: 'xs',
  sm: 'sm',
  md: 'md',
  lg: 'lg',
} as const;

export const PnLDisplay = ({
  value,
  format = 'currency',
  currency = 'USD',
  showSign = true,
  size = 'md',
  fontWeight = 'medium',
  prefix,
  suffix,
}: PnLDisplayProps) => {
  const { colorMode } = useColorMode();
  const color = getPnLColor(value, colorMode);
  const formattedValue = formatValue(value, format, currency, showSign);

  return (
    <Text as="span" color={color} fontSize={sizeMap[size]} fontWeight={fontWeight}>
      {prefix}
      {formattedValue}
      {suffix}
    </Text>
  );
};

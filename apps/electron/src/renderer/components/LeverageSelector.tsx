import { Button, Slider } from '@renderer/components/ui';
import {
  Box,
  Flex,
  HStack,
  Text,
  VStack,
} from '@chakra-ui/react';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuTriangleAlert } from 'react-icons/lu';

interface LeverageSelectorProps {
  value: number;
  onChange: (leverage: number) => void;
  maxLeverage?: number;
  disabled?: boolean;
}

const LEVERAGE_PRESETS = [1, 2, 3, 5, 10, 20, 50, 75, 100, 125];

export function LeverageSelector({
  value,
  onChange,
  maxLeverage = 125,
  disabled = false,
}: LeverageSelectorProps) {
  const { t } = useTranslation();
  const [sliderValue, setSliderValue] = useState(value);

  const handleSliderChange = useCallback(
    (values: number[]) => {
      const newValue = values[0] ?? value;
      setSliderValue(newValue);
      onChange(newValue);
    },
    [onChange, value]
  );

  const handlePresetClick = useCallback(
    (preset: number) => {
      const clampedValue = Math.min(preset, maxLeverage);
      setSliderValue(clampedValue);
      onChange(clampedValue);
    },
    [maxLeverage, onChange]
  );

  const isHighRisk = value > 20;
  const isExtremeRisk = value > 50;

  const getLeverageColor = (): string => {
    if (isExtremeRisk) return 'trading.loss';
    if (isHighRisk) return 'trading.warning';
    return 'trading.profit';
  };

  return (
    <VStack gap={3} align="stretch" w="100%">
      <Flex justify="space-between" align="center">
        <Text fontSize="sm" fontWeight="medium" color="fg">
          {t('futures.leverage', 'Leverage')}
        </Text>
        <Flex align="center" gap={2}>
          <Text fontSize="lg" fontWeight="bold" color={getLeverageColor()}>
            {value}x
          </Text>
          {isHighRisk && (
            <Box color="orange.fg">
              <LuTriangleAlert size={16} />
            </Box>
          )}
        </Flex>
      </Flex>

      <Box px={2}>
        <Slider
          value={[sliderValue]}
          min={1}
          max={maxLeverage}
          step={1}
          onValueChange={handleSliderChange}
        />
      </Box>

      <Flex wrap="wrap" gap={1} justify="center">
        {LEVERAGE_PRESETS.filter((p) => p <= maxLeverage).map((preset) => (
          <Button
            key={preset}
            size="2xs"
            variant={value === preset ? 'solid' : 'outline'}
            colorPalette={preset > 50 ? 'red' : preset > 20 ? 'orange' : 'gray'}
            onClick={() => handlePresetClick(preset)}
            disabled={disabled}
            minW="40px"
          >
            {preset}x
          </Button>
        ))}
      </Flex>

      {isHighRisk && (
        <Box
          p={2}
          bg={isExtremeRisk ? 'red.subtle' : 'orange.subtle'}
          borderRadius="md"
          borderWidth="1px"
          borderColor={isExtremeRisk ? 'red.emphasized' : 'orange.emphasized'}
        >
          <HStack gap={2}>
            <Box color={isExtremeRisk ? 'red.fg' : 'orange.fg'}>
              <LuTriangleAlert size={14} />
            </Box>
            <Text fontSize="2xs" color={isExtremeRisk ? 'red.fg' : 'orange.fg'}>
              {isExtremeRisk
                ? t('futures.extremeRiskWarning', 'Extreme risk! Liquidation can happen quickly with small price movements.')
                : t('futures.highRiskWarning', 'High leverage increases both potential profits and losses.')}
            </Text>
          </HStack>
        </Box>
      )}

      <Flex justify="space-between" px={1}>
        <Text fontSize="2xs" color="fg.muted">
          {t('futures.minLeverage', 'Min: 1x')}
        </Text>
        <Text fontSize="2xs" color="fg.muted">
          {t('futures.maxLeverage', 'Max: {{max}}x', { max: maxLeverage })}
        </Text>
      </Flex>
    </VStack>
  );
}

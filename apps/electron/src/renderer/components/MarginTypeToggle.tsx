import { Box, Flex, Text, VStack } from '@chakra-ui/react';
import { Button, TooltipWrapper } from '@renderer/components/ui';
import type { MarginType } from '@marketmind/types';
import { useTranslation } from 'react-i18next';
import { LuInfo, LuShield, LuWallet } from 'react-icons/lu';

interface MarginTypeToggleProps {
  value: MarginType;
  onChange: (marginType: MarginType) => void;
  disabled?: boolean;
}

export function MarginTypeToggle({ value, onChange, disabled = false }: MarginTypeToggleProps) {
  const { t } = useTranslation();

  return (
    <VStack gap={2} align="stretch" w="100%">
      <Flex justify="space-between" align="center">
        <Flex align="center" gap={1}>
          <Text fontSize="sm" fontWeight="medium" color="fg">
            {t('futures.marginType', 'Margin Type')}
          </Text>
          <TooltipWrapper
            label={t('futures.marginTypeInfo', 'Isolated: Each position has its own margin. Crossed: All positions share margin.')}
            showArrow
          >
            <Box color="fg.muted" cursor="help">
              <LuInfo size={12} />
            </Box>
          </TooltipWrapper>
        </Flex>
      </Flex>

      <Flex gap={2}>
        <Button
          flex={1}
          size="sm"
          variant="outline"
          color={value === 'ISOLATED' ? 'trading.info' : 'fg.muted'}
          onClick={() => onChange('ISOLATED')}
          disabled={disabled}
        >
          <Flex align="center" gap={2}>
            <LuShield size={14} />
            <Text fontSize="xs">{t('futures.isolated', 'Isolated')}</Text>
          </Flex>
        </Button>
        <Button
          flex={1}
          size="sm"
          variant="outline"
          color={value === 'CROSSED' ? 'trading.warning' : 'fg.muted'}
          onClick={() => onChange('CROSSED')}
          disabled={disabled}
        >
          <Flex align="center" gap={2}>
            <LuWallet size={14} />
            <Text fontSize="xs">{t('futures.crossed', 'Cross')}</Text>
          </Flex>
        </Button>
      </Flex>

      <Box p={2} bg="bg.muted" borderRadius="md">
        <Text fontSize="2xs" color="fg.muted">
          {value === 'ISOLATED'
            ? t('futures.isolatedDesc', 'Recommended: Risk is limited to the margin assigned to this position.')
            : t('futures.crossedDesc', 'All available balance is used as margin. Higher liquidation risk.')}
        </Text>
      </Box>
    </VStack>
  );
}

import { Box, Flex, Text, VStack } from '@chakra-ui/react';
import { Badge, TooltipWrapper } from '@renderer/components/ui';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { LuPercent, LuShield, LuTrendingUp, LuTriangleAlert } from 'react-icons/lu';

interface MarginRequirements {
  initialMargin: number;
  maintenanceMargin: number;
  buyingPower: number;
  equity: number;
  marginUsed: number;
  availableMargin: number;
}

interface MarginImpact {
  initialRequired: number;
  maintenanceRequired: number;
  newBuyingPower: number;
  newMarginUsed: number;
  isSafe: boolean;
  warningMessage?: string;
}

interface MarginInfoPanelProps {
  requirements: MarginRequirements;
  impact?: MarginImpact;
  show?: boolean;
}

const REG_T_INITIAL_MARGIN = 0.5;
const REG_T_MAINTENANCE_MARGIN = 0.25;

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const formatPercent = (value: number): string => {
  return `${(value * 100).toFixed(1)}%`;
};

const getMarginHealthColor = (marginUsed: number, equity: number): string => {
  const ratio = marginUsed / equity;
  if (ratio < 0.5) return 'green';
  if (ratio < 0.7) return 'yellow';
  if (ratio < 0.85) return 'orange';
  return 'red';
};

export function MarginInfoPanel({ requirements, impact, show = true }: MarginInfoPanelProps) {
  const { t } = useTranslation();

  const marginHealth = useMemo(() => {
    return getMarginHealthColor(requirements.marginUsed, requirements.equity);
  }, [requirements.marginUsed, requirements.equity]);

  const marginUtilization = useMemo(() => {
    if (requirements.equity === 0) return 0;
    return requirements.marginUsed / requirements.equity;
  }, [requirements.marginUsed, requirements.equity]);

  if (!show) return null;

  return (
    <Box borderWidth="1px" borderRadius="md" borderColor="border" p={3}>
      <Flex align="center" justify="space-between" mb={3}>
        <Flex align="center" gap={2}>
          <LuShield size={14} />
          <Text fontSize="xs" fontWeight="semibold">
            {t('marginInfo.title')}
          </Text>
        </Flex>
        <Badge size="xs" colorPalette={marginHealth} variant="subtle">
          {formatPercent(marginUtilization)} {t('marginInfo.used')}
        </Badge>
      </Flex>

      <VStack gap={2} align="stretch">
        <Flex justify="space-between" fontSize="2xs">
          <Text color="fg.muted">{t('marginInfo.buyingPower')}</Text>
          <Text fontWeight="medium" color="green.fg">
            {formatCurrency(requirements.buyingPower)}
          </Text>
        </Flex>

        <Flex justify="space-between" fontSize="2xs">
          <Text color="fg.muted">{t('marginInfo.equity')}</Text>
          <Text fontWeight="medium">{formatCurrency(requirements.equity)}</Text>
        </Flex>

        <Flex justify="space-between" fontSize="2xs">
          <Text color="fg.muted">{t('marginInfo.marginUsed')}</Text>
          <Text fontWeight="medium">{formatCurrency(requirements.marginUsed)}</Text>
        </Flex>

        <Flex justify="space-between" fontSize="2xs">
          <Text color="fg.muted">{t('marginInfo.availableMargin')}</Text>
          <Text fontWeight="medium">{formatCurrency(requirements.availableMargin)}</Text>
        </Flex>

        <Box h="1px" bg="border" my={1} />

        <Flex justify="space-between" fontSize="2xs">
          <TooltipWrapper label={t('marginInfo.initialMarginTooltip')} showArrow>
            <Flex align="center" gap={1} cursor="help">
              <LuPercent size={10} />
              <Text color="fg.muted">{t('marginInfo.initialMargin')}</Text>
            </Flex>
          </TooltipWrapper>
          <Text>{formatPercent(REG_T_INITIAL_MARGIN)}</Text>
        </Flex>

        <Flex justify="space-between" fontSize="2xs">
          <TooltipWrapper label={t('marginInfo.maintenanceMarginTooltip')} showArrow>
            <Flex align="center" gap={1} cursor="help">
              <LuPercent size={10} />
              <Text color="fg.muted">{t('marginInfo.maintenanceMargin')}</Text>
            </Flex>
          </TooltipWrapper>
          <Text>{formatPercent(REG_T_MAINTENANCE_MARGIN)}</Text>
        </Flex>
      </VStack>

      {impact && (
        <>
          <Box h="1px" bg="border" my={3} />

          <Flex align="center" gap={2} mb={2}>
            <LuTrendingUp size={12} />
            <Text fontSize="xs" fontWeight="semibold">
              {t('marginInfo.orderImpact')}
            </Text>
          </Flex>

          <VStack gap={2} align="stretch">
            <Flex justify="space-between" fontSize="2xs">
              <Text color="fg.muted">{t('marginInfo.requiredInitial')}</Text>
              <Text fontWeight="medium" color="orange.fg">
                {formatCurrency(impact.initialRequired)}
              </Text>
            </Flex>

            <Flex justify="space-between" fontSize="2xs">
              <Text color="fg.muted">{t('marginInfo.newBuyingPower')}</Text>
              <Text fontWeight="medium" color={impact.isSafe ? 'green.fg' : 'red.fg'}>
                {formatCurrency(impact.newBuyingPower)}
              </Text>
            </Flex>

            {!impact.isSafe && impact.warningMessage && (
              <Flex align="center" gap={2} p={2} borderRadius="md" bg="red.subtle">
                <LuTriangleAlert size={14} color="var(--chakra-colors-red-fg)" />
                <Text fontSize="2xs" color="red.fg">
                  {impact.warningMessage}
                </Text>
              </Flex>
            )}
          </VStack>
        </>
      )}
    </Box>
  );
}

export const createMockMarginRequirements = (): MarginRequirements => ({
  initialMargin: 0.5,
  maintenanceMargin: 0.25,
  buyingPower: 50000,
  equity: 100000,
  marginUsed: 35000,
  availableMargin: 65000,
});

export const calculateMarginImpact = (
  requirements: MarginRequirements,
  orderValue: number
): MarginImpact => {
  const initialRequired = orderValue * REG_T_INITIAL_MARGIN;
  const maintenanceRequired = orderValue * REG_T_MAINTENANCE_MARGIN;
  const newMarginUsed = requirements.marginUsed + initialRequired;
  const newBuyingPower = requirements.buyingPower - orderValue;

  const isSafe = newBuyingPower >= 0 && newMarginUsed <= requirements.equity * 0.85;

  let warningMessage: string | undefined;
  if (newBuyingPower < 0) {
    warningMessage = 'Insufficient buying power for this order';
  } else if (newMarginUsed > requirements.equity * 0.85) {
    warningMessage = 'Order would bring margin utilization above safe threshold';
  }

  return {
    initialRequired,
    maintenanceRequired,
    newBuyingPower,
    newMarginUsed,
    isSafe,
    warningMessage,
  };
};

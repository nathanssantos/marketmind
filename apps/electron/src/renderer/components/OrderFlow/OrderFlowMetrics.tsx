import { Box, Flex, Stack, Text } from '@chakra-ui/react';
import { useScalpingMetrics } from '@renderer/hooks/useScalpingMetrics';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

interface OrderFlowMetricsProps {
  symbol: string;
}

const OrderFlowMetricsComponent = ({ symbol }: OrderFlowMetricsProps) => {
  const { t } = useTranslation();
  const metrics = useScalpingMetrics(symbol);

  return (
    <Box p={3}>
      <Stack gap={2.5} fontSize="xs">
        <Text color="fg.muted" fontWeight="medium">{t('scalping.metric.orderFlow', 'Order Flow')}</Text>

        <Stack gap={1}>
          <Flex justify="space-between">
            <Text color="fg.muted">CVD</Text>
            <Text fontWeight="medium" fontFamily="mono">{metrics.cvd.toFixed(2)}</Text>
          </Flex>
          <Flex justify="space-between">
            <Text color="fg.muted">{t('scalping.metric.imbalance', 'Imbalance')}</Text>
            <Text fontWeight="medium" fontFamily="mono">{metrics.imbalanceRatio.toFixed(3)}</Text>
          </Flex>
          <Flex justify="space-between">
            <Text color="fg.muted">{t('scalping.metric.spread', 'Spread')}</Text>
            <Text fontWeight="medium" fontFamily="mono">{metrics.spreadPercent.toFixed(4)}%</Text>
          </Flex>
          <Flex justify="space-between">
            <Text color="fg.muted">{t('scalping.metric.absorption', 'Absorption')}</Text>
            <Text fontWeight="medium" fontFamily="mono">{metrics.absorptionScore.toFixed(2)}</Text>
          </Flex>
          <Flex justify="space-between">
            <Text color="fg.muted">{t('scalping.metric.microprice', 'Microprice')}</Text>
            <Text fontWeight="medium" fontFamily="mono">{metrics.microprice.toFixed(2)}</Text>
          </Flex>
          <Flex justify="space-between">
            <Text color="fg.muted">{t('scalping.metric.exhaustion', 'Exhaustion')}</Text>
            <Text fontWeight="medium" fontFamily="mono">{metrics.exhaustionScore.toFixed(2)}</Text>
          </Flex>
        </Stack>
      </Stack>
    </Box>
  );
};

export const OrderFlowMetrics = memo(OrderFlowMetricsComponent);

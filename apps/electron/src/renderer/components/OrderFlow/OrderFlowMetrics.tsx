import { Box, Flex, Stack, Text } from '@chakra-ui/react';
import { FormSection } from '@renderer/components/ui';
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
      <FormSection title={t('scalping.metric.orderFlow')}>
        <Stack gap={1} fontSize="xs">
          <Flex justify="space-between">
            <Text color="fg.muted">CVD</Text>
            <Text fontWeight="medium" fontFamily="mono">{metrics.cvd.toFixed(2)}</Text>
          </Flex>
          <Flex justify="space-between">
            <Text color="fg.muted">{t('scalping.metric.imbalance')}</Text>
            <Text fontWeight="medium" fontFamily="mono">{metrics.imbalanceRatio.toFixed(3)}</Text>
          </Flex>
          <Flex justify="space-between">
            <Text color="fg.muted">{t('scalping.metric.spread')}</Text>
            <Text fontWeight="medium" fontFamily="mono">{metrics.spreadPercent.toFixed(4)}%</Text>
          </Flex>
          <Flex justify="space-between">
            <Text color="fg.muted">{t('scalping.metric.absorption')}</Text>
            <Text fontWeight="medium" fontFamily="mono">{metrics.absorptionScore.toFixed(2)}</Text>
          </Flex>
          <Flex justify="space-between">
            <Text color="fg.muted">{t('scalping.metric.microprice')}</Text>
            <Text fontWeight="medium" fontFamily="mono">{metrics.microprice.toFixed(2)}</Text>
          </Flex>
          <Flex justify="space-between">
            <Text color="fg.muted">{t('scalping.metric.exhaustion')}</Text>
            <Text fontWeight="medium" fontFamily="mono">{metrics.exhaustionScore.toFixed(2)}</Text>
          </Flex>
        </Stack>
      </FormSection>
    </Box>
  );
};

export const OrderFlowMetrics = memo(OrderFlowMetricsComponent);

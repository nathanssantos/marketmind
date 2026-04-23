import { Box } from '@chakra-ui/react';
import { Alert } from '@renderer/components/ui';
import { memo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { StreamHealthStatus } from '@renderer/hooks/useStreamHealth';

const HIDE_DEBOUNCE_MS = 3_000;

interface StreamHealthBannerProps {
  status: StreamHealthStatus;
}

function StreamHealthBannerComponent({ status }: StreamHealthBannerProps) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(status === 'degraded');

  useEffect(() => {
    if (status === 'degraded') {
      setVisible(true);
      return;
    }
    const id = setTimeout(() => setVisible(false), HIDE_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [status]);

  if (!visible) return null;

  return (
    <Box
      position="absolute"
      top="8px"
      left="50%"
      transform="translateX(-50%)"
      zIndex={10}
      pointerEvents="none"
      maxWidth="90%"
    >
      <Alert.Root status="warning" size="sm" variant="solid" borderRadius="md">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title fontSize="xs">{t('chart.streamHealth.degradedTitle')}</Alert.Title>
          <Alert.Description fontSize="xs">{t('chart.streamHealth.degradedDescription')}</Alert.Description>
        </Alert.Content>
      </Alert.Root>
    </Box>
  );
}

export const StreamHealthBanner = memo(StreamHealthBannerComponent);

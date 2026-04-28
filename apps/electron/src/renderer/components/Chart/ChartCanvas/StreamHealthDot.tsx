import { Box } from '@chakra-ui/react';
import { TooltipWrapper } from '@renderer/components/ui';
import { memo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { StreamHealthStatus } from '@renderer/hooks/useStreamHealth';

const HIDE_DEBOUNCE_MS = 3_000;
const DOT_SIZE_PX = 8;

interface StreamHealthDotProps {
  status: StreamHealthStatus;
}

function StreamHealthDotComponent({ status }: StreamHealthDotProps) {
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

  const tooltipLabel = `${t('chart.streamHealth.degradedTitle')}\n${t('chart.streamHealth.degradedDescription')}`;

  return (
    <TooltipWrapper label={tooltipLabel} placement="bottom">
      <Box
        data-testid="stream-health-dot"
        width={`${DOT_SIZE_PX}px`}
        height={`${DOT_SIZE_PX}px`}
        borderRadius="full"
        bg="orange.solid"
        flexShrink={0}
        animation="pulse 2s ease-in-out infinite"
        css={{
          '@keyframes pulse': {
            '0%, 100%': { opacity: 1 },
            '50%': { opacity: 0.5 },
          },
        }}
      />
    </TooltipWrapper>
  );
}

export const StreamHealthDot = memo(StreamHealthDotComponent);

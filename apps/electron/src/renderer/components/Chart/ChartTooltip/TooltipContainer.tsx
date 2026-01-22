import { Box, Stack } from '@chakra-ui/react';
import type { ReactNode } from 'react';
import { TOOLTIP_CONFIG } from './types';

interface TooltipContainerProps {
  left: number;
  top: number;
  children: ReactNode;
}

export const TooltipContainer = ({ left, top, children }: TooltipContainerProps) => (
  <Box
    position="absolute"
    left={`${left}px`}
    top={`${top}px`}
    bg="bg.muted"
    color="fg"
    p={3}
    borderRadius="md"
    boxShadow="lg"
    fontSize="xs"
    zIndex={1000}
    pointerEvents="none"
    opacity={0.95}
    minW={`${TOOLTIP_CONFIG.width}px`}
    borderWidth={1}
    borderColor="border"
  >
    <Stack gap={1.5}>{children}</Stack>
  </Box>
);

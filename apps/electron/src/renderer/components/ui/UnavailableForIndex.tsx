import { Box, Flex, Text } from '@chakra-ui/react';
import { LuChartLine } from 'react-icons/lu';
import { useTranslation } from 'react-i18next';
import { TooltipWrapper } from './Tooltip';

interface UnavailableForIndexProps {
  active: boolean;
  children: React.ReactNode;
  message?: string;
  tooltip?: string;
}

const DIM_OPACITY = 0.35;
const BADGE_RADIUS = 'lg';

export const UnavailableForIndex = ({
  active,
  children,
  message,
  tooltip,
}: UnavailableForIndexProps) => {
  const { t } = useTranslation();
  if (!active) return <>{children}</>;

  const label = message ?? t('customSymbols.unavailableForIndex.label');
  const detail = tooltip ?? t('customSymbols.unavailableForIndex.tooltip');

  return (
    <Box position="relative" w="100%" h="100%">
      <Box opacity={DIM_OPACITY} pointerEvents="none" filter="grayscale(0.5)" w="100%" h="100%">
        {children}
      </Box>
      <Flex
        position="absolute"
        inset={0}
        align="center"
        justify="center"
        zIndex={1}
        pointerEvents="none"
      >
        <TooltipWrapper label={detail}>
          <Flex
            align="center"
            gap={2}
            px={3}
            py={2}
            bg="bg.panel"
            borderWidth="1px"
            borderColor="border.subtle"
            borderRadius={BADGE_RADIUS}
            shadow="md"
            pointerEvents="auto"
          >
            <Box color="fg.muted">
              <LuChartLine />
            </Box>
            <Text fontSize="xs" color="fg.muted" fontWeight="medium">
              {label}
            </Text>
          </Flex>
        </TooltipWrapper>
      </Flex>
    </Box>
  );
};

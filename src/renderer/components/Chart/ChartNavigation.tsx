import { HStack, IconButton } from '@chakra-ui/react';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { LuChevronRight, LuChevronsRight } from 'react-icons/lu';

export interface ChartNavigationProps {
    onResetView: () => void;
    onNextCandle: () => void;
}

export const ChartNavigation = ({ onResetView, onNextCandle }: ChartNavigationProps): ReactElement => {
    const { t } = useTranslation();

    return (
        <HStack
            position="absolute"
            bottom="33px"
            right="72px"
            gap={0.5}
            zIndex={10}
        >
            <IconButton
                aria-label={t('chart.navigation.nextCandle')}
                onClick={onNextCandle}
                size="2xs"
                variant="ghost"
                bg="blackAlpha.600"
                color="whiteAlpha.900"
                _hover={{ bg: 'blackAlpha.800', transform: 'scale(1.05)' }}
                transition="all 0.2s"
                backdropFilter="blur(4px)"
                minW="20px"
                h="20px"
                p={0}
            >
                <LuChevronRight size={12} />
            </IconButton>
            <IconButton
                aria-label={t('chart.navigation.resetView')}
                onClick={onResetView}
                size="2xs"
                variant="ghost"
                bg="blackAlpha.600"
                color="whiteAlpha.900"
                _hover={{ bg: 'blackAlpha.800', transform: 'scale(1.05)' }}
                transition="all 0.2s"
                backdropFilter="blur(4px)"
                minW="20px"
                h="20px"
                p={0}
            >
                <LuChevronsRight size={12} />
            </IconButton>
        </HStack>
    );
};

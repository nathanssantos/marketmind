import { HStack } from '@chakra-ui/react';
import { IconButton } from '@renderer/components/ui';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { LuChevronRight, LuChevronsRight } from 'react-icons/lu';

export interface ChartNavigationProps {
    onResetView: () => void;
    onNextKline: () => void;
    totalPanelHeight?: number;
}

export const ChartNavigation = ({ onResetView, onNextKline, totalPanelHeight = 0 }: ChartNavigationProps): ReactElement => {
    const { t } = useTranslation();

    return (
        <HStack
            position="absolute"
            bottom={`${33 + totalPanelHeight}px`}
            right="72px"
            gap={0.5}
            zIndex={10}
        >
            <IconButton
                aria-label={t('chart.navigation.nextKline')}
                onClick={onNextKline}
                size="2xs"
                variant="outline"
                color="fg.muted"
            >
                <LuChevronRight />
            </IconButton>
            <IconButton
                aria-label={t('chart.navigation.resetView')}
                onClick={onResetView}
                size="2xs"
                variant="outline"
                color="fg.muted"
            >
                <LuChevronsRight />
            </IconButton>
        </HStack>
    );
};

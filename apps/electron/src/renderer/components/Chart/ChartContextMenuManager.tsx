import { Portal } from '@chakra-ui/react';
import { Menu } from '@renderer/components/ui';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { LuTrash2 } from 'react-icons/lu';

interface ChartContextMenuManagerProps {
    children: ReactNode;
    hasDrawings: boolean;
    onClearAllDrawings: () => void;
    onOpenChange?: (open: boolean) => void;
}

export const ChartContextMenuManager = ({
    children,
    hasDrawings,
    onClearAllDrawings,
    onOpenChange,
}: ChartContextMenuManagerProps): ReactNode => {
    const { t } = useTranslation();

    return (
        <Menu.Root onOpenChange={(details) => onOpenChange?.(details.open)}>
            <Menu.ContextTrigger asChild>
                {children}
            </Menu.ContextTrigger>
            <Portal>
                <Menu.Positioner>
                    <Menu.Content>
                        <Menu.Item
                            value="clear-all-drawings"
                            onClick={onClearAllDrawings}
                            disabled={!hasDrawings}
                            padding="8px 12px"
                            gap="8px"
                            cursor="pointer"
                            display="flex"
                            alignItems="center"
                            whiteSpace="nowrap"
                            _hover={{ bg: 'bg.muted' }}
                        >
                            <LuTrash2 />
                            {t('chart.contextMenu.clearAllDrawings', 'Clear All Drawings')}
                        </Menu.Item>
                    </Menu.Content>
                </Menu.Positioner>
            </Portal>
        </Menu.Root>
    );
};

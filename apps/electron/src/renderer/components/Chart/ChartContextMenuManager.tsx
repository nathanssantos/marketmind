import { Portal } from '@chakra-ui/react';
import { Menu } from '@renderer/components/ui';
import type { TradingSetup } from '@marketmind/types';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { LuEye, LuEyeOff, LuTrash2 } from 'react-icons/lu';

interface ChartContextMenuManagerProps {
    children: ReactNode;
    hoveredSetup: TradingSetup | null;
    onDeleteSetup: (setupId: string) => void;
    onDeleteAllSetups: () => void;
    onToggleSetupsVisibility: () => void;
    hasSetups: boolean;
    setupsVisible: boolean;
    onOpenChange?: (open: boolean) => void;
}

export const ChartContextMenuManager = ({
    children,
    hoveredSetup,
    onDeleteSetup,
    onDeleteAllSetups,
    onToggleSetupsVisibility,
    hasSetups,
    setupsVisible,
    onOpenChange,
}: ChartContextMenuManagerProps): ReactNode => {
    const { t } = useTranslation();

    const handleDeleteSingleSetup = (): void => {
        if (!hoveredSetup?.id) return;
        onDeleteSetup(hoveredSetup.id);
    };

    return (
        <Menu.Root onOpenChange={(details) => onOpenChange?.(details.open)}>
            <Menu.ContextTrigger asChild>
                {children}
            </Menu.ContextTrigger>
            <Portal>
                <Menu.Positioner>
                    <Menu.Content>
                        {hoveredSetup && (
                            <Menu.Item
                                value="delete-setup"
                                onClick={handleDeleteSingleSetup}
                                padding="8px 12px"
                                gap="8px"
                                cursor="pointer"
                                display="flex"
                                alignItems="center"
                                whiteSpace="nowrap"
                                _hover={{
                                    bg: 'gray.100',
                                    _dark: {
                                        bg: 'gray.700',
                                    },
                                }}
                            >
                                <LuTrash2 />
                                {t('chart.contextMenu.deleteSetup')}
                            </Menu.Item>
                        )}

                        {!hoveredSetup && (
                            <>
                                <Menu.Item
                                    value="toggle-setups"
                                    onClick={onToggleSetupsVisibility}
                                    disabled={!hasSetups}
                                    padding="8px 12px"
                                    gap="8px"
                                    cursor="pointer"
                                    display="flex"
                                    alignItems="center"
                                    whiteSpace="nowrap"
                                    _hover={{
                                        bg: 'gray.100',
                                        _dark: {
                                            bg: 'gray.700',
                                        },
                                    }}
                                >
                                    {setupsVisible ? <LuEyeOff /> : <LuEye />}
                                    {setupsVisible
                                        ? t('chart.contextMenu.hideSetups')
                                        : t('chart.contextMenu.showSetups')
                                    }
                                </Menu.Item>
                                <Menu.Item
                                    value="delete-all-setups"
                                    onClick={onDeleteAllSetups}
                                    disabled={!hasSetups}
                                    padding="8px 12px"
                                    gap="8px"
                                    cursor="pointer"
                                    display="flex"
                                    alignItems="center"
                                    whiteSpace="nowrap"
                                    _hover={{
                                        bg: 'gray.100',
                                        _dark: {
                                            bg: 'gray.700',
                                        },
                                    }}
                                >
                                    <LuTrash2 />
                                    {t('chart.contextMenu.deleteAllSetups')}
                                </Menu.Item>
                            </>
                        )}
                    </Menu.Content>
                </Menu.Positioner>
            </Portal>
        </Menu.Root>
    );
};

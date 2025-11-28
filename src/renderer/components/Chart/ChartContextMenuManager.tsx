import { Menu, Portal } from '@chakra-ui/react';
import type { AIPattern } from '@shared/types';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { LuEye, LuEyeOff, LuTrash2 } from 'react-icons/lu';

interface ChartContextMenuManagerProps {
    children: ReactNode;
    hoveredPattern: AIPattern | null;
    onDeletePattern: (patternId: number) => void;
    onDeleteDetectedPattern: (patternId: number) => void;
    onDeleteAllPatterns: () => void;
    onTogglePatternsVisibility: () => void;
    hasPatterns: boolean;
    patternsVisible: boolean;
    onOpenChange?: (open: boolean) => void;
}

export const ChartContextMenuManager = ({
    children,
    hoveredPattern,
    onDeletePattern,
    onDeleteDetectedPattern,
    onDeleteAllPatterns,
    onTogglePatternsVisibility,
    hasPatterns,
    patternsVisible,
    onOpenChange,
}: ChartContextMenuManagerProps): ReactNode => {
    const { t } = useTranslation();

    const isDetectedPattern = Boolean(hoveredPattern && 'source' in hoveredPattern && hoveredPattern.source === 'detected');
    const isAIPattern = Boolean(hoveredPattern && (!('source' in hoveredPattern) || hoveredPattern.source !== 'detected'));

    const handleDeleteSinglePattern = (): void => {
        if (hoveredPattern?.id === undefined) return;

        console.log('[ChartContextMenuManager] Deleting pattern:', {
            id: hoveredPattern.id,
            isDetectedPattern,
            isAIPattern,
            pattern: hoveredPattern
        });

        if (isDetectedPattern) {
            onDeleteDetectedPattern(hoveredPattern.id);
        } else if (isAIPattern) {
            onDeletePattern(hoveredPattern.id);
        }
    };

    return (
        <Menu.Root onOpenChange={(details) => onOpenChange?.(details.open)}>
            <Menu.ContextTrigger asChild>
                {children}
            </Menu.ContextTrigger>
            <Portal>
                <Menu.Positioner>
                    <Menu.Content>
                        {(isDetectedPattern || isAIPattern) && (
                            <Menu.Item
                                value="delete-single"
                                onClick={handleDeleteSinglePattern}
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
                                {isDetectedPattern
                                    ? t('chart.contextMenu.deletePattern')
                                    : t('chart.contextMenu.deletePattern')
                                }
                            </Menu.Item>
                        )}

                        {!hoveredPattern && (
                            <>
                                <Menu.Item
                                    value="toggle-patterns"
                                    onClick={onTogglePatternsVisibility}
                                    disabled={!hasPatterns}
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
                                    {patternsVisible ? <LuEyeOff /> : <LuEye />}
                                    {patternsVisible
                                        ? t('chart.contextMenu.hidePatterns')
                                        : t('chart.contextMenu.showPatterns')
                                    }
                                </Menu.Item>
                                <Menu.Item
                                    value="delete-all-patterns"
                                    onClick={onDeleteAllPatterns}
                                    disabled={!hasPatterns}
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
                                    {t('chart.contextMenu.deleteAllPatterns')}
                                </Menu.Item>
                            </>
                        )}
                    </Menu.Content>
                </Menu.Positioner>
            </Portal>
        </Menu.Root>
    );
};

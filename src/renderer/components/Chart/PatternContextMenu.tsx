import { Menu, Portal } from '@chakra-ui/react';
import type { AIPattern } from '@shared/types';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { LuTrash2 } from 'react-icons/lu';

interface PatternContextMenuProps {
    children: ReactNode;
    pattern: AIPattern | null;
    onDeletePattern: (patternId: number) => void;
}

export const PatternContextMenu = ({
    children,
    pattern,
    onDeletePattern,
}: PatternContextMenuProps): ReactNode => {
    const { t } = useTranslation();

    const isDetectedPattern = pattern && 'source' in pattern && pattern.source === 'detected';

    const handleDelete = (): void => {
        if (pattern?.id !== undefined && isDetectedPattern) {
            onDeletePattern(pattern.id);
        }
    };

    if (!isDetectedPattern) {
        return <>{children}</>;
    }

    return (
        <Menu.Root>
            <Menu.ContextTrigger asChild>
                {children}
            </Menu.ContextTrigger>
            <Portal>
                <Menu.Positioner>
                    <Menu.Content>
                        <Menu.Item
                            value="delete-pattern"
                            onClick={handleDelete}
                            disabled={!pattern}
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
                            {t('chart.contextMenu.deletePattern')}
                        </Menu.Item>
                    </Menu.Content>
                </Menu.Positioner>
            </Portal>
        </Menu.Root>
    );
};

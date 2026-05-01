import { Flex, Text } from '@chakra-ui/react';
import type { ReactNode } from 'react';

interface SidebarHeaderProps {
    title: string;
    /**
     * Optional inline action(s) on the right of the title — typically the
     * close X (`<IconButton><LuX /></IconButton>`). Use `<SidebarTabsHeader>`
     * when the sidebar uses tabs as its header instead of a static title.
     */
    actions?: ReactNode;
}

/**
 * Single-content sidebar header. Title + optional inline actions, with a
 * `borderBottom` divider matching the dialog header convention. Use this
 * for sidebars that show one piece of content (no tabs). For tabbed
 * sidebars, use `<SidebarTabsHeader>` which composes Tabs.List with the
 * close affordance.
 */
export const SidebarHeader = ({ title, actions }: SidebarHeaderProps) => (
    <Flex
        align="center"
        justify="space-between"
        px={3}
        py={2}
        borderBottom="1px solid"
        borderColor="border"
    >
        <Text fontSize="xs" fontWeight="semibold">
            {title}
        </Text>
        {actions && (
            <Flex align="center" gap={1}>
                {actions}
            </Flex>
        )}
    </Flex>
);

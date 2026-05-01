import { Flex } from '@chakra-ui/react';
import type { ReactNode } from 'react';

interface SidebarTabsHeaderProps {
    /**
     * The `<Tabs.List>` element. Lives in the header strip; takes
     * `flex=1` so the close button (if present) sits flush to the right.
     */
    children: ReactNode;
    /**
     * Optional close X (or other right-aligned action). Always renders
     * after the tabs — the close affordance lives top-right per UX
     * convention.
     */
    closeAction?: ReactNode;
}

/**
 * Sidebar header for tabbed sidebars. Composes Tabs.List + an optional
 * right-aligned close button. The 4 sidebars (TradingSidebar /
 * AutoTradingSidebar / OrderFlowSidebar / future tabbed sidebars) all
 * use this so the close X position, vertical alignment, and gap are
 * uniform.
 */
export const SidebarTabsHeader = ({ children, closeAction }: SidebarTabsHeaderProps) => (
    <Flex>
        {children}
        {closeAction && (
            <Flex align="center" mr={1} mt={0.5}>
                {closeAction}
            </Flex>
        )}
    </Flex>
);

import { Flex } from '@chakra-ui/react';
import type { ReactNode } from 'react';

interface SidebarContainerProps {
    width: number;
    isOpen?: boolean;
    position?: 'left' | 'right';
    children: ReactNode;
}

export const SidebarContainer = ({ width, isOpen = true, position = 'right', children }: SidebarContainerProps) => {
    if (!isOpen) return null;

    return (
        <Flex
            direction="column"
            width={`${width}px`}
            minWidth="300px"
            height="100%"
            bg="bg.surface"
            borderLeft={position === 'right' ? '1px solid' : undefined}
            borderRight={position === 'left' ? '1px solid' : undefined}
            borderColor="border"
        >
            {children}
        </Flex>
    );
};

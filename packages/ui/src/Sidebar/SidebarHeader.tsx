import { Flex, Text } from '@chakra-ui/react';
import type { ReactNode } from 'react';

interface SidebarHeaderProps {
    title: string;
    actions?: ReactNode;
}

export const SidebarHeader = ({ title, actions }: SidebarHeaderProps) => (
    <Flex
        align="center"
        justify="space-between"
        px={4}
        py={2}
        borderBottom="1px solid"
        borderColor="border"
    >
        <Text fontSize="lg" fontWeight="semibold">
            {title}
        </Text>
        {actions && (
            <Flex align="center" gap={1}>
                {actions}
            </Flex>
        )}
    </Flex>
);

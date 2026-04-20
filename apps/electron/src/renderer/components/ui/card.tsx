import { Box } from '@chakra-ui/react';
import type { ReactNode } from 'react';

interface CardRootProps {
    children: ReactNode;
    [key: string]: unknown;
}

interface CardHeaderProps {
    children: ReactNode;
    [key: string]: unknown;
}

interface CardBodyProps {
    children: ReactNode;
    [key: string]: unknown;
}

const CardRoot = ({ children, ...props }: CardRootProps) => (
    <Box
        borderWidth="1px"
        borderRadius="lg"
        overflow="hidden"
        bg="white"
        _dark={{ bg: 'gray.800', borderColor: 'gray.700' }}
        {...(props as Record<string, unknown>)}
    >
        {children}
    </Box>
);

const CardHeader = ({ children, ...props }: CardHeaderProps) => (
    <Box p={4} borderBottomWidth="1px" _dark={{ borderColor: 'gray.700' }} {...(props as Record<string, unknown>)}>
        {children}
    </Box>
);

const CardBody = ({ children, ...props }: CardBodyProps) => (
    <Box p={4} {...(props as Record<string, unknown>)}>
        {children}
    </Box>
);

export const Card = {
    Root: CardRoot,
    Header: CardHeader,
    Body: CardBody,
};

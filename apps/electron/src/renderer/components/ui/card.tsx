import { Box, type BoxProps } from '@chakra-ui/react';
import type { ReactNode } from 'react';

interface CardRootProps extends BoxProps {
    children: ReactNode;
}

interface CardHeaderProps extends BoxProps {
    children: ReactNode;
}

interface CardBodyProps extends BoxProps {
    children: ReactNode;
}

const CardRoot = ({ children, ...props }: CardRootProps) => (
    // @ts-expect-error Chakra v3 accentColor BoxProps spread type conflict
    <Box
        borderWidth="1px"
        borderRadius="lg"
        overflow="hidden"
        bg="white"
        _dark={{ bg: 'gray.800', borderColor: 'gray.700' }}
        {...props}
    >
        {children}
    </Box>
);

const CardHeader = ({ children, ...props }: CardHeaderProps) => (
    // @ts-expect-error Chakra v3 accentColor BoxProps spread type conflict
    <Box p={4} borderBottomWidth="1px" _dark={{ borderColor: 'gray.700' }} {...props}>
        {children}
    </Box>
);

const CardBody = ({ children, ...props }: CardBodyProps) => (
    // @ts-expect-error Chakra v3 accentColor BoxProps spread type conflict
    <Box p={4} {...props}>
        {children}
    </Box>
);

export const Card = {
    Root: CardRoot,
    Header: CardHeader,
    Body: CardBody,
};

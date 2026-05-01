import { Box, type BoxProps, HStack, Text } from '@chakra-ui/react';
import type { ReactNode } from 'react';

interface StatProps extends BoxProps {
    label: string;
    value: ReactNode;
    helpText?: ReactNode;
    valueColor?: string;
}

export const Stat = ({ label, value, helpText, valueColor, ...rest }: StatProps) => {
    return (
        // @ts-expect-error Chakra v3 accentColor BoxProps spread type conflict
        <Box {...rest}>
            <Text fontSize="sm" color="fg.muted" mb={1}>
                {label}
            </Text>
            <Text fontSize="2xl" fontWeight="bold" color={valueColor}>
                {value}
            </Text>
            {helpText && (
                <Text fontSize="sm" color="fg.muted" mt={1}>
                    {helpText}
                </Text>
            )}
        </Box>
    );
};

interface StatRowProps {
    label: string;
    value: string | number;
}

export const StatRow = ({ label, value }: StatRowProps) => {
    return (
        <HStack>
            <Text fontSize="sm" color="fg.muted">
                {label}:
            </Text>
            <Text fontSize="sm" fontWeight="medium">
                {value}
            </Text>
        </HStack>
    );
};

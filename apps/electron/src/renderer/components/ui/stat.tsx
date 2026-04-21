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
            <Text fontSize="sm" color="gray.500" mb={1}>
                {label}
            </Text>
            <Text fontSize="2xl" fontWeight="bold" color={valueColor}>
                {value}
            </Text>
            {helpText && (
                <Text fontSize="sm" color="gray.400" mt={1}>
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
            <Text fontSize="sm" color="gray.500">
                {label}:
            </Text>
            <Text fontSize="sm" fontWeight="medium">
                {value}
            </Text>
        </HStack>
    );
};

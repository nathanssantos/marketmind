import { Box, HStack, Text } from '@chakra-ui/react';
import type { ReactNode } from 'react';

interface StatProps {
    label: string;
    value: ReactNode;
    helpText?: ReactNode;
    valueColor?: string;
    [key: string]: unknown;
}

export const Stat = ({ label, value, helpText, valueColor, ...rest }: StatProps) => {
    return (
        <Box {...(rest as any)}>
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

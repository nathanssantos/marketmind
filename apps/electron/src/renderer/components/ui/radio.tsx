import { RadioGroup as ChakraRadioGroup } from '@chakra-ui/react';
import type { ReactElement, ReactNode } from 'react';

export interface RadioGroupProps {
    value: string;
    onValueChange: (details: { value: string }) => void;
    children: ReactNode;
    disabled?: boolean;
}

export const RadioGroup = (props: RadioGroupProps): ReactElement => {
    const { value, onValueChange, children, disabled = false } = props;

    return (
        <ChakraRadioGroup.Root
            value={value}
            onValueChange={(details) => {
                if (details.value !== null) onValueChange({ value: details.value });
            }}
            disabled={disabled}
        >
            {children}
        </ChakraRadioGroup.Root>
    );
};

export interface RadioProps {
    value: string;
    children?: ReactNode;
    disabled?: boolean;
}

export const Radio = (props: RadioProps): ReactElement => {
    const { value, children, disabled = false } = props;

    return (
        <ChakraRadioGroup.Item value={value} disabled={disabled} cursor="pointer" display="flex" alignItems="center" gap={2}>
            <ChakraRadioGroup.ItemHiddenInput />
            <ChakraRadioGroup.ItemControl />
            {children && <ChakraRadioGroup.ItemText>{children}</ChakraRadioGroup.ItemText>}
        </ChakraRadioGroup.Item>
    );
};

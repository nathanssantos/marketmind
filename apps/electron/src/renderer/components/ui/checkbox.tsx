import { Checkbox as ChakraCheckbox } from '@chakra-ui/react';
import type { ReactElement, ReactNode } from 'react';

export interface CheckboxProps {
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
    children?: ReactNode;
    disabled?: boolean;
}

export const Checkbox = (props: CheckboxProps): ReactElement => {
    const { checked, onCheckedChange, children, disabled = false } = props;

    return (
        <ChakraCheckbox.Root
            checked={checked}
            onCheckedChange={(details) => {
                const isChecked = typeof details === 'boolean' ? details : details.checked === true;
                onCheckedChange(isChecked);
            }}
            disabled={disabled}
        >
            <ChakraCheckbox.HiddenInput />
            <ChakraCheckbox.Control>
                <ChakraCheckbox.Indicator />
            </ChakraCheckbox.Control>
            {children && <ChakraCheckbox.Label>{children}</ChakraCheckbox.Label>}
        </ChakraCheckbox.Root>
    );
};

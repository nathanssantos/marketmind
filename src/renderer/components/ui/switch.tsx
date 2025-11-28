import { Switch as ChakraSwitch } from '@chakra-ui/react';
import type { ReactElement } from 'react';

export interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  children?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
}

export const Switch = (props: SwitchProps): ReactElement => {
  const { checked, onCheckedChange, children, size = 'md', disabled = false } = props;

  return (
    <ChakraSwitch.Root
      checked={checked}
      onCheckedChange={(details) => {
        const isChecked = typeof details === 'boolean' ? details : details.checked;
        onCheckedChange(isChecked);
      }}
      size={size}
      disabled={disabled}
    >
      <ChakraSwitch.HiddenInput />
      {children && <ChakraSwitch.Label>{children}</ChakraSwitch.Label>}
      <ChakraSwitch.Control>
        <ChakraSwitch.Thumb />
      </ChakraSwitch.Control>
    </ChakraSwitch.Root>
  );
};

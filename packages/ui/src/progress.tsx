import { Progress as ChakraProgress } from '@chakra-ui/react';
import type { ReactNode } from 'react';

interface ProgressRootProps {
  /** Pass `null` for an indeterminate (animated) bar. */
  value: number | null;
  max?: number;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  colorPalette?: string;
  children: ReactNode;
}

interface ProgressBarProps {
}

export const ProgressRoot = ({ value, max, size = 'md', colorPalette = 'blue', children }: ProgressRootProps) => {
  return (
    <ChakraProgress.Root value={value} max={max} size={size} colorPalette={colorPalette}>
      {children}
    </ChakraProgress.Root>
  );
};

export const ProgressBar = (_props: ProgressBarProps) => {
  return <ChakraProgress.Track>
    <ChakraProgress.Range />
  </ChakraProgress.Track>;
};

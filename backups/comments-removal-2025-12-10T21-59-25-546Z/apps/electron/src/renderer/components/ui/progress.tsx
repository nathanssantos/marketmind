import { Progress as ChakraProgress } from '@chakra-ui/react';
import type { ReactNode } from 'react';

interface ProgressRootProps {
  value: number;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  colorPalette?: string;
  children: ReactNode;
}

interface ProgressBarProps {
  // Props vazias pois ProgressBar é apenas visual
}

export const ProgressRoot = ({ value, size = 'md', colorPalette = 'blue', children }: ProgressRootProps) => {
  return (
    <ChakraProgress.Root value={value} size={size} colorPalette={colorPalette}>
      {children}
    </ChakraProgress.Root>
  );
};

export const ProgressBar = (_props: ProgressBarProps) => {
  return <ChakraProgress.Track>
    <ChakraProgress.Range />
  </ChakraProgress.Track>;
};

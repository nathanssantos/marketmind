import type { SkeletonProps as ChakraSkeletonProps } from '@chakra-ui/react';
import { Skeleton as ChakraSkeleton } from '@chakra-ui/react';
import { forwardRef } from 'react';

export interface SkeletonProps extends ChakraSkeletonProps {}

export const Skeleton = forwardRef<HTMLDivElement, SkeletonProps>((props, ref) => {
  // @ts-expect-error
  return <ChakraSkeleton ref={ref} {...props} />;
});

Skeleton.displayName = 'Skeleton';

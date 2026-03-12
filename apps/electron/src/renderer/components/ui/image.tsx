import type { ImageProps as ChakraImageProps } from '@chakra-ui/react';
import { Image as ChakraImage } from '@chakra-ui/react';
import { forwardRef } from 'react';

export interface ImageProps extends ChakraImageProps {}

export const Image = forwardRef<HTMLImageElement, ImageProps>((props, ref) => {
  // @ts-expect-error
  return <ChakraImage ref={ref} {...props} />;
});

Image.displayName = 'Image';

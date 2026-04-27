import { Box, Text } from '@chakra-ui/react';
import type { ReactNode } from 'react';

interface TypographyProps {
  children?: ReactNode;
  mt?: number | string;
  mb?: number | string;
  color?: string;
  textAlign?: 'left' | 'center' | 'right';
  truncate?: boolean;
  className?: string;
}

export const PageTitle = ({ children, mt, mb, color, textAlign, truncate, className }: TypographyProps) => (
  <Box fontSize="lg" fontWeight="bold" lineHeight="1.2" mt={mt} mb={mb} color={color} textAlign={textAlign} truncate={truncate} className={className}>
    {children}
  </Box>
);

export const SectionTitle = ({ children, mt, mb, color, textAlign, truncate, className }: TypographyProps) => (
  <Box fontSize="sm" fontWeight="semibold" lineHeight="1.2" mt={mt} mb={mb} color={color} textAlign={textAlign} truncate={truncate} className={className}>
    {children}
  </Box>
);

export const SubsectionTitle = ({ children, mt, mb, color = 'fg.muted', textAlign, truncate, className }: TypographyProps) => (
  <Box
    fontSize="2xs"
    fontWeight="bold"
    lineHeight="1.2"
    textTransform="uppercase"
    letterSpacing="wider"
    color={color}
    mt={mt}
    mb={mb}
    textAlign={textAlign}
    truncate={truncate}
    className={className}
  >
    {children}
  </Box>
);

export const SectionDescription = ({ children, mt, mb, color = 'fg.muted', textAlign, truncate, className }: TypographyProps) => (
  <Text fontSize="xs" color={color} lineHeight="1.45" mt={mt} mb={mb} textAlign={textAlign} truncate={truncate} className={className}>
    {children}
  </Text>
);

export const FieldHint = ({ children, mt, mb, color = 'fg.muted', textAlign, truncate, className }: TypographyProps) => (
  <Text fontSize="2xs" color={color} lineHeight="1.4" mt={mt} mb={mb} textAlign={textAlign} truncate={truncate} className={className}>
    {children}
  </Text>
);

export const MetaText = ({ children, mt, mb, color = 'fg.muted', textAlign, truncate, className }: TypographyProps) => (
  <Text fontSize="2xs" color={color} mt={mt} mb={mb} textAlign={textAlign} truncate={truncate} className={className}>
    {children}
  </Text>
);

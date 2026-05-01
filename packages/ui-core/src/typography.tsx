import { Box, Text } from '@chakra-ui/react';
import type { ReactNode } from 'react';
import { MM } from '@marketmind/tokens';

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
  <Box
    fontSize={MM.font.pageTitle.size}
    fontWeight={MM.font.pageTitle.weight}
    lineHeight={MM.lineHeight.title}
    mt={mt}
    mb={mb}
    color={color}
    textAlign={textAlign}
    truncate={truncate}
    className={className}
  >
    {children}
  </Box>
);

export const SectionTitle = ({ children, mt, mb, color, textAlign, truncate, className }: TypographyProps) => (
  <Box
    fontSize={MM.font.sectionTitle.size}
    fontWeight={MM.font.sectionTitle.weight}
    lineHeight={MM.lineHeight.title}
    mt={mt}
    mb={mb}
    color={color}
    textAlign={textAlign}
    truncate={truncate}
    className={className}
  >
    {children}
  </Box>
);

export const SubsectionTitle = ({ children, mt, mb, color = 'fg.muted', textAlign, truncate, className }: TypographyProps) => (
  <Box
    fontSize={MM.font.subsection.size}
    fontWeight={MM.font.subsection.weight}
    lineHeight={MM.lineHeight.title}
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
  <Text
    fontSize={MM.font.body.size}
    color={color}
    lineHeight={MM.lineHeight.body}
    mt={mt}
    mb={mb}
    textAlign={textAlign}
    truncate={truncate}
    className={className}
  >
    {children}
  </Text>
);

export const FieldHint = ({ children, mt, mb, color = 'fg.muted', textAlign, truncate, className }: TypographyProps) => (
  <Text
    fontSize={MM.font.hint.size}
    color={color}
    lineHeight={MM.lineHeight.hint}
    mt={mt}
    mb={mb}
    textAlign={textAlign}
    truncate={truncate}
    className={className}
  >
    {children}
  </Text>
);

export const MetaText = ({ children, mt, mb, color = 'fg.muted', textAlign, truncate, className }: TypographyProps) => (
  <Text
    fontSize={MM.font.hint.size}
    color={color}
    mt={mt}
    mb={mb}
    textAlign={textAlign}
    truncate={truncate}
    className={className}
  >
    {children}
  </Text>
);

import { Box } from '@chakra-ui/react';
import { PATTERN_COLORS } from '@shared/constants';
import type { AIPattern } from '@shared/types';
import type { Pattern } from '@shared/types/pattern';
import { useMemo } from 'react';

interface PatternReferenceProps {
  patternNumber: number;
  pattern: AIPattern | Pattern | undefined;
  onHover: (patternNumber: number | null) => void;
}

export const PatternReference = ({ patternNumber, pattern, onHover }: PatternReferenceProps) => {
  const patternColor = useMemo(
    () => (pattern ? PATTERN_COLORS[pattern.type] : '#8b5cf6'),
    [pattern]
  );

  const { backgroundColor, backgroundColorDark } = useMemo(() => {
    const rgbColor = hexToRgb(patternColor ?? '#8b5cf6');
    return {
      backgroundColor: rgbColor
        ? `rgba(${rgbColor.r}, ${rgbColor.g}, ${rgbColor.b}, 0.1)`
        : 'rgba(139, 92, 246, 0.1)',
      backgroundColorDark: rgbColor
        ? `rgba(${rgbColor.r}, ${rgbColor.g}, ${rgbColor.b}, 0.2)`
        : 'rgba(139, 92, 246, 0.2)',
    };
  }, [patternColor]);

  return (
    <Box
      as="span"
      display="inline-flex"
      alignItems="center"
      color={patternColor}
      fontWeight="semibold"
      cursor="pointer"
      px={1.5}
      py={0.5}
      mx={0.5}
      borderRadius="md"
      border="1.5px solid"
      borderColor={patternColor}
      bg={backgroundColor}
      _dark={{
        bg: backgroundColorDark,
      }}
      _hover={{
        transform: 'scale(1.05)',
        boxShadow: `0 0 0 2px ${patternColor}40`,
      }}
      transition="all 0.2s"
      onMouseEnter={() => onHover(patternNumber)}
      onMouseLeave={() => onHover(null)}
      title={pattern ? `${pattern.type} - ${pattern.label || `Pattern #${patternNumber}`}` : `Pattern #${patternNumber}`}
    >
      #{patternNumber}
    </Box>
  );
};

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1]!, 16),
    g: parseInt(result[2]!, 16),
    b: parseInt(result[3]!, 16)
  } : null;
}

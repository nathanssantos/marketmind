import { Box } from '@chakra-ui/react';
import { STUDY_COLORS } from '@shared/constants';
import type { AIStudy } from '@shared/types';
import { useMemo } from 'react';

interface StudyReferenceProps {
  studyNumber: number;
  study?: AIStudy;
  onHover: (studyNumber: number | null) => void;
}

export const StudyReference = ({ studyNumber, study, onHover }: StudyReferenceProps) => {
  const studyColor = useMemo(
    () => (study ? STUDY_COLORS[study.type] : '#8b5cf6'),
    [study]
  );

  const { backgroundColor, backgroundColorDark } = useMemo(() => {
    const rgbColor = hexToRgb(studyColor);
    return {
      backgroundColor: rgbColor 
        ? `rgba(${rgbColor.r}, ${rgbColor.g}, ${rgbColor.b}, 0.1)` 
        : 'rgba(139, 92, 246, 0.1)',
      backgroundColorDark: rgbColor 
        ? `rgba(${rgbColor.r}, ${rgbColor.g}, ${rgbColor.b}, 0.2)` 
        : 'rgba(139, 92, 246, 0.2)',
    };
  }, [studyColor]);

  return (
    <Box
      as="span"
      display="inline-flex"
      alignItems="center"
      color={studyColor}
      fontWeight="semibold"
      cursor="pointer"
      px={1.5}
      py={0.5}
      mx={0.5}
      borderRadius="md"
      border="1.5px solid"
      borderColor={studyColor}
      bg={backgroundColor}
      _dark={{
        bg: backgroundColorDark,
      }}
      _hover={{
        transform: 'scale(1.05)',
        boxShadow: `0 0 0 2px ${studyColor}40`,
      }}
      transition="all 0.2s"
      onMouseEnter={() => onHover(studyNumber)}
      onMouseLeave={() => onHover(null)}
      title={study ? `${study.type} - ${study.label || `Study #${studyNumber}`}` : `Study #${studyNumber}`}
    >
      #{studyNumber}
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

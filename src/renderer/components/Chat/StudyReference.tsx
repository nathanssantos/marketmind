import { Box } from '@chakra-ui/react';

interface StudyReferenceProps {
  studyNumber: number;
  onHover: (studyNumber: number | null) => void;
}

export const StudyReference = ({ studyNumber, onHover }: StudyReferenceProps) => {
  return (
    <Box
      as="span"
      display="inline"
      color="purple.500"
      fontWeight="semibold"
      cursor="pointer"
      textDecoration="underline"
      textDecorationStyle="dotted"
      _hover={{
        color: 'purple.600',
        bg: 'purple.50',
        _dark: {
          color: 'purple.300',
          bg: 'purple.900',
        },
      }}
      px={0.5}
      borderRadius="sm"
      onMouseEnter={() => onHover(studyNumber)}
      onMouseLeave={() => onHover(null)}
      title={`Hover to highlight Study #${studyNumber} on the chart`}
    >
      Study #{studyNumber}
    </Box>
  );
};

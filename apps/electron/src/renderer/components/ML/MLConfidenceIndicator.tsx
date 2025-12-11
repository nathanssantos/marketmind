import { Badge, Box, HStack, Text, VStack } from '@chakra-ui/react';
import { memo } from 'react';

interface MLConfidenceIndicatorProps {
  originalConfidence: number;
  mlConfidence?: number;
  blendedConfidence?: number;
  probability?: number;
  label?: number;
  showDetails?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const getConfidenceColor = (confidence: number): string => {
  if (confidence >= 80) return 'green';
  if (confidence >= 60) return 'yellow';
  if (confidence >= 40) return 'orange';
  return 'red';
};

const getProbabilityColor = (probability: number): string => {
  if (probability >= 0.7) return 'green';
  if (probability >= 0.5) return 'yellow';
  if (probability >= 0.3) return 'orange';
  return 'red';
};

const MLConfidenceIndicatorComponent = ({
  originalConfidence,
  mlConfidence,
  blendedConfidence,
  probability,
  label,
  showDetails = false,
  size = 'md',
}: MLConfidenceIndicatorProps) => {
  const hasML = mlConfidence !== undefined;
  const displayConfidence = blendedConfidence ?? originalConfidence;
  const confidenceColor = getConfidenceColor(displayConfidence);

  const fontSize = size === 'sm' ? 'xs' : size === 'md' ? 'sm' : 'md';
  const badgeSize = size === 'sm' ? 'xs' : size === 'md' ? 'sm' : 'md';

  if (!showDetails) {
    return (
      <HStack gap={1}>
        <Badge colorPalette={confidenceColor} size={badgeSize}>
          {displayConfidence}%
        </Badge>
        {hasML && (
          <Badge colorPalette="purple" size={badgeSize} variant="outline">
            ML
          </Badge>
        )}
      </HStack>
    );
  }

  return (
    <Box p={2} bg="bg.muted" borderRadius="md" borderWidth="1px" borderColor="border">
      <VStack align="stretch" gap={2}>
        <HStack justify="space-between">
          <Text fontSize={fontSize} fontWeight="medium">
            Confidence
          </Text>
          <Badge colorPalette={confidenceColor} size={badgeSize}>
            {displayConfidence}%
          </Badge>
        </HStack>

        <Box bg="gray.200" borderRadius="full" height="6px" overflow="hidden">
          <Box
            bg={`${confidenceColor}.500`}
            height="100%"
            width={`${displayConfidence}%`}
            transition="width 0.3s ease"
          />
        </Box>

        {hasML && (
          <>
            <HStack justify="space-between" fontSize={fontSize}>
              <Text color="fg.muted">Original</Text>
              <Text>{originalConfidence}%</Text>
            </HStack>

            <HStack justify="space-between" fontSize={fontSize}>
              <Text color="fg.muted">ML Confidence</Text>
              <Text>{mlConfidence}%</Text>
            </HStack>

            {probability !== undefined && (
              <HStack justify="space-between" fontSize={fontSize}>
                <Text color="fg.muted">Win Probability</Text>
                <Badge colorPalette={getProbabilityColor(probability)}>
                  {(probability * 100).toFixed(1)}%
                </Badge>
              </HStack>
            )}

            {label !== undefined && (
              <HStack justify="space-between" fontSize={fontSize}>
                <Text color="fg.muted">Prediction</Text>
                <Badge colorPalette={label === 1 ? 'green' : 'red'}>
                  {label === 1 ? 'Win' : 'Loss'}
                </Badge>
              </HStack>
            )}
          </>
        )}
      </VStack>
    </Box>
  );
};

export const MLConfidenceIndicator = memo(MLConfidenceIndicatorComponent);

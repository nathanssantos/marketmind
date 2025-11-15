import { Box, Spinner, Stack, Text } from '@chakra-ui/react';

interface LoadingSpinnerProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const LoadingSpinner = ({ message = 'Loading...', size = 'lg' }: LoadingSpinnerProps) => (
  <Box
    position="absolute"
    top="50%"
    left="50%"
    transform="translate(-50%, -50%)"
    textAlign="center"
  >
    <Stack gap={4} alignItems="center">
      <Spinner 
        size={size} 
        color="blue.500"
        borderWidth="4px"
      />
      <Text 
        fontSize="lg" 
        color="fg.muted"
        fontWeight="medium"
      >
        {message}
      </Text>
    </Stack>
  </Box>
);

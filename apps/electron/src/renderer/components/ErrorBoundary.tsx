import { Box, Button, Heading, Text, VStack } from '@chakra-ui/react';
import type { ReactNode } from 'react';
import { ErrorBoundary as ReactErrorBoundary } from 'react-error-boundary';
import type { FallbackProps } from 'react-error-boundary';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

const ErrorFallback = ({ error, resetErrorBoundary }: FallbackProps) => (
  <Box
    display="flex"
    alignItems="center"
    justifyContent="center"
    minH="100vh"
    bg="gray.900"
    p={8}
  >
    <VStack gap={6} maxW="600px" textAlign="center">
      <Heading size="xl" color="red.400">
        Something went wrong
      </Heading>
      <Text color="gray.300">
        An unexpected error occurred. This might be due to a temporary connection issue.
      </Text>
      {error && (
        <Box
          p={4}
          bg="gray.800"
          borderRadius="md"
          w="100%"
          maxH="200px"
          overflow="auto"
        >
          <Text color="red.300" fontSize="sm" fontFamily="mono">
            {error.message}
          </Text>
        </Box>
      )}
      <Box display="flex" gap={4}>
        <Button colorScheme="blue" onClick={() => window.location.reload()}>
          Reload App
        </Button>
        <Button variant="outline" onClick={resetErrorBoundary}>
          Try Again
        </Button>
      </Box>
    </VStack>
  </Box>
);

const handleError = (error: Error, info: { componentStack?: string | null }) => {
  console.error('[ErrorBoundary] Caught error:', error, info);
};

export const ErrorBoundary = ({ children, fallback }: Props) => (
  <ReactErrorBoundary
    FallbackComponent={fallback ? () => <>{fallback}</> : ErrorFallback}
    onError={handleError}
  >
    {children}
  </ReactErrorBoundary>
);

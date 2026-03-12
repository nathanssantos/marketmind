import { Box, Heading, Text, VStack } from '@chakra-ui/react';
import { Button } from './ui/button';
import type { ReactNode } from 'react';
import { useCallback, useState } from 'react';
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
          {error.stack && (
            <Text color="gray.500" fontSize="xs" fontFamily="mono" mt={2}>
              {error.stack.split('\n').slice(0, 5).join('\n')}
            </Text>
          )}
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
  console.error('[ErrorBoundary] Caught error:', error);
  console.error('[ErrorBoundary] Component stack:', info.componentStack);
  try {
    const errorLog = {
      message: error.message,
      stack: error.stack,
      componentStack: info.componentStack,
      timestamp: new Date().toISOString(),
      url: window.location.href,
    };
    console.error('[ErrorBoundary] Error log:', errorLog);
  } catch (e) {
    console.error('[ErrorBoundary] Failed to save error log:', e);
  }
};

const handleReset = () => {
  console.log('[ErrorBoundary] Resetting error boundary...');
  try {
    sessionStorage.removeItem('marketmind:errorState');
  } catch (e) {
    console.error('[ErrorBoundary] Failed to clear error state:', e);
  }
};

export const ErrorBoundary = ({ children, fallback }: Props) => {
  const [resetKey, setResetKey] = useState(0);

  const onReset = useCallback(() => {
    handleReset();
    setResetKey(prev => prev + 1);
  }, []);

  return (
    <ReactErrorBoundary
      key={resetKey}
      FallbackComponent={fallback ? () => <>{fallback}</> : ErrorFallback}
      onError={handleError}
      onReset={onReset}
    >
      {children}
    </ReactErrorBoundary>
  );
};

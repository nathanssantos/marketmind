import type { ReactElement } from 'react';
import { ChakraProvider } from '@chakra-ui/react';
import { Box, Text } from '@chakra-ui/react';
import { system } from './theme';

function App(): ReactElement {
  return (
    <ChakraProvider value={system}>
      <Box
        minH="100vh"
        bg="gray.50"
        _dark={{ bg: 'gray.900' }}
        display="flex"
        alignItems="center"
        justifyContent="center"
      >
        <Box textAlign="center">
          <Text fontSize="4xl" fontWeight="bold" mb={4}>
            📊 MarketMind
          </Text>
          <Text fontSize="xl" color="gray.600" _dark={{ color: 'gray.400' }}>
            AI-powered consultant for technical analysis
          </Text>
        </Box>
      </Box>
    </ChakraProvider>
  );
}

export default App;

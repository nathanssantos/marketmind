import {
    Box,
    HStack,
    Input,
    Spinner,
    Text,
    VStack,
} from '@chakra-ui/react';
import { useEffect, useRef, useState } from 'react';
import { useSymbolSearch } from '../hooks/useSymbolSearch';
import type { MarketDataService } from '../services/market/MarketDataService';

interface SymbolSelectorProps {
  marketService: MarketDataService;
  value: string;
  onChange: (symbol: string) => void;
}

const POPULAR_SYMBOLS = [
  { symbol: 'BTCUSDT', displayName: 'Bitcoin / USDT', baseAsset: 'BTC', quoteAsset: 'USDT' },
  { symbol: 'ETHUSDT', displayName: 'Ethereum / USDT', baseAsset: 'ETH', quoteAsset: 'USDT' },
  { symbol: 'BNBUSDT', displayName: 'BNB / USDT', baseAsset: 'BNB', quoteAsset: 'USDT' },
  { symbol: 'SOLUSDT', displayName: 'Solana / USDT', baseAsset: 'SOL', quoteAsset: 'USDT' },
  { symbol: 'ADAUSDT', displayName: 'Cardano / USDT', baseAsset: 'ADA', quoteAsset: 'USDT' },
  { symbol: 'XRPUSDT', displayName: 'XRP / USDT', baseAsset: 'XRP', quoteAsset: 'USDT' },
  { symbol: 'DOGEUSDT', displayName: 'Dogecoin / USDT', baseAsset: 'DOGE', quoteAsset: 'USDT' },
  { symbol: 'DOTUSDT', displayName: 'Polkadot / USDT', baseAsset: 'DOT', quoteAsset: 'USDT' },
];

export function SymbolSelector({ marketService, value, onChange }: SymbolSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const { symbols, loading } = useSymbolSearch(marketService, {
    minQueryLength: 2,
    debounceMs: 300,
  });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const displaySymbols = searchQuery.length >= 2 ? symbols : POPULAR_SYMBOLS;
  const selectedSymbol = POPULAR_SYMBOLS.find(s => s.symbol === value);

  const handleSelect = (symbol: string) => {
    onChange(symbol);
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <Box position="relative" minW="280px" ref={containerRef}>
      <Box
        as="button"
        w="100%"
        px={4}
        py={2.5}
        bg="gray.800"
        border="1px solid"
        borderColor="gray.700"
        borderRadius="md"
        textAlign="left"
        cursor="pointer"
        _hover={{ borderColor: 'gray.600', bg: 'gray.750' }}
        onClick={() => setIsOpen(!isOpen)}
      >
        <HStack justify="space-between">
          <VStack align="start" gap={0}>
            <Text fontSize="xs" color="gray.500">
              Binance
            </Text>
            <Text fontSize="sm" fontWeight="medium" color="white">
              {selectedSymbol?.displayName || value}
            </Text>
          </VStack>
          <Text fontSize="xs" color="gray.500">▼</Text>
        </HStack>
      </Box>

      {isOpen && (
        <Box
          position="absolute"
          top="100%"
          left={0}
          right={0}
          mt={2}
          bg="gray.800"
          border="1px solid"
          borderColor="gray.700"
          borderRadius="md"
          shadow="lg"
          zIndex={1000}
          maxH="400px"
          overflowY="auto"
        >
          <Box p={3} borderBottomWidth="1px" borderColor="gray.700">
            <Input
              placeholder="Search symbols... (e.g., BTC, ETH)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              size="sm"
              bg="gray.900"
              borderColor="gray.600"
              _focus={{ borderColor: 'blue.500' }}
              autoFocus
            />
          </Box>

          {loading && (
            <Box p={4} textAlign="center">
              <Spinner size="sm" color="blue.500" />
            </Box>
          )}

          {!loading && displaySymbols.length === 0 && searchQuery.length >= 2 && (
            <Box p={4} textAlign="center">
              <Text color="gray.500" fontSize="sm">
                No symbols found
              </Text>
            </Box>
          )}

          {!loading && displaySymbols.length > 0 && (
            <>
              {searchQuery.length < 2 && (
                <Box px={3} py={2} bg="gray.750">
                  <Text fontSize="xs" color="gray.400" fontWeight="medium">
                    POPULAR SYMBOLS
                  </Text>
                </Box>
              )}
              <VStack gap={0} align="stretch">
                {displaySymbols.slice(0, 20).map((symbol) => (
                  <Box
                    key={symbol.symbol}
                    px={4}
                    py={2.5}
                    cursor="pointer"
                    bg={value === symbol.symbol ? 'gray.700' : 'transparent'}
                    _hover={{ bg: 'gray.750' }}
                    onClick={() => handleSelect(symbol.symbol)}
                    borderBottomWidth="1px"
                    borderColor="gray.700"
                  >
                    <VStack align="start" gap={0}>
                      <Text fontWeight="medium" fontSize="sm" color="white">
                        {symbol.displayName}
                      </Text>
                      <Text fontSize="xs" color="gray.400">
                        {symbol.symbol}
                      </Text>
                    </VStack>
                  </Box>
                ))}
              </VStack>
            </>
          )}
        </Box>
      )}
    </Box>
  );
}


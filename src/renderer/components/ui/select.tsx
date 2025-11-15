import {
    Box,
    HStack,
    Input,
    Spinner,
    Text,
    VStack,
} from '@chakra-ui/react';
import { useEffect, useRef, useState } from 'react';

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
}

interface SelectProps {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  enableSearch?: boolean;
  label?: string;
  description?: string;
  isLoading?: boolean;
  onSearchChange?: (query: string) => void;
  searchPlaceholder?: string;
  emptyMessage?: string;
  minWidth?: string;
  sectionLabel?: string | undefined;
  noWrap?: boolean;
}

export const Select = ({
  value,
  options,
  onChange,
  placeholder = 'Select an option',
  enableSearch = false,
  label,
  description,
  isLoading = false,
  onSearchChange,
  searchPlaceholder = 'Search...',
  emptyMessage = 'No options found',
  minWidth,
  sectionLabel,
  noWrap = false,
}: SelectProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    if (onSearchChange) {
      onSearchChange(query);
    }
  };

  const filteredOptions = enableSearch && searchQuery && !onSearchChange
    ? options.filter((opt) =>
        opt.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        opt.value.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : options;

  const selectedOption = options.find((opt) => opt.value === value);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <Box position="relative" w="100%" minW={minWidth} ref={containerRef}>
      <Box
        as="button"
        w="100%"
        px={4}
        py={2.5}
        bg="bg.panel"
        border="1px solid"
        borderColor="border"
        borderRadius="md"
        textAlign="left"
        cursor="pointer"
        _hover={{ borderColor: 'gray.600', bg: 'bg.muted' }}
        onClick={() => setIsOpen(!isOpen)}
      >
        <HStack justify="space-between">
          <VStack align="start" gap={0}>
            {label && (
              <Text fontSize="xs" color="fg.muted">
                {label}
              </Text>
            )}
            <Text fontSize="sm" fontWeight="medium" color="fg" whiteSpace={noWrap ? 'nowrap' : undefined}>
              {selectedOption?.label || placeholder}
            </Text>
            {description && selectedOption && (
              <Text fontSize="xs" color="fg.muted">
                {description}
              </Text>
            )}
          </VStack>
          <Text fontSize="xs" color="fg.muted">▼</Text>
        </HStack>
      </Box>

      {isOpen && (
        <Box
          position="absolute"
          top="100%"
          left={0}
          right={0}
          mt={2}
          bg="bg.panel"
          border="1px solid"
          borderColor="border"
          borderRadius="md"
          shadow="lg"
          zIndex={1000}
          maxH="400px"
          overflowY="auto"
        >
          {enableSearch && (
            <Box p={3} borderBottomWidth="1px" borderColor="border">
              <Input
                placeholder={searchPlaceholder}
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                size="sm"
                bg="bg.muted"
                borderColor="border"
                _focus={{ borderColor: 'blue.500' }}
                autoFocus
              />
            </Box>
          )}

          {isLoading && (
            <Box p={4} textAlign="center">
              <Spinner size="sm" color="blue.500" />
            </Box>
          )}

          {!isLoading && filteredOptions.length === 0 && (
            <Box p={4} textAlign="center">
              <Text color="fg.muted" fontSize="sm">
                {emptyMessage}
              </Text>
            </Box>
          )}

          {!isLoading && filteredOptions.length > 0 && (
            <>
              {sectionLabel && (
                <Box px={3} py={2} bg="bg.muted">
                  <Text fontSize="xs" color="fg.muted" fontWeight="medium">
                    {sectionLabel}
                  </Text>
                </Box>
              )}
              <VStack gap={0} align="stretch">
                {filteredOptions.map((option) => (
                  <Box
                    key={option.value}
                    px={4}
                    py={2.5}
                    cursor="pointer"
                    bg={value === option.value ? 'bg.muted' : 'transparent'}
                    _hover={{ bg: 'bg.muted' }}
                    onClick={() => handleSelect(option.value)}
                    borderBottomWidth="1px"
                    borderColor="border"
                  >
                    <VStack align="start" gap={0}>
                      <Text fontWeight="medium" fontSize="sm" color="fg">
                        {option.label}
                      </Text>
                      {option.description && (
                        <Text fontSize="xs" color="fg.muted">
                          {option.description}
                        </Text>
                      )}
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
};

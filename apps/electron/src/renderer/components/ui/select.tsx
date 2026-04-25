import {
    Box,
    HStack,
    Input,
    Portal,
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

export interface SelectProps {
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
  openUpwards?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  variant?: 'bordered' | 'borderless';
  usePortal?: boolean;
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
  openUpwards = false,
  size = 'md',
  variant = 'bordered',
  usePortal = true,
}: SelectProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const clickedInsideContainer = containerRef.current?.contains(target);
      const clickedInsideDropdown = dropdownRef.current?.contains(target);
      
      if (!clickedInsideContainer && !clickedInsideDropdown) {
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

  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: openUpwards ? rect.top - 8 : rect.bottom + 8,
        left: rect.left,
        width: rect.width,
      });
    }
  }, [isOpen, openUpwards]);

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

  const sizeStyles = {
    xs: { px: 2, py: 1.5, fontSize: 'xs' },
    sm: { px: 3, py: 2, fontSize: 'sm' },
    md: { px: 4, py: 2.5, fontSize: 'sm' },
    lg: { px: 5, py: 3, fontSize: 'md' },
  };

  const currentSize = sizeStyles[size];

  const isBordered = variant === 'bordered';

  return (
    <Box position="relative" w="100%" minW={minWidth} ref={containerRef}>
      <Box
        as="button"
        w="100%"
        px={currentSize.px}
        py={currentSize.py}
        bg={isBordered ? 'bg.panel' : 'transparent'}
        border={isBordered ? '1px solid' : undefined}
        borderColor={isBordered ? 'border' : undefined}
        textAlign="left"
        cursor="pointer"
        borderRadius="md"
        _hover={{ bg: 'bg.muted', borderColor: isBordered ? 'gray.600' : undefined }}
        onClick={() => setIsOpen(!isOpen)}
      >
        <HStack justify="space-between">
          <VStack align="start" gap={0}>
            {label && (
              <Text fontSize={size === 'xs' ? '2xs' : 'xs'} color="fg.muted">
                {label}
              </Text>
            )}
            <Text fontSize={currentSize.fontSize} fontWeight="medium" color="fg" whiteSpace={noWrap ? 'nowrap' : undefined}>
              {selectedOption?.label ?? placeholder}
            </Text>
            {description && selectedOption && (
              <Text fontSize={size === 'xs' ? '2xs' : 'xs'} color="fg.muted">
                {description}
              </Text>
            )}
          </VStack>
          <Text fontSize={size === 'xs' ? '2xs' : 'xs'} color="fg.muted">▼</Text>
        </HStack>
      </Box>

      {isOpen && (
        usePortal ? (
          <Portal>
            <Box
              ref={dropdownRef}
              position="fixed"
              top={openUpwards ? 'auto' : `${dropdownPosition.top}px`}
              bottom={openUpwards ? `calc(100vh - ${dropdownPosition.top}px)` : 'auto'}
              left={`${dropdownPosition.left}px`}
              width={`${dropdownPosition.width}px`}
              bg="bg.panel"
              border="1px solid"
              borderColor="border"
              borderRadius="md"
              shadow="lg"
              zIndex={99999}
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
                  px={3}
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
          </Portal>
        ) : (
          <Box
            ref={dropdownRef}
            position="absolute"
            top={openUpwards ? 'auto' : '100%'}
            bottom={openUpwards ? '100%' : 'auto'}
            left={0}
            width="100%"
            bg="bg.panel"
            border="1px solid"
            borderColor="border"
            borderRadius="md"
            shadow="lg"
            zIndex={1}
            maxH="400px"
            overflowY="auto"
            mt={openUpwards ? 0 : 2}
            mb={openUpwards ? 2 : 0}
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
                  px={3}
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
        )
      )}
    </Box>
  );
};

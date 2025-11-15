import { useColorMode } from '@/renderer/components/ui/color-mode';
import { Box, Flex, IconButton, Text } from '@chakra-ui/react';
import { HiCog6Tooth, HiMoon, HiSparkles, HiSun } from 'react-icons/hi2';
import { AISelector } from './AISelector';

interface HeaderProps {
  onSettingsClick?: () => void;
}

export const Header = ({ onSettingsClick }: HeaderProps) => {
  const { colorMode, toggleColorMode } = useColorMode();

  return (
    <Flex
      as="header"
      position="fixed"
      top={0}
      left={0}
      right={0}
      height="60px"
      px={4}
      align="center"
      justify="space-between"
      bg="bg.panel"
      borderBottom="1px solid"
      borderColor="border"
      zIndex={100}
    >
      <Flex align="center" gap={3}>
        <Box color="blue.500">
          <HiSparkles size={24} />
        </Box>
        <Text fontSize="xl" fontWeight="bold">
          MarketMind
        </Text>
      </Flex>

      <Flex align="center" gap={3}>
        <AISelector />
        <IconButton
          aria-label="Toggle color mode"
          onClick={toggleColorMode}
          variant="ghost"
          size="sm"
        >
          {colorMode === 'dark' ? <HiSun /> : <HiMoon />}
        </IconButton>
        <IconButton
          aria-label="Settings"
          onClick={onSettingsClick}
          variant="ghost"
          size="sm"
        >
          <HiCog6Tooth />
        </IconButton>
      </Flex>
    </Flex>
  );
};

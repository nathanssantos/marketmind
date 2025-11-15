import { useColorMode } from '@/renderer/components/ui/color-mode';
import { Box, Flex, IconButton, Text } from '@chakra-ui/react';
import { useState } from 'react';
import { HiCog6Tooth, HiMoon, HiQuestionMarkCircle, HiSparkles, HiSun } from 'react-icons/hi2';
import { KeyboardShortcutsDialog } from '../KeyboardShortcuts/KeyboardShortcutsDialog';
import { TooltipWrapper } from '../ui/Tooltip';
import { AISelector } from './AISelector';

interface HeaderProps {
  onSettingsClick?: () => void;
}

export const Header = ({ onSettingsClick }: HeaderProps) => {
  const { colorMode, toggleColorMode } = useColorMode();
  const [showShortcuts, setShowShortcuts] = useState(false);

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
        <TooltipWrapper label={`Theme: ${colorMode === 'dark' ? 'Dark' : 'Light'}`}>
          <IconButton
            aria-label="Toggle color mode"
            onClick={toggleColorMode}
            variant="ghost"
            size="sm"
          >
            {colorMode === 'dark' ? <HiSun /> : <HiMoon />}
          </IconButton>
        </TooltipWrapper>
        <TooltipWrapper label="Keyboard Shortcuts">
          <IconButton
            aria-label="Show keyboard shortcuts"
            onClick={() => setShowShortcuts(true)}
            variant="ghost"
            size="sm"
          >
            <HiQuestionMarkCircle />
          </IconButton>
        </TooltipWrapper>
        <TooltipWrapper label="Settings">
          <IconButton
            aria-label="Settings"
            onClick={onSettingsClick}
            variant="ghost"
            size="sm"
          >
            <HiCog6Tooth />
          </IconButton>
        </TooltipWrapper>
      </Flex>
      
      <KeyboardShortcutsDialog 
        isOpen={showShortcuts} 
        onClose={() => setShowShortcuts(false)} 
      />
    </Flex>
  );
};

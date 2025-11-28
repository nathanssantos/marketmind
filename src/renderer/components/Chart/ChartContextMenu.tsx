import { Menu, Portal } from '@chakra-ui/react';
import type { ReactNode } from 'react';
import { LuEye, LuEyeOff, LuTrash2 } from 'react-icons/lu';

interface ChartContextMenuProps {
  children: ReactNode;
  onDeletePatterns: () => void;
  onTogglePatternsVisibility: () => void;
  hasPatterns: boolean;
  patternsVisible: boolean;
}

export const ChartContextMenu = ({
  children,
  onDeletePatterns,
  onTogglePatternsVisibility,
  hasPatterns,
  patternsVisible,
}: ChartContextMenuProps) => {
  return (
    <Menu.Root>
      <Menu.ContextTrigger asChild>
        {children}
      </Menu.ContextTrigger>
      <Portal>
        <Menu.Positioner>
          <Menu.Content>
            <Menu.Item
              value="toggle-patterns"
              onClick={onTogglePatternsVisibility}
              disabled={!hasPatterns}
              padding="8px 12px"
              gap="8px"
              cursor="pointer"
              display="flex"
              alignItems="center"
              whiteSpace="nowrap"
              _hover={{
                bg: 'gray.100',
                _dark: {
                  bg: 'gray.700',
                },
              }}
            >
              {patternsVisible ? <LuEyeOff /> : <LuEye />}
              {patternsVisible ? 'Hide AI Patterns' : 'Show AI Patterns'}
            </Menu.Item>
            <Menu.Item
              value="delete-patterns"
              onClick={onDeletePatterns}
              disabled={!hasPatterns}
              padding="8px 12px"
              gap="8px"
              cursor="pointer"
              display="flex"
              alignItems="center"
              whiteSpace="nowrap"
              _hover={{
                bg: 'gray.100',
                _dark: {
                  bg: 'gray.700',
                },
              }}
            >
              <LuTrash2 />
              Delete AI Patterns
            </Menu.Item>
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
};

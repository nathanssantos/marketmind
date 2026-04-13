import { Portal } from '@chakra-ui/react';
import { Menu } from '@renderer/components/ui';
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
            <Menu.Item value="toggle-patterns" onClick={onTogglePatternsVisibility} disabled={!hasPatterns}>
              {patternsVisible ? <LuEyeOff /> : <LuEye />}
              {patternsVisible ? 'Hide AI Patterns' : 'Show AI Patterns'}
            </Menu.Item>
            <Menu.Item value="delete-patterns" onClick={onDeletePatterns} disabled={!hasPatterns}>
              <LuTrash2 />
              Delete AI Patterns
            </Menu.Item>
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
};

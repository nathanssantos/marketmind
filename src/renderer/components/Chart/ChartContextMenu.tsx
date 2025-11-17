import { Menu, Portal } from '@chakra-ui/react';
import type { ReactNode } from 'react';
import { LuEye, LuEyeOff, LuTrash2 } from 'react-icons/lu';

interface ChartContextMenuProps {
  children: ReactNode;
  onDeleteStudies: () => void;
  onToggleStudiesVisibility: () => void;
  hasStudies: boolean;
  studiesVisible: boolean;
}

export const ChartContextMenu = ({
  children,
  onDeleteStudies,
  onToggleStudiesVisibility,
  hasStudies,
  studiesVisible,
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
              value="toggle-studies"
              onClick={onToggleStudiesVisibility}
              disabled={!hasStudies}
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
              {studiesVisible ? <LuEyeOff /> : <LuEye />}
              {studiesVisible ? 'Hide AI Studies' : 'Show AI Studies'}
            </Menu.Item>
            <Menu.Item
              value="delete-studies"
              onClick={onDeleteStudies}
              disabled={!hasStudies}
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
              Delete AI Studies
            </Menu.Item>
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
};

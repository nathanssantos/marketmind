import { Menu } from '@chakra-ui/react';
import { LuEye, LuEyeOff, LuTrash2 } from 'react-icons/lu';

interface ChartContextMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  onClose: () => void;
  onDeleteStudies: () => void;
  onToggleStudiesVisibility: () => void;
  hasStudies: boolean;
  studiesVisible: boolean;
}

export const ChartContextMenu = ({
  isOpen,
  position,
  onClose,
  onDeleteStudies,
  onToggleStudiesVisibility,
  hasStudies,
  studiesVisible,
}: ChartContextMenuProps) => {
  if (!isOpen) return null;

  return (
    <Menu.Root open={isOpen} onOpenChange={({ open }) => !open && onClose()}>
      <Menu.Positioner>
        <Menu.Content
          style={{
            position: 'fixed',
            left: `${position.x}px`,
            top: `${position.y}px`,
          }}
        >
          <Menu.Item
            value="toggle-studies"
            onClick={onToggleStudiesVisibility}
            disabled={!hasStudies}
            css={{
              whiteSpace: 'nowrap',
            }}
          >
            {studiesVisible ? <LuEyeOff /> : <LuEye />}
            {studiesVisible ? 'Hide AI Studies' : 'Show AI Studies'}
          </Menu.Item>
          <Menu.Item
            value="delete-studies"
            onClick={onDeleteStudies}
            disabled={!hasStudies}
            css={{
              whiteSpace: 'nowrap',
            }}
          >
            <LuTrash2 />
            Delete AI Studies
          </Menu.Item>
        </Menu.Content>
      </Menu.Positioner>
    </Menu.Root>
  );
};

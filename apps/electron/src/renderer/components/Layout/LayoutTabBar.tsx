import { Flex, Text, Portal } from '@chakra-ui/react';
import { IconButton, Menu } from '@renderer/components/ui';
import { useLayoutStore } from '@renderer/store/layoutStore';
import { memo, useCallback } from 'react';
import { LuPencil, LuPlus, LuTrash2 } from 'react-icons/lu';

const LayoutTab = memo(function LayoutTab({
  id,
  name,
  isActive,
  canClose,
  onActivate,
  onDelete,
  onRename,
}: {
  id: string;
  name: string;
  isActive: boolean;
  canClose: boolean;
  onActivate: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string) => void;
}) {
  return (
    <Menu.Root>
      <Menu.ContextTrigger asChild>
        <Flex
          align="center"
          px={2}
          h="28px"
          cursor="pointer"
          borderBottom="2px solid"
          borderColor={isActive ? 'colorPalette.solid' : 'transparent'}
          _hover={{ bg: 'bg.muted' }}
          onClick={() => onActivate(id)}
          flexShrink={0}
        >
          <Text fontSize="xs" fontWeight={isActive ? 'semibold' : 'normal'} color={isActive ? 'fg' : 'fg.muted'}>
            {name}
          </Text>
        </Flex>
      </Menu.ContextTrigger>
      <Portal>
        <Menu.Positioner>
          <Menu.Content minW="120px">
            <Menu.Item value="rename" onClick={() => onRename(id)}>
              <LuPencil />
              Rename
            </Menu.Item>
            {canClose && (
              <Menu.Item value="delete" onClick={() => onDelete(id)} color="fg.error">
                <LuTrash2 />
                Delete
              </Menu.Item>
            )}
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
});

export const LayoutTabBar = memo(function LayoutTabBar() {
  const layoutPresets = useLayoutStore((s) => s.layoutPresets);
  const activeSymbolTabId = useLayoutStore((s) => s.activeSymbolTabId);
  const getActiveTab = useLayoutStore((s) => s.getActiveTab);
  const setActiveLayout = useLayoutStore((s) => s.setActiveLayout);
  const addLayout = useLayoutStore((s) => s.addLayout);
  const removeLayout = useLayoutStore((s) => s.removeLayout);
  const renameLayout = useLayoutStore((s) => s.renameLayout);

  const activeTab = getActiveTab();
  const activeLayoutId = activeTab?.activeLayoutId;

  const handleActivate = useCallback(
    (layoutId: string) => setActiveLayout(activeSymbolTabId, layoutId),
    [setActiveLayout, activeSymbolTabId],
  );

  const handleDelete = useCallback(
    (layoutId: string) => {
      const layout = layoutPresets.find(l => l.id === layoutId);
      if (!window.confirm(`Delete layout "${layout?.name ?? ''}"?`)) return;
      removeLayout(layoutId);
    },
    [removeLayout, layoutPresets],
  );

  const handleRename = useCallback(
    (layoutId: string) => {
      const layout = layoutPresets.find(l => l.id === layoutId);
      const newName = window.prompt('Layout name:', layout?.name ?? '');
      if (!newName?.trim()) return;
      renameLayout(layoutId, newName.trim());
    },
    [renameLayout, layoutPresets],
  );

  const handleAdd = useCallback(() => {
    const name = window.prompt('Layout name:');
    if (!name?.trim()) return;
    addLayout(name.trim());
  }, [addLayout]);

  const canClose = layoutPresets.length > 1;

  return (
    <Flex align="center" h="30px" bg="bg.panel" borderTop="1px solid" borderColor="border" overflow="hidden">
      <Flex align="center" overflow="auto" flex={1} css={{ '&::-webkit-scrollbar': { display: 'none' } }}>
        {layoutPresets.map((layout) => (
          <LayoutTab
            key={layout.id}
            id={layout.id}
            name={layout.name}
            isActive={layout.id === activeLayoutId}
            canClose={canClose}
            onActivate={handleActivate}
            onDelete={handleDelete}
            onRename={handleRename}
          />
        ))}
      </Flex>
      <IconButton aria-label="Add layout" size="2xs" variant="ghost" mx={1} onClick={handleAdd}>
        <LuPlus />
      </IconButton>
    </Flex>
  );
});

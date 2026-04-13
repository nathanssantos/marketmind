import { Flex, Text, Portal } from '@chakra-ui/react';
import { FormDialog, IconButton, Input, Menu, TooltipWrapper } from '@renderer/components/ui';
import { useLayoutStore } from '@renderer/store/layoutStore';
import { memo, useCallback, useState } from 'react';
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

interface NameDialogState {
  isOpen: boolean;
  mode: 'create' | 'rename';
  layoutId?: string;
  value: string;
}

const INITIAL_DIALOG: NameDialogState = { isOpen: false, mode: 'create', value: '' };

export const LayoutTabBar = memo(function LayoutTabBar() {
  const layoutPresets = useLayoutStore((s) => s.layoutPresets);
  const activeSymbolTabId = useLayoutStore((s) => s.activeSymbolTabId);
  const activeLayoutId = useLayoutStore((s) => {
    const tab = s.symbolTabs.find(t => t.id === s.activeSymbolTabId);
    return tab?.activeLayoutId;
  });
  const setActiveLayout = useLayoutStore((s) => s.setActiveLayout);
  const addLayout = useLayoutStore((s) => s.addLayout);
  const removeLayout = useLayoutStore((s) => s.removeLayout);
  const renameLayout = useLayoutStore((s) => s.renameLayout);

  const [dialog, setDialog] = useState<NameDialogState>(INITIAL_DIALOG);

  const handleActivate = useCallback(
    (layoutId: string) => setActiveLayout(activeSymbolTabId, layoutId),
    [setActiveLayout, activeSymbolTabId],
  );

  const handleDelete = useCallback(
    (layoutId: string) => removeLayout(layoutId),
    [removeLayout],
  );

  const handleRenameClick = useCallback(
    (layoutId: string) => {
      const layout = layoutPresets.find(l => l.id === layoutId);
      setDialog({ isOpen: true, mode: 'rename', layoutId, value: layout?.name ?? '' });
    },
    [layoutPresets],
  );

  const handleAddClick = useCallback(() => {
    setDialog({ isOpen: true, mode: 'create', value: '' });
  }, []);

  const handleDialogClose = useCallback(() => setDialog(INITIAL_DIALOG), []);

  const handleDialogSubmit = useCallback(() => {
    const name = dialog.value.trim();
    if (!name) return;

    if (dialog.mode === 'rename' && dialog.layoutId) renameLayout(dialog.layoutId, name);
    else if (dialog.mode === 'create') addLayout(name);

    setDialog(INITIAL_DIALOG);
  }, [dialog, renameLayout, addLayout]);

  const canClose = layoutPresets.length > 1;

  return (
    <>
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
              onRename={handleRenameClick}
            />
          ))}
        </Flex>
        <TooltipWrapper label="New layout" showArrow>
          <IconButton aria-label="Add layout" size="2xs" variant="ghost" mx={1} onClick={handleAddClick}>
            <LuPlus />
          </IconButton>
        </TooltipWrapper>
      </Flex>

      <FormDialog
        isOpen={dialog.isOpen}
        onClose={handleDialogClose}
        onSubmit={handleDialogSubmit}
        title={dialog.mode === 'create' ? 'New Layout' : 'Rename Layout'}
        submitLabel={dialog.mode === 'create' ? 'Create' : 'Save'}
        submitDisabled={!dialog.value.trim()}
        size="sm"
      >
        <Input
          placeholder="Layout name"
          value={dialog.value}
          onChange={(e) => setDialog(prev => ({ ...prev, value: e.target.value }))}
          onKeyDown={(e) => { if (e.key === 'Enter') handleDialogSubmit(); }}
          autoFocus
        />
      </FormDialog>
    </>
  );
});

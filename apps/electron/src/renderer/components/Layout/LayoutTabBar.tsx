import { Box, Flex, HStack, Stack, Text, Portal } from '@chakra-ui/react';
import { Field as ChakraField } from '@chakra-ui/react/field';
import { FormDialog, IconButton, Input, Menu, Select, TooltipWrapper } from '@renderer/components/ui';
import { LAYOUT_TEMPLATES, useLayoutStore, type LayoutTemplateKey } from '@renderer/store/layoutStore';
import { memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuCopy, LuPencil, LuPlus, LuTrash2, LuZoomIn, LuZoomOut } from 'react-icons/lu';
import { useUIZoom } from '../../hooks/useUIZoom';
import { ZOOM_MIN, ZOOM_MAX } from '../../constants/defaults';

const LayoutTab = memo(({
  id,
  name,
  isActive,
  canClose,
  onActivate,
  onDelete,
  onRename,
  onDuplicate,
}: {
  id: string;
  name: string;
  isActive: boolean;
  canClose: boolean;
  onActivate: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string) => void;
  onDuplicate: (id: string) => void;
}) => {
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
          <Menu.Content minW="140px">
            <Menu.Item value="rename" onClick={() => onRename(id)}>
              <LuPencil />
              Rename
            </Menu.Item>
            <Menu.Item value="duplicate" onClick={() => onDuplicate(id)}>
              <LuCopy />
              Duplicate
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
  template: LayoutTemplateKey;
}

const INITIAL_DIALOG: NameDialogState = {
  isOpen: false,
  mode: 'create',
  value: '',
  template: 'tradingSwing',
};

const TEMPLATE_LABELS: Record<LayoutTemplateKey, string> = {
  empty: 'Empty',
  tradingScalp: '1m / 5m / 15m',
  tradingDay: '5m / 15m / 1h',
  tradingSwing: '15m / 1h / 4h',
  tradingMidterm: '1h / 4h / 1d',
  tradingPosition: '4h / 1d / 1w',
  tradingLong: '1d / 1w / 1M',
  autoTrading: 'Auto-Trading',
  autoScalping: 'Auto-Scalping',
  marketIndicators: 'Market Indicators',
};

export const LayoutTabBar = memo(() => {
  const { t } = useTranslation();
  const { zoomLevel, zoomIn, zoomOut } = useUIZoom();
  const layoutPresets = useLayoutStore((s) => s.layoutPresets);
  const activeSymbolTabId = useLayoutStore((s) => s.activeSymbolTabId);
  const activeLayoutId = useLayoutStore((s) => {
    const tab = s.symbolTabs.find(t => t.id === s.activeSymbolTabId);
    return tab?.activeLayoutId;
  });
  const setActiveLayout = useLayoutStore((s) => s.setActiveLayout);
  const addLayout = useLayoutStore((s) => s.addLayout);
  const duplicateLayout = useLayoutStore((s) => s.duplicateLayout);
  const removeLayout = useLayoutStore((s) => s.removeLayout);
  const renameLayout = useLayoutStore((s) => s.renameLayout);

  const [dialog, setDialog] = useState<NameDialogState>(INITIAL_DIALOG);

  const templateOptions = useMemo(
    () => LAYOUT_TEMPLATES.map((t) => ({ value: t.key, label: TEMPLATE_LABELS[t.key] })),
    [],
  );

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
      setDialog({
        isOpen: true,
        mode: 'rename',
        layoutId,
        value: layout?.name ?? '',
        template: 'tradingSwing',
      });
    },
    [layoutPresets],
  );

  const handleDuplicateClick = useCallback(
    (layoutId: string) => duplicateLayout(layoutId),
    [duplicateLayout],
  );

  const handleAddClick = useCallback(() => {
    const defaultTemplate = LAYOUT_TEMPLATES.find((t) => t.key === 'tradingSwing')!;
    setDialog({
      isOpen: true,
      mode: 'create',
      value: defaultTemplate.defaultName,
      template: 'tradingSwing',
    });
  }, []);

  const handleTemplateChange = useCallback((value: string) => {
    const tplKey = value as LayoutTemplateKey;
    const tpl = LAYOUT_TEMPLATES.find((t) => t.key === tplKey);
    if (!tpl) return;
    setDialog((prev) => ({ ...prev, template: tplKey, value: tpl.defaultName }));
  }, []);

  const handleDialogClose = useCallback(() => setDialog(INITIAL_DIALOG), []);

  const handleDialogSubmit = useCallback(() => {
    const name = dialog.value.trim();
    if (!name) return;

    if (dialog.mode === 'rename' && dialog.layoutId) renameLayout(dialog.layoutId, name);
    else if (dialog.mode === 'create') addLayout(name, dialog.template);

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
              onDuplicate={handleDuplicateClick}
            />
          ))}
        </Flex>
        <TooltipWrapper label="New layout" showArrow>
          <IconButton aria-label="Add layout" size="2xs" variant="outline" color="fg.muted" mx={1} onClick={handleAddClick}>
            <LuPlus />
          </IconButton>
        </TooltipWrapper>

        <Box w="1px" h="22px" bg="border" flexShrink={0} mx={1} />

        <HStack gap={1} flexShrink={0} pr={2}>
          <TooltipWrapper label={t('header.zoomOut')} showArrow>
            <IconButton
              size="2xs"
              aria-label={t('header.zoomOut')}
              onClick={zoomOut}
              variant="outline"
              color="fg.muted"
              disabled={zoomLevel <= ZOOM_MIN}
            >
              <LuZoomOut />
            </IconButton>
          </TooltipWrapper>
          <Text fontSize="xs" color="fg.muted" minW="36px" textAlign="center" userSelect="none">
            {zoomLevel}%
          </Text>
          <TooltipWrapper label={t('header.zoomIn')} showArrow>
            <IconButton
              size="2xs"
              aria-label={t('header.zoomIn')}
              onClick={zoomIn}
              variant="outline"
              color="fg.muted"
              disabled={zoomLevel >= ZOOM_MAX}
            >
              <LuZoomIn />
            </IconButton>
          </TooltipWrapper>
        </HStack>
      </Flex>

      <FormDialog
        isOpen={dialog.isOpen}
        onClose={handleDialogClose}
        onSubmit={handleDialogSubmit}
        title={dialog.mode === 'create' ? 'New Layout' : 'Rename Layout'}
        submitLabel={dialog.mode === 'create' ? 'Create' : 'Save'}
        submitDisabled={!dialog.value.trim()}
        size="sm"
        bodyOverflow="visible"
      >
        <Stack gap={3}>
          {dialog.mode === 'create' && (
            <ChakraField.Root>
              <ChakraField.Label fontSize="xs" color="fg.muted">Template</ChakraField.Label>
              <Select
                size="sm"
                value={dialog.template}
                onChange={handleTemplateChange}
                options={templateOptions}
                usePortal={false}
              />
            </ChakraField.Root>
          )}
          <ChakraField.Root>
            <ChakraField.Label fontSize="xs" color="fg.muted">Name</ChakraField.Label>
            <Input
              placeholder="Layout name"
              value={dialog.value}
              onChange={(e) => setDialog(prev => ({ ...prev, value: e.target.value }))}
              onKeyDown={(e) => { if (e.key === 'Enter') handleDialogSubmit(); }}
              autoFocus
            />
          </ChakraField.Root>
        </Stack>
      </FormDialog>
    </>
  );
});

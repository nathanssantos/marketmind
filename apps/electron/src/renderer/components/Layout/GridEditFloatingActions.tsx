import { Box, HStack } from '@chakra-ui/react';
import { useLayoutStore } from '@renderer/store/layoutStore';
import { memo } from 'react';
import { AddPanelMenu } from './AddPanelMenu';
import { OrganizeGridMenu } from './OrganizeGridMenu';

/**
 * Floating cluster of grid-mutation actions (Add Panel + Organize Grid)
 * that only renders when the grid edit mode is on. Shipped in place of
 * the always-on header slots so the chart toolbar stays focused on
 * non-mutating affordances during normal use.
 *
 * Anchored bottom-right inside the panel-grid surface so it sits above
 * panels (zIndex=101 — one above the per-panel GridEditOverlay scrim
 * at 100) without overlapping the close `×` rendered top-right of each
 * panel header by `GridEditOverlay`.
 */
export const GridEditFloatingActions = memo(() => {
  const gridEditMode = useLayoutStore((s) => s.gridEditMode);
  if (!gridEditMode) return null;

  return (
    <Box
      position="absolute"
      bottom={2}
      right={2}
      zIndex={101}
      bg="bg.panel"
      borderWidth="1px"
      borderColor="border"
      borderRadius="md"
      p={1}
      shadow="md"
      data-testid="grid-edit-floating-actions"
    >
      <HStack gap={1}>
        <AddPanelMenu />
        <OrganizeGridMenu />
      </HStack>
    </Box>
  );
});

GridEditFloatingActions.displayName = 'GridEditFloatingActions';

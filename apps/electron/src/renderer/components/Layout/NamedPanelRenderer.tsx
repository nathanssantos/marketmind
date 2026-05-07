import { Flex, Spinner } from '@chakra-ui/react';
import { GridPanel } from '@renderer/components/ui';
import { getPanelDef } from '@renderer/grid/panel-registry';
import { useLayoutStore } from '@renderer/store/layoutStore';
import type { NamedPanelConfig } from '@shared/types/layout';
import { Suspense, lazy, memo, useCallback, useMemo } from 'react';
import { MM } from '@marketmind/tokens';

interface NamedPanelRendererProps {
  panelConfig: NamedPanelConfig;
  layoutId: string;
  isSinglePanel?: boolean;
}

const LazyByKind = new Map<string, ReturnType<typeof lazy>>();

const getLazyForKind = (kind: NamedPanelConfig['kind']): ReturnType<typeof lazy> => {
  let component = LazyByKind.get(kind);
  if (!component) {
    const def = getPanelDef(kind);
    component = lazy(def.load);
    LazyByKind.set(kind, component);
  }
  return component;
};

/**
 * v1.10 Track 4 — renders a registered named panel inside a `<GridPanel
 * mode="bare">` shell. Lazy-loads the body component from the registry's
 * `load`. Right-click on the panel body fires `onClose` (handled by the
 * GridPanel primitive) which removes the panel from the active layout.
 */
export const NamedPanelRenderer = memo(({ panelConfig, layoutId, isSinglePanel }: NamedPanelRendererProps) => {
  const isFocused = useLayoutStore((s) => s.focusedPanelId === panelConfig.id);
  const setFocusedPanel = useLayoutStore((s) => s.setFocusedPanel);
  const removePanel = useLayoutStore((s) => s.removePanel);

  const handleFocus = useCallback((id: string) => setFocusedPanel(id), [setFocusedPanel]);
  const handleClose = useCallback((id: string) => removePanel(layoutId, id), [removePanel, layoutId]);

  const Body = useMemo(() => getLazyForKind(panelConfig.kind), [panelConfig.kind]);

  return (
    <GridPanel
      mode="bare"
      id={panelConfig.id}
      isFocused={isFocused}
      showFocusBorder={!isSinglePanel}
      onFocus={handleFocus}
      onClose={handleClose}
    >
      {/* The data-panel-kind attribute lets E2E tests wait for a
          specific panel kind to be present, and helps debugging by
          making the DOM structure self-describing. Suspense fallback
          intentionally lives outside the marker so the marker only
          appears once the body is mounted. */}
      <div data-panel-kind={panelConfig.kind} style={{ height: '100%', width: '100%' }}>
        <Suspense
          fallback={
            <Flex justify="center" align="center" h="100%" py={MM.spinner.panel.py}>
              <Spinner size={MM.spinner.panel.size} />
            </Flex>
          }
        >
          <Body panelId={panelConfig.id} />
        </Suspense>
      </div>
    </GridPanel>
  );
});

NamedPanelRenderer.displayName = 'NamedPanelRenderer';

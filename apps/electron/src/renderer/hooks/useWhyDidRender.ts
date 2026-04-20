import { useEffect, useRef } from 'react';
import { perfMonitor } from '@renderer/utils/canvas/perfMonitor';

type PropsBag = Record<string, unknown>;

export const useWhyDidRender = (componentName: string, props: PropsBag): void => {
  const previousProps = useRef<PropsBag | null>(null);

  useEffect(() => {
    if (!perfMonitor.isEnabled()) return;
    perfMonitor.recordComponentRender(componentName);

    if (previousProps.current) {
      const changed: Record<string, { from: unknown; to: unknown }> = {};
      const keys = new Set([...Object.keys(previousProps.current), ...Object.keys(props)]);
      for (const key of keys) {
        if (previousProps.current[key] !== props[key]) {
          changed[key] = { from: previousProps.current[key], to: props[key] };
        }
      }
      if (Object.keys(changed).length > 0) {
         
        console.log(`[why-did-render] ${componentName}`, changed);
      }
    }

    previousProps.current = props;
  });
};

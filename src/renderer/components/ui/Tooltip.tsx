import { useColorMode } from '@/renderer/components/ui/color-mode';
import { Portal, Tooltip } from '@chakra-ui/react';
import { memo, useMemo, type ReactElement, type ReactNode } from 'react';

interface TooltipWrapperProps {
  label: string;
  children: ReactNode;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  isDisabled?: boolean;
  showArrow?: boolean;
}

export const TooltipWrapper = memo(({
  label,
  children,
  placement = 'top',
  isDisabled = false,
  showArrow = false,
}: TooltipWrapperProps): ReactElement => {
  const { colorMode } = useColorMode();

  const tooltipBg = useMemo(
    () => colorMode === 'dark' ? 'gray.800' : 'gray.700',
    [colorMode]
  );

  if (isDisabled) return <>{children}</>;

  return (
    <Tooltip.Root
      openDelay={300}
      closeDelay={0}
      positioning={{ placement }}
    >
      <Tooltip.Trigger asChild>
        {children}
      </Tooltip.Trigger>
      <Portal>
        <Tooltip.Positioner zIndex={9999} pointerEvents="none">
          <Tooltip.Content
            bg={tooltipBg}
            color="white"
            px={3}
            py={2}
            borderRadius="md"
            fontSize="sm"
            fontWeight="medium"
            boxShadow="lg"
            pointerEvents="auto"
            style={{
              '--tooltip-bg': colorMode === 'dark'
                ? 'var(--chakra-colors-gray-800)'
                : 'var(--chakra-colors-gray-700)',
            } as React.CSSProperties}
          >
            {showArrow && (
              <Tooltip.Arrow>
                <Tooltip.ArrowTip />
              </Tooltip.Arrow>
            )}
            {label}
          </Tooltip.Content>
        </Tooltip.Positioner>
      </Portal>
    </Tooltip.Root>
  );
});

TooltipWrapper.displayName = 'TooltipWrapper';

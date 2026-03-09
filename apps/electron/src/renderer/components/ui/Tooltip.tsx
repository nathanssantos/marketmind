import { useColorMode } from '@/renderer/components/ui/color-mode';
import { Portal, Tooltip } from '@chakra-ui/react';
import type { CSSProperties } from 'react';
import { memo, useMemo, useState, type ReactElement, type ReactNode } from 'react';

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
  const [isOpen, setIsOpen] = useState(false);

  const tooltipBg = useMemo(
    () => colorMode === 'dark' ? 'gray.800' : 'gray.700',
    [colorMode]
  );

  if (isDisabled) return <>{children}</>;

  return (
    <Tooltip.Root
      openDelay={300}
      closeDelay={0}
      closeOnPointerDown
      closeOnEscape
      closeOnScroll
      positioning={{ placement }}
      open={isOpen}
      onOpenChange={(details) => setIsOpen(details.open)}
    >
      <Tooltip.Trigger asChild>
        {children}
      </Tooltip.Trigger>
      {isOpen && (
        <Portal>
          <Tooltip.Positioner zIndex={9999}>
            <Tooltip.Content
              bg={tooltipBg}
              color="white"
              px={3}
              py={2}
              borderRadius="md"
              fontSize="sm"
              fontWeight="medium"
              boxShadow="lg"
              style={{
                '--tooltip-bg': colorMode === 'dark'
                  ? 'var(--chakra-colors-gray-800)'
                  : 'var(--chakra-colors-gray-700)',
              } as CSSProperties}
            >
              {showArrow && (
                <Tooltip.Arrow>
                  <Tooltip.ArrowTip />
                </Tooltip.Arrow>
              )}
              <span style={{ whiteSpace: 'pre-line' }}>{label}</span>
            </Tooltip.Content>
          </Tooltip.Positioner>
        </Portal>
      )}
    </Tooltip.Root>
  );
});

TooltipWrapper.displayName = 'TooltipWrapper';

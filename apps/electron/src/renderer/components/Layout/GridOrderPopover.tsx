import { Box, HStack, Text, VStack } from '@chakra-ui/react';
import { Button, Popover, Slider, Switch, ToggleIconButton, TooltipWrapper } from '@renderer/components/ui';
import { GRID_ORDER_LIMITS, useGridOrderStore } from '@renderer/store/gridOrderStore';
import { memo, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuGrid3X3 } from 'react-icons/lu';

interface GridOrderPopoverProps {
  triggerElement?: React.ReactNode;
}

export const GridOrderPopover = memo(({ triggerElement }: GridOrderPopoverProps = {}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const {
    isGridModeActive,
    gridSide,
    gridCount,
    snapEnabled,
    snapDistancePx,
    toggleGridMode,
    setGridSide,
    setGridCount,
    setSnapEnabled,
    setSnapDistancePx,
  } = useGridOrderStore();

  const handleCountChange = useCallback((value: number[]) => {
    const v = value[0];
    if (v !== undefined) setGridCount(v);
  }, [setGridCount]);

  const handleSnapDistanceChange = useCallback((value: number[]) => {
    const v = value[0];
    if (v !== undefined) setSnapDistancePx(v);
  }, [setSnapDistancePx]);

  const handleClick = useCallback(() => {
    toggleGridMode();
  }, [toggleGridMode]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsOpen((prev) => !prev);
  }, []);

  return (
    <Box position="relative" lineHeight={0}>
      <Popover
        open={isOpen}
        onOpenChange={(details) => setIsOpen(details.open)}
        width="220px"
        positioning={{ placement: 'bottom-start', offset: { mainAxis: 8 } }}
        trigger={
          triggerElement ? (
            <Box>{triggerElement}</Box>
          ) : (
            <Box>
              <TooltipWrapper
                label={t('chart.gridOrders.title')}
                showArrow
                placement="bottom"
                isDisabled={isOpen}
              >
                <ToggleIconButton
                  active={isGridModeActive}
                  aria-label={t('chart.gridOrders.title')}
                  size="2xs"
                  h="22px"
                  w="22px"
                  onClick={handleClick}
                  onContextMenu={handleContextMenu}
                >
                  <LuGrid3X3 />
                </ToggleIconButton>
              </TooltipWrapper>
            </Box>
          )
        }
      >
        <VStack gap={2} p={3} align="stretch">
          <Text fontSize="xs" fontWeight="semibold" color="fg">
            {t('chart.gridOrders.title')}
          </Text>

          <HStack gap={1}>
            <Button
              size="2xs"
              fontSize="xs"
              h="22px"
              flex={1}
              colorPalette="green"
              variant={gridSide === 'BUY' ? 'solid' : 'outline'}
              onClick={() => setGridSide('BUY')}
            >
              {t('chart.gridOrders.buy')}
            </Button>
            <Button
              size="2xs"
              fontSize="xs"
              h="22px"
              flex={1}
              colorPalette="red"
              variant={gridSide === 'SELL' ? 'solid' : 'outline'}
              onClick={() => setGridSide('SELL')}
            >
              {t('chart.gridOrders.sell')}
            </Button>
          </HStack>

          <VStack gap={0.5} align="stretch">
            <HStack justify="space-between">
              <Text fontSize="xs" color="fg.muted">{t('chart.gridOrders.orderCount')}</Text>
              <Text fontSize="xs" color="fg" fontWeight="medium">{gridCount}</Text>
            </HStack>
            <Slider
              value={[gridCount]}
              onValueChange={handleCountChange}
              min={GRID_ORDER_LIMITS.MIN_ORDERS}
              max={GRID_ORDER_LIMITS.MAX_ORDERS}
              step={1}
            />
          </VStack>

          <HStack justify="space-between">
            <Text fontSize="xs" color="fg.muted">{t('chart.gridOrders.magnet')}</Text>
            <Switch
              checked={snapEnabled}
              onCheckedChange={setSnapEnabled}
              size="sm"
            />
          </HStack>

          {snapEnabled && (
            <VStack gap={0.5} align="stretch">
              <HStack justify="space-between">
                <Text fontSize="xs" color="fg.muted">{t('chart.gridOrders.snapDistance')}</Text>
                <Text fontSize="xs" color="fg" fontWeight="medium">{snapDistancePx}px</Text>
              </HStack>
              <Slider
                value={[snapDistancePx]}
                onValueChange={handleSnapDistanceChange}
                min={GRID_ORDER_LIMITS.MIN_SNAP_DISTANCE_PX}
                max={GRID_ORDER_LIMITS.MAX_SNAP_DISTANCE_PX}
                step={1}
              />
            </VStack>
          )}
        </VStack>
      </Popover>
    </Box>
  );
});

GridOrderPopover.displayName = 'GridOrderPopover';

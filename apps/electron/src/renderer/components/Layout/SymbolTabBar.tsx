import { Flex, HStack, Text } from '@chakra-ui/react';
import { CryptoIcon, IconButton, TooltipWrapper } from '@renderer/components/ui';
import { useTabTickers } from '@renderer/hooks/useTabTickers';
import { useDailyChangePct } from '@renderer/store/priceStore';
import { useLayoutStore } from '@renderer/store/layoutStore';
import { memo, useCallback, useMemo, useState } from 'react';
import { LuPlus, LuX } from 'react-icons/lu';

const DailyChangeBadge = memo(function DailyChangeBadge({ symbol }: { symbol: string }) {
  const pct = useDailyChangePct(symbol);
  if (pct === null) return null;
  const isPositive = pct >= 0;
  return (
    <Text
      fontSize="2xs"
      fontWeight="semibold"
      color={isPositive ? 'trading.profit' : 'trading.loss'}
      fontVariantNumeric="tabular-nums"
    >
      {isPositive ? '+' : ''}
      {pct.toFixed(2)}%
    </Text>
  );
});

const SymbolTab = memo(function SymbolTab({
  id,
  symbol,
  isActive,
  canClose,
  onActivate,
  onClose,
}: {
  id: string;
  symbol: string;
  isActive: boolean;
  canClose: boolean;
  onActivate: (id: string) => void;
  onClose: (id: string) => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <HStack
      gap={1}
      px={2}
      h="30px"
      cursor="pointer"
      borderBottom="2px solid"
      borderColor={isActive ? 'colorPalette.solid' : 'transparent'}
      _hover={{ bg: 'bg.muted' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onActivate(id)}
      flexShrink={0}
    >
      <CryptoIcon symbol={symbol} size={14} />
      <Text fontSize="xs" fontWeight={isActive ? 'semibold' : 'normal'} color={isActive ? 'fg' : 'fg.muted'}>
        {symbol}
      </Text>
      <DailyChangeBadge symbol={symbol} />
      {canClose && hovered && (
        <TooltipWrapper label="Close tab" showArrow>
          <IconButton
            aria-label="Close tab"
            size="2xs"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              onClose(id);
            }}
          >
            <LuX />
          </IconButton>
        </TooltipWrapper>
      )}
    </HStack>
  );
});

export const SymbolTabBar = memo(function SymbolTabBar() {
  const symbolTabs = useLayoutStore((s) => s.symbolTabs);
  const activeSymbolTabId = useLayoutStore((s) => s.activeSymbolTabId);
  const setActiveSymbolTab = useLayoutStore((s) => s.setActiveSymbolTab);
  const addSymbolTab = useLayoutStore((s) => s.addSymbolTab);
  const removeSymbolTab = useLayoutStore((s) => s.removeSymbolTab);

  const tabSymbols = useMemo(() => {
    const uniq = new Set<string>();
    for (const t of symbolTabs) if (t.symbol) uniq.add(t.symbol);
    return Array.from(uniq);
  }, [symbolTabs]);

  useTabTickers(tabSymbols);

  const handleActivate = useCallback(
    (id: string) => setActiveSymbolTab(id),
    [setActiveSymbolTab],
  );

  const handleClose = useCallback(
    (id: string) => removeSymbolTab(id),
    [removeSymbolTab],
  );

  const handleAdd = useCallback(
    () => addSymbolTab('BTCUSDT', 'FUTURES'),
    [addSymbolTab],
  );

  const canClose = symbolTabs.length > 1;

  return (
    <Flex align="center" h="32px" bg="bg.panel" borderBottom="1px solid" borderColor="border" overflow="hidden">
      <Flex align="center" overflow="auto" flex={1} css={{ '&::-webkit-scrollbar': { display: 'none' } }}>
        {symbolTabs.map((tab) => (
          <SymbolTab
            key={tab.id}
            id={tab.id}
            symbol={tab.symbol}
            isActive={tab.id === activeSymbolTabId}
            canClose={canClose}
            onActivate={handleActivate}
            onClose={handleClose}
          />
        ))}
      </Flex>
      <TooltipWrapper label="New tab" showArrow>
        <IconButton aria-label="Add tab" size="2xs" variant="ghost" mx={1} onClick={handleAdd}>
          <LuPlus />
        </IconButton>
      </TooltipWrapper>
    </Flex>
  );
});

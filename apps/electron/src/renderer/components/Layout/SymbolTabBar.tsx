import { Flex, HStack, Text } from '@chakra-ui/react';
import { CryptoIcon, IconButton, TooltipWrapper } from '@renderer/components/ui';
import { useTabTickers, type TabTickerTarget } from '@renderer/hooks/useTabTickers';
import { useDailyChangePct } from '@renderer/store/priceStore';
import { useLayoutStore } from '@renderer/store/layoutStore';
import type { MarketType } from '@marketmind/types';
import { memo, useCallback, useMemo, useState } from 'react';
import { LuPlus, LuX } from 'react-icons/lu';

const DailyChangeBadge = memo(({
  symbol,
  marketType,
}: {
  symbol: string;
  marketType: MarketType;
}) => {
  const pct = useDailyChangePct(symbol, marketType);
  if (pct === null) return null;
  const isPositive = pct >= 0;
  return (
    <Text
      data-testid={`tab-pct-${symbol}`}
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

const SymbolTab = memo(({
  id,
  symbol,
  marketType,
  isActive,
  canClose,
  onActivate,
  onClose,
}: {
  id: string;
  symbol: string;
  marketType: MarketType;
  isActive: boolean;
  canClose: boolean;
  onActivate: (id: string) => void;
  onClose: (id: string) => void;
}) => {
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
      <DailyChangeBadge symbol={symbol} marketType={marketType} />
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

export const SymbolTabBar = memo(() => {
  const symbolTabs = useLayoutStore((s) => s.symbolTabs);
  const activeSymbolTabId = useLayoutStore((s) => s.activeSymbolTabId);
  const setActiveSymbolTab = useLayoutStore((s) => s.setActiveSymbolTab);
  const addSymbolTab = useLayoutStore((s) => s.addSymbolTab);
  const removeSymbolTab = useLayoutStore((s) => s.removeSymbolTab);

  const tickerTargets = useMemo<TabTickerTarget[]>(() => {
    const uniq = new Map<string, TabTickerTarget>();
    for (const t of symbolTabs) {
      if (!t.symbol) continue;
      const key = `${t.symbol}:${t.marketType}`;
      if (!uniq.has(key)) uniq.set(key, { symbol: t.symbol, marketType: t.marketType });
    }
    return Array.from(uniq.values());
  }, [symbolTabs]);

  useTabTickers(tickerTargets);

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
            marketType={tab.marketType}
            isActive={tab.id === activeSymbolTabId}
            canClose={canClose}
            onActivate={handleActivate}
            onClose={handleClose}
          />
        ))}
      </Flex>
      <TooltipWrapper label="New tab" showArrow>
        <IconButton aria-label="Add tab" size="2xs" variant="outline" color="fg.muted" mx={1} onClick={handleAdd}>
          <LuPlus />
        </IconButton>
      </TooltipWrapper>
    </Flex>
  );
});

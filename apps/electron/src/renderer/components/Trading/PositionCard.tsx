import { Box, Flex, Stack, Text } from '@chakra-ui/react';
import { Badge, CryptoIcon } from '@renderer/components/ui';
import { BrlValue } from '@renderer/components/BrlValue';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { LuBot } from 'react-icons/lu';
import { StrategyInfoPopover } from './StrategyInfoPopover';
import type { NavigateToSymbol, PortfolioPosition } from './portfolioTypes';

interface PositionCardProps {
  position: PortfolioPosition;
  currency: string;
  walletBalance: number;
  onNavigateToSymbol?: NavigateToSymbol;
}

const PositionCardComponent = ({ position, currency, onNavigateToSymbol }: PositionCardProps) => {
  const { t } = useTranslation();
  const isProfitable = position.pnl >= 0;
  const isLong = position.side === 'LONG';

  return (
    <Box
      p={3}
      bg="bg.muted"
      borderRadius="md"
      borderLeft="4px solid"
      borderColor={isLong ? 'green.500' : 'red.500'}
    >
      <Stack gap={1.5} mb={2}>
        <Flex justify="space-between" align="center">
          <Flex align="center" gap={1.5}>
            <CryptoIcon
              symbol={position.symbol}
              size={16}
              onClick={() => onNavigateToSymbol?.(position.symbol, position.marketType)}
              cursor={onNavigateToSymbol ? 'pointer' : 'default'}
            />
            <Text
              fontWeight="bold"
              fontSize="sm"
              cursor={onNavigateToSymbol ? 'pointer' : 'default'}
              _hover={onNavigateToSymbol ? { color: 'blue.500', textDecoration: 'underline' } : undefined}
              onClick={() => onNavigateToSymbol?.(position.symbol, position.marketType)}
            >
              {position.symbol}
            </Text>
          </Flex>
          <Text fontSize="xs" color="fg.muted">
            {position.openedAt.toLocaleString(undefined, {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </Flex>
        <Flex gap={2} align="center" flexWrap="wrap">
          <Badge colorPalette={isLong ? 'green' : 'red'} size="xs">
            {t(`trading.ticket.${isLong ? 'long' : 'short'}`)}
          </Badge>
          {position.count > 1 && (
            <Badge colorPalette="yellow" size="xs">
              {t('trading.portfolio.entriesCount', { count: position.count })}
            </Badge>
          )}
          {position.isAutoTrade && (
            <Badge colorPalette="blue" size="xs">
              <Flex align="center" gap={1}>
                <LuBot size={10} />
                AUTO
              </Flex>
            </Badge>
          )}
          {position.marketType === 'FUTURES' && (
            <Badge colorPalette="orange" size="xs">
              FUTURES
            </Badge>
          )}
          {position.leverage > 1 && (
            <Badge colorPalette="purple" size="xs">
              {position.leverage}x
            </Badge>
          )}
          {position.setupType && (
            position.isAutoTrade ? (
              <StrategyInfoPopover
                setupType={position.setupType}
                executionId={position.id}
                symbol={position.symbol}
              >
                <Badge colorPalette="purple" size="xs">
                  {position.setupType}
                </Badge>
              </StrategyInfoPopover>
            ) : (
              <Badge colorPalette="purple" size="xs">
                {position.setupType}
              </Badge>
            )
          )}
        </Flex>
      </Stack>

      <Stack gap={1} fontSize="xs">
        <Flex justify="space-between">
          <Text color="fg.muted">{t('trading.portfolio.quantity')}</Text>
          <Text fontWeight="medium">{position.quantity.toFixed(8)}</Text>
        </Flex>
        <Flex justify="space-between">
          <Text color="fg.muted">{t('trading.portfolio.avgPrice')}</Text>
          <Stack gap={0} align="flex-end">
            <Text>{currency} {position.avgPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
            <BrlValue usdtValue={position.avgPrice} />
          </Stack>
        </Flex>
        <Flex justify="space-between">
          <Text color="fg.muted">{t('trading.portfolio.currentPrice')}</Text>
          <Stack gap={0} align="flex-end">
            <Text fontWeight="medium">{currency} {position.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
            <BrlValue usdtValue={position.currentPrice} />
          </Stack>
        </Flex>
        {position.stopLoss && (
          <Flex justify="space-between">
            <Text color="fg.muted">{t('trading.orders.stopLoss')}</Text>
            <Stack gap={0} align="flex-end">
              <Text color="trading.loss">{currency} {position.stopLoss.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
              <BrlValue usdtValue={position.stopLoss} />
            </Stack>
          </Flex>
        )}
        {position.takeProfit && (
          <Flex justify="space-between">
            <Text color="fg.muted">{t('trading.orders.takeProfit')}</Text>
            <Stack gap={0} align="flex-end">
              <Text color="trading.profit">{currency} {position.takeProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
              <BrlValue usdtValue={position.takeProfit} />
            </Stack>
          </Flex>
        )}
        <Flex justify="space-between">
          <Text color="fg.muted">{t('trading.portfolio.pnl')}</Text>
          <Stack gap={0} align="flex-end">
            <Text fontWeight="medium" color={isProfitable ? 'trading.profit' : 'trading.loss'}>
              {isProfitable ? '+' : ''}{position.pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              {' '}({isProfitable ? '+' : ''}{position.pnlPercent.toFixed(2)}%)
            </Text>
            <BrlValue usdtValue={position.pnl} />
          </Stack>
        </Flex>
      </Stack>
    </Box>
  );
};

export const PositionCard = memo(PositionCardComponent);

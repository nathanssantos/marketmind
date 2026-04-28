import { Box, Flex, HStack, Spinner, Stack, Text } from '@chakra-ui/react';
import { MM } from '@renderer/theme/tokens';
import type { MarketType } from '@marketmind/types';
import {
  Badge,
  Button,
  CloseButton,
  CryptoIcon,
  DialogActionTrigger,
  DialogBackdrop,
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogPositioner,
  DialogRoot,
  DialogTitle,
} from '@renderer/components/ui';
import {
  useBackendAutoTrading,
  useDynamicSymbolScores,
  useRotationHistory,
} from '@renderer/hooks/useBackendAutoTrading';
import { useActiveWallet } from '@renderer/hooks/useActiveWallet';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuChartBar, LuHistory, LuTrendingUp } from 'react-icons/lu';

interface DynamicSymbolRankingsProps {
  isOpen: boolean;
  onClose: () => void;
  marketType?: MarketType;
}

type TabType = 'rankings' | 'history';

export const DynamicSymbolRankings = ({
  isOpen,
  onClose,
  marketType = 'FUTURES',
}: DynamicSymbolRankingsProps) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabType>('rankings');

  const { activeWallet } = useActiveWallet();
  const walletId = activeWallet?.id ?? '';

  const { symbolScores, isLoadingScores } = useDynamicSymbolScores(marketType, 50);
  const { watcherStatus } = useBackendAutoTrading(walletId);
  const { rotationHistory, isLoadingRotationHistory } = useRotationHistory(walletId, 10);

  const activeSymbols = new Set(watcherStatus?.activeWatchers?.map((w) => w.symbol) ?? []);

  return (
    <DialogRoot open={isOpen} onOpenChange={(e) => !e.open && onClose()} size="xl">
      <DialogBackdrop />
      <DialogPositioner>
        <DialogContent maxW="800px" maxH="80vh">
          <DialogHeader>
            <DialogTitle>
              <Flex align="center" gap={2}>
                <LuChartBar />
                {t('tradingProfiles.dynamicSelection.rankingsTitle')}
              </Flex>
            </DialogTitle>
          </DialogHeader>

          <DialogBody overflowY="auto">
            <Stack gap={4}>
              <HStack>
                <Button
                  size="sm"
                  variant={activeTab === 'rankings' ? 'solid' : 'outline'}
                  onClick={() => setActiveTab('rankings')}
                >
                  <LuTrendingUp size={14} />
                  {t('tradingProfiles.dynamicSelection.tabRankings')}
                </Button>
                <Button
                  size="sm"
                  variant={activeTab === 'history' ? 'solid' : 'outline'}
                  onClick={() => setActiveTab('history')}
                >
                  <LuHistory size={14} />
                  {t('tradingProfiles.dynamicSelection.tabHistory')}
                </Button>
              </HStack>

              {activeTab === 'rankings' && (
                <RankingsTab
                  symbolScores={symbolScores}
                  isLoading={isLoadingScores}
                  activeSymbols={activeSymbols}
                  t={t}
                />
              )}

              {activeTab === 'history' && (
                <HistoryTab
                  rotationHistory={rotationHistory}
                  isLoading={isLoadingRotationHistory}
                  t={t}
                />
              )}
            </Stack>
          </DialogBody>

          <DialogFooter>
            <DialogActionTrigger asChild>
              <Button variant="outline">{t('common.close')}</Button>
            </DialogActionTrigger>
          </DialogFooter>
          <DialogCloseTrigger asChild>
            <CloseButton size="sm" />
          </DialogCloseTrigger>
        </DialogContent>
      </DialogPositioner>
    </DialogRoot>
  );
};

interface SymbolScore {
  symbol: string;
  compositeScore: number;
  marketCapRank: number;
  breakdown: {
    marketCapScore: number;
    volumeScore: number;
    volatilityScore: number;
    priceChangeScore: number;
    setupFrequencyScore: number;
    winRateScore: number;
    profitFactorScore: number;
  };
  rawData: {
    marketCap: number;
    volume24h: number;
    priceChange24h: number;
    setupCount7d: number;
    winRate: number | null;
    profitFactor: number | null;
  };
}

interface RankingsTabProps {
  symbolScores: SymbolScore[];
  isLoading: boolean;
  activeSymbols: Set<string>;
  t: ReturnType<typeof useTranslation>['t'];
}

const RankingsTab = ({ symbolScores, isLoading, activeSymbols, t }: RankingsTabProps) => {
  if (isLoading) {
    return (
      <Flex justify="center" py={MM.spinner.panel.py}>
        <Spinner size={MM.spinner.panel.size} />
      </Flex>
    );
  }

  if (symbolScores.length === 0) {
    return (
      <Box p={4} textAlign="center" color="fg.muted">
        <Text>{t('tradingProfiles.dynamicSelection.noScores')}</Text>
      </Box>
    );
  }

  return (
    <Stack gap={0} borderWidth="1px" borderRadius="md" overflow="hidden">
      <Flex
        bg="bg.muted"
        px={4}
        py={2}
        borderBottomWidth="1px"
        fontWeight="semibold"
        fontSize="xs"
        color="fg.muted"
      >
        <Text flex="0 0 40px">#</Text>
        <Text flex="1">{t('tradingProfiles.dynamicSelection.symbol')}</Text>
        <Text flex="0 0 80px" textAlign="right">{t('tradingProfiles.dynamicSelection.score')}</Text>
        <Text flex="0 0 100px" textAlign="right">{t('tradingProfiles.dynamicSelection.marketCap')}</Text>
        <Text flex="0 0 80px" textAlign="right">{t('tradingProfiles.dynamicSelection.volume')}</Text>
        <Text flex="0 0 80px" textAlign="right">{t('tradingProfiles.dynamicSelection.change')}</Text>
        <Text flex="0 0 60px" textAlign="center">{t('tradingProfiles.dynamicSelection.status')}</Text>
      </Flex>

      {symbolScores.map((score, index) => (
        <Flex
          key={score.symbol}
          px={4}
          py={2}
          borderBottomWidth={index < symbolScores.length - 1 ? '1px' : 0}
          align="center"
          _hover={{ bg: 'bg.muted' }}
        >
          <Text flex="0 0 40px" fontSize="sm" fontWeight="medium" color="fg.muted">
            {index + 1}
          </Text>
          <Flex flex="1" align="center" gap={2}>
            <CryptoIcon symbol={score.symbol} size={18} />
            <Text fontSize="sm" fontWeight="medium" fontFamily="mono">
              {score.symbol}
            </Text>
            <Box
              px={1.5}
              py={0.5}
              bg="bg.muted"
              borderRadius="sm"
              fontSize="2xs"
            >
              #{score.marketCapRank}
            </Box>
          </Flex>
          <Text flex="0 0 80px" fontSize="sm" textAlign="right" fontWeight="bold">
            {score.compositeScore.toFixed(1)}
          </Text>
          <Text flex="0 0 100px" fontSize="xs" textAlign="right" color="fg.muted">
            ${formatNumber(score.rawData.marketCap)}
          </Text>
          <Text flex="0 0 80px" fontSize="xs" textAlign="right" color="fg.muted">
            ${formatNumber(score.rawData.volume24h)}
          </Text>
          <Text
            flex="0 0 80px"
            fontSize="xs"
            textAlign="right"
            color={score.rawData.priceChange24h >= 0 ? 'green.500' : 'red.500'}
          >
            {score.rawData.priceChange24h >= 0 ? '+' : ''}
            {score.rawData.priceChange24h.toFixed(2)}%
          </Text>
          <Flex flex="0 0 60px" justify="center">
            {activeSymbols.has(score.symbol) ? (
              <Badge colorPalette="green" size="sm">
                {t('common.active')}
              </Badge>
            ) : (
              <Badge colorPalette="gray" size="sm">
                -
              </Badge>
            )}
          </Flex>
        </Flex>
      ))}
    </Stack>
  );
};

interface RotationResult {
  added: string[];
  removed: string[];
  kept: string[];
  timestamp: string;
}

interface HistoryTabProps {
  rotationHistory: RotationResult[];
  isLoading: boolean;
  t: ReturnType<typeof useTranslation>['t'];
}

const HistoryTab = ({ rotationHistory, isLoading, t }: HistoryTabProps) => {
  if (isLoading) {
    return (
      <Flex justify="center" py={MM.spinner.panel.py}>
        <Spinner size={MM.spinner.panel.size} />
      </Flex>
    );
  }

  if (rotationHistory.length === 0) {
    return (
      <Box p={4} textAlign="center" color="fg.muted">
        <Text>{t('tradingProfiles.dynamicSelection.noHistory')}</Text>
      </Box>
    );
  }

  return (
    <Stack gap={3}>
      {rotationHistory.map((rotation, index) => (
        <Box
          key={index}
          p={4}
          borderWidth="1px"
          borderRadius="md"
          bg="bg.muted"
        >
          <Flex justify="space-between" align="center" mb={3}>
            <Text fontSize="sm" fontWeight="semibold">
              {new Date(rotation.timestamp).toLocaleString()}
            </Text>
          </Flex>

          <Flex gap={4} flexWrap="wrap">
            {rotation.added.length > 0 && (
              <Box>
                <Text fontSize="xs" color="green.fg" fontWeight="medium" mb={1}>
                  + {t('tradingProfiles.dynamicSelection.added')} ({rotation.added.length})
                </Text>
                <HStack flexWrap="wrap" gap={1}>
                  {rotation.added.map((symbol) => (
                    <Badge key={symbol} colorPalette="green" size="sm">
                      {symbol}
                    </Badge>
                  ))}
                </HStack>
              </Box>
            )}

            {rotation.removed.length > 0 && (
              <Box>
                <Text fontSize="xs" color="red.fg" fontWeight="medium" mb={1}>
                  - {t('tradingProfiles.dynamicSelection.removed')} ({rotation.removed.length})
                </Text>
                <HStack flexWrap="wrap" gap={1}>
                  {rotation.removed.map((symbol) => (
                    <Badge key={symbol} colorPalette="red" size="sm">
                      {symbol}
                    </Badge>
                  ))}
                </HStack>
              </Box>
            )}

          </Flex>

          <Text fontSize="xs" color="fg.muted" mt={2}>
            {t('tradingProfiles.dynamicSelection.keptCount', { count: rotation.kept.length })}
          </Text>
        </Box>
      ))}
    </Stack>
  );
};

const formatNumber = (num: number): string => {
  if (num >= 1e12) return `${(num / 1e12).toFixed(1)  }T`;
  if (num >= 1e9) return `${(num / 1e9).toFixed(1)  }B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(1)  }M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(1)  }K`;
  return num.toFixed(0);
};

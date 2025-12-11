import { Badge, Box, Collapsible, Flex, IconButton, Spinner, Text, useDisclosure } from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';
import { LuChevronDown, LuChevronUp, LuRefreshCw } from 'react-icons/lu';
import { useChartContext } from '../../context/ChartContext';
import { useMarketContext } from '../../hooks/useMarketContext';
import { useSetupStore } from '../../store/setupStore';
import { TooltipWrapper } from '../ui/Tooltip';

const getSentimentColor = (sentiment: string) => {
    if (sentiment === 'bullish') return 'green';
    if (sentiment === 'bearish') return 'red';
    return 'gray';
};

const getFearGreedColor = (index: number) => {
    if (index >= 75) return 'green';
    if (index >= 55) return 'blue';
    if (index >= 45) return 'gray';
    if (index >= 25) return 'orange';
    return 'red';
};

export const MarketContextDisplay = () => {
    const { t } = useTranslation();
    const { chartData } = useChartContext();
    const symbol = chartData?.symbol || '';
    const detectedSetups = useSetupStore((state) => state.detectedSetups);
    const { buildContext, getContext } = useMarketContext();
    const { open, onToggle } = useDisclosure({ defaultOpen: true });

    const context = getContext(symbol);
    const isLoading = buildContext.isPending;

    const handleRefresh = () => {
        if (symbol) {
            buildContext.mutate({
                symbol,
                detectedSetups: detectedSetups.filter(s => s.visible)
            });
        }
    };

    if (!symbol) return null;

    return (
        <Box borderWidth="1px" borderRadius="md" p={3} mb={3}>
            <Flex justify="space-between" align="center" mb={2}>
                <Flex align="center" gap={2}>
                    <Text fontSize="sm" fontWeight="semibold">
                        {t('context.marketContext')}
                    </Text>
                    {isLoading && <Spinner size="xs" />}
                </Flex>
                <Flex gap={1}>
                    <TooltipWrapper label={t('context.refresh')} showArrow>
                        <IconButton
                            aria-label={t('context.refresh')}
                            size="xs"
                            variant="ghost"
                            onClick={handleRefresh}
                            loading={isLoading}
                        >
                            <LuRefreshCw />
                        </IconButton>
                    </TooltipWrapper>
                    <IconButton
                        aria-label={open ? t('common.collapse') : t('common.expand')}
                        size="xs"
                        variant="ghost"
                        onClick={onToggle}
                    >
                        {open ? <LuChevronUp /> : <LuChevronDown />}
                    </IconButton>
                </Flex>
            </Flex>

            <Collapsible.Root open={open}>
                <Collapsible.Content>
                    {context ? (
                        <Flex direction="column" gap={2}>
                            <Flex justify="space-between" align="center">
                                <Text fontSize="xs" color="gray.500">
                                    {t('context.sentiment')}
                                </Text>
                                <Badge colorScheme={getSentimentColor(context.marketSentiment)} size="sm">
                                    {t(`context.sentiments.${context.marketSentiment}`)}
                                </Badge>
                            </Flex>

                            <Flex justify="space-between" align="center">
                                <Text fontSize="xs" color="gray.500">
                                    {t('context.fearGreed')}
                                </Text>
                                <Badge colorScheme={getFearGreedColor(context.fearGreedIndex)} size="sm">
                                    {context.fearGreedIndex}
                                </Badge>
                            </Flex>

                            <Flex justify="space-between" align="center">
                                <Text fontSize="xs" color="gray.500">
                                    {t('context.btcDominance')}
                                </Text>
                                <Text fontSize="xs" fontWeight="medium">
                                    {context.btcDominance.toFixed(2)}%
                                </Text>
                            </Flex>

                            {context.fundingRate !== undefined && (
                                <Flex justify="space-between" align="center">
                                    <Text fontSize="xs" color="gray.500">
                                        {t('context.fundingRate')}
                                    </Text>
                                    <Text
                                        fontSize="xs"
                                        fontWeight="medium"
                                        color={context.fundingRate > 0 ? 'green.500' : 'red.500'}
                                    >
                                        {(context.fundingRate * 100).toFixed(4)}%
                                    </Text>
                                </Flex>
                            )}

                            {context.openInterest !== undefined && (
                                <Flex justify="space-between" align="center">
                                    <Text fontSize="xs" color="gray.500">
                                        {t('context.openInterest')}
                                    </Text>
                                    <Text fontSize="xs" fontWeight="medium">
                                        {context.openInterest.toLocaleString()}
                                    </Text>
                                </Flex>
                            )}

                            <Flex justify="space-between" align="center">
                                <Text fontSize="xs" color="gray.500">
                                    {t('context.volatility')}
                                </Text>
                                <Badge colorScheme={context.volatility > 0.3 ? 'red' : 'blue'} size="sm">
                                    {(context.volatility * 100).toFixed(1)}%
                                </Badge>
                            </Flex>

                            {context.news.length > 0 && (
                                <Flex justify="space-between" align="center">
                                    <Text fontSize="xs" color="gray.500">
                                        {t('context.news')}
                                    </Text>
                                    <Text fontSize="xs" fontWeight="medium">
                                        {context.news.length} {t('context.articles')}
                                    </Text>
                                </Flex>
                            )}

                            {context.detectedSetups.length > 0 && (
                                <Flex justify="space-between" align="center">
                                    <Text fontSize="xs" color="gray.500">
                                        {t('context.detectedSetups')}
                                    </Text>
                                    <Badge colorScheme="purple" size="sm">
                                        {context.detectedSetups.length}
                                    </Badge>
                                </Flex>
                            )}
                        </Flex>
                    ) : (
                        <Text fontSize="xs" color="gray.500" textAlign="center" py={2}>
                            {t('context.noContext')}
                        </Text>
                    )}
                </Collapsible.Content>
            </Collapsible.Root>
        </Box>
    );
};

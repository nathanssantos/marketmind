import type { PositionSide, MarketType } from '@marketmind/types';
import { Box, Flex, HStack, Portal, Stack, Text } from '@chakra-ui/react';
import { Badge, IconButton, Menu, TooltipWrapper } from '@renderer/components/ui';
import { useChecklistEvaluation } from '@renderer/hooks/useChecklistEvaluation';
import { useTradingProfiles } from '@renderer/hooks/useTradingProfiles';
import { useLayoutStore } from '@renderer/store/layoutStore';
import { useUIPref } from '@renderer/store/preferencesStore';
import { useUIStore } from '@renderer/store/uiStore';
import { trpc } from '@renderer/utils/trpc';
import { calculateChecklistScore, type ChecklistCondition } from '@marketmind/trading-core';
import { getDefaultChecklistWeight } from '@marketmind/types';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { LuCheck, LuEllipsisVertical, LuTriangle, LuX } from 'react-icons/lu';
import { ChecklistScoreChart } from './ChecklistScoreChart';

interface ChecklistSectionProps {
  symbol: string;
  interval: string;
  marketType: MarketType;
}

type EvaluationResult = {
  conditionId: string;
  side: PositionSide | 'BOTH';
  evaluated: boolean;
  passed: boolean;
  tier: 'required' | 'preferred';
  op: string;
  value: number | null;
  weight?: number | null;
  indicatorLabel?: string | null;
  catalogType?: string | null;
  timeframe?: string | null;
  resolvedTimeframe?: string | null;
  countedLong?: boolean;
  countedShort?: boolean;
};

type ScoreData = {
  score: number;
  requiredPassed: number;
  requiredTotal: number;
  preferredPassed: number;
  preferredTotal: number;
  requiredAllPassed: boolean;
};

const ScoreBadgePair = ({
  letter,
  color,
  score,
}: {
  letter: string;
  color: string;
  score: ScoreData | undefined;
}) => {
  const { t } = useTranslation();
  if (!score) return null;
  const tooltip = score.requiredAllPassed
    ? t('checklist.section.requiredAllPassed', {
        p: score.requiredPassed,
        t: score.requiredTotal,
      })
    : t('checklist.section.requiredFailed', {
        p: score.requiredPassed,
        t: score.requiredTotal,
      });

  return (
    <TooltipWrapper label={tooltip} showArrow>
      <Text fontSize="2xs" fontWeight="semibold" color={color} lineHeight="1" fontVariantNumeric="tabular-nums">
        {letter} {Math.round(score.score)}%
      </Text>
    </TooltipWrapper>
  );
};

export const ChecklistSection = memo(({ symbol, interval, marketType }: ChecklistSectionProps) => {
  const { t } = useTranslation();
  const { getDefaultProfile, isLoadingProfiles } = useTradingProfiles();
  const [showScoreChart, setShowScoreChart] = useUIPref<boolean>('checklistScoreChartVisible', true);

  const defaultProfile = getDefaultProfile();
  const hasCurrentTimeframeCondition = useMemo(
    () => (defaultProfile?.checklistConditions ?? []).some(
      (c: ChecklistCondition) => c.enabled && c.timeframe === 'current',
    ),
    [defaultProfile?.checklistConditions],
  );

  // Subscribing to focusedInterval would re-render and re-fetch the
  // checklist on every focus change. We only need it when at least one
  // condition resolves against the current chart timeframe — otherwise
  // the eval/persisted-history bucket is stable on the prop interval and
  // focus changes should be a no-op.
  const focusedInterval = useLayoutStore((s) => {
    if (!hasCurrentTimeframeCondition) return undefined;
    const panel = s.getFocusedPanel();
    return panel?.kind === 'chart' ? panel.timeframe : undefined;
  });

  const effectiveInterval = focusedInterval ?? interval;
  const queryEnabled = Boolean(defaultProfile?.id) && Boolean(symbol) && Boolean(effectiveInterval);

  const checklistQuery = trpc.trading.evaluateChecklist.useQuery(
    {
      symbol,
      interval: effectiveInterval,
      marketType,
      profileId: defaultProfile?.id,
    },
    {
      enabled: queryEnabled,
      refetchInterval: 15_000,
      staleTime: 10_000,
    },
  );

  const isLoading = checklistQuery.isLoading;
  const isError = checklistQuery.isError;

  const checklistConditions = useMemo<ChecklistCondition[]>(
    () => (defaultProfile?.checklistConditions ?? []),
    [defaultProfile?.checklistConditions],
  );
  const clientResults = useChecklistEvaluation({
    symbol,
    interval: effectiveInterval,
    marketType,
    conditions: checklistConditions,
  });

  const mergedData = useMemo(() => {
    const backendData = checklistQuery.data;
    if (!backendData) return null;
    if (clientResults.size === 0) return backendData;

    const mergedResults = backendData.results.map((r) => {
      const c = clientResults.get(r.conditionId);
      if (!c) return r;
      return { ...r, evaluated: c.evaluated, passed: c.passed, value: c.value };
    });

    let longRequiredTotal = 0, longRequiredPassed = 0;
    let longRequiredWeightTotal = 0, longRequiredWeightPassed = 0;
    let longPreferredTotal = 0, longPreferredPassed = 0;
    let longPreferredWeightTotal = 0, longPreferredWeightPassed = 0;
    let shortRequiredTotal = 0, shortRequiredPassed = 0;
    let shortRequiredWeightTotal = 0, shortRequiredWeightPassed = 0;
    let shortPreferredTotal = 0, shortPreferredPassed = 0;
    let shortPreferredWeightTotal = 0, shortPreferredWeightPassed = 0;
    for (const r of mergedResults) {
      const w =
        typeof r.weight === 'number' && Number.isFinite(r.weight) && r.weight > 0
          ? r.weight
          : getDefaultChecklistWeight(r.timeframe ?? 'current');
      if (r.countedLong) {
        if (r.tier === 'required') {
          longRequiredTotal += 1;
          longRequiredWeightTotal += w;
          if (r.passed) {
            longRequiredPassed += 1;
            longRequiredWeightPassed += w;
          }
        } else {
          longPreferredTotal += 1;
          longPreferredWeightTotal += w;
          if (r.passed) {
            longPreferredPassed += 1;
            longPreferredWeightPassed += w;
          }
        }
      }
      if (r.countedShort) {
        if (r.tier === 'required') {
          shortRequiredTotal += 1;
          shortRequiredWeightTotal += w;
          if (r.passed) {
            shortRequiredPassed += 1;
            shortRequiredWeightPassed += w;
          }
        } else {
          shortPreferredTotal += 1;
          shortPreferredWeightTotal += w;
          if (r.passed) {
            shortPreferredPassed += 1;
            shortPreferredWeightPassed += w;
          }
        }
      }
    }
    const scoreLong = calculateChecklistScore({
      requiredTotal: longRequiredTotal,
      requiredPassed: longRequiredPassed,
      requiredWeightTotal: longRequiredWeightTotal,
      requiredWeightPassed: longRequiredWeightPassed,
      preferredTotal: longPreferredTotal,
      preferredPassed: longPreferredPassed,
      preferredWeightTotal: longPreferredWeightTotal,
      preferredWeightPassed: longPreferredWeightPassed,
    });
    const scoreShort = calculateChecklistScore({
      requiredTotal: shortRequiredTotal,
      requiredPassed: shortRequiredPassed,
      requiredWeightTotal: shortRequiredWeightTotal,
      requiredWeightPassed: shortRequiredWeightPassed,
      preferredTotal: shortPreferredTotal,
      preferredPassed: shortPreferredPassed,
      preferredWeightTotal: shortPreferredWeightTotal,
      preferredWeightPassed: shortPreferredWeightPassed,
    });
    return { ...backendData, results: mergedResults, scoreLong, scoreShort };
  }, [checklistQuery.data, clientResults]);

  const longScore = mergedData?.scoreLong;
  const shortScore = mergedData?.scoreShort;

  const groups = useMemo(() => {
    const allResults = (mergedData?.results ?? []) as EvaluationResult[];
    const long: EvaluationResult[] = [];
    const short: EvaluationResult[] = [];
    const both: EvaluationResult[] = [];
    for (const r of allResults) {
      if (r.side === 'LONG') long.push(r);
      else if (r.side === 'SHORT') short.push(r);
      else both.push(r);
    }
    return { long, short, both };
  }, [mergedData]);

  if (isLoadingProfiles || !defaultProfile) return null;

  const checklistCount = defaultProfile.checklistConditions?.length ?? 0;
  if (checklistCount === 0) return null;

  if (isError) {
    return (
      <HStack gap={1} px={1} py={0.5} fontSize="2xs" color="red.fg">
        <LuTriangle size={10} />
        <Text>{t('checklist.section.error')}</Text>
      </HStack>
    );
  }

  const renderRow = (r: EvaluationResult) => {
    const icon = r.evaluated
      ? r.passed
        ? <LuCheck color="var(--chakra-colors-green-500)" size={10} />
        : <LuX color="var(--chakra-colors-red-500)" size={10} />
      : <LuTriangle color="var(--chakra-colors-orange-500)" size={10} />;
    const opLabel = t(`checklist.ops.${r.op}`, { defaultValue: r.op });
    const tfLabel = r.timeframe
      ? t(`checklist.timeframes.${r.timeframe}`, { defaultValue: r.timeframe })
      : null;
    const isExcluded =
      r.countedLong === false && r.countedShort === false;
    const dedupTooltip = isExcluded
      ? t('checklist.section.dedupExcluded')
      : undefined;
    return (
      <Flex
        key={r.conditionId}
        align="center"
        gap={1.5}
        fontSize="2xs"
        opacity={isExcluded ? 0.55 : 1}
        title={dedupTooltip}
      >
        <Box flexShrink={0}>{icon}</Box>
        <Text flex={1} truncate>
          {r.indicatorLabel ?? r.catalogType ?? '—'}
        </Text>
        {tfLabel && (
          <Badge size="xs" variant="outline" colorPalette="gray">
            {tfLabel}
          </Badge>
        )}
        <Badge size="xs" variant="outline" colorPalette={r.tier === 'required' ? 'orange' : 'blue'}>
          {t(`checklist.tier.${r.tier}Short`, {
            defaultValue: r.tier === 'required' ? 'req' : 'pref',
          })}
        </Badge>
        {typeof r.weight === 'number' && Number.isFinite(r.weight) && r.weight > 0 && (
          <Badge size="xs" variant="subtle" colorPalette="purple">
            ×{r.weight.toFixed(2)}
          </Badge>
        )}
        <Text color="fg.muted" minW="32px" textAlign="right">
          {opLabel}
        </Text>
        <Text color="fg.muted" minW="40px" textAlign="right">
          {r.value !== null && Number.isFinite(r.value) ? r.value.toFixed(2) : '—'}
        </Text>
      </Flex>
    );
  };

  const renderGroup = (rows: EvaluationResult[], titleKey: string, defaultLabel: string) => {
    if (rows.length === 0) return null;
    return (
      <Stack gap={0.5}>
        <Text
          fontSize="2xs"
          fontWeight="bold"
          color="fg.muted"
          textTransform="uppercase"
          letterSpacing="wider"
          px={1}
        >
          {t(titleKey, { defaultValue: defaultLabel })}
        </Text>
        {rows.map(renderRow)}
      </Stack>
    );
  };

  const hasAnyResults = groups.long.length + groups.short.length + groups.both.length > 0;

  const scoreBadges = isLoading && !checklistQuery.data ? (
    <Text fontSize="2xs" color="fg.muted">
      …
    </Text>
  ) : (
    <HStack gap={2}>
      <ScoreBadgePair letter="L" color="trading.profit" score={longScore} />
      <ScoreBadgePair letter="S" color="trading.loss" score={shortScore} />
    </HStack>
  );

  const openProfileEditor = () => useUIStore.getState().setTradingProfilesDialogOpen(true);

  const optionsMenu = (
    <Menu.Root>
      <Menu.Trigger asChild>
        <IconButton
          size="2xs"
          variant="ghost"
          aria-label={t('checklist.section.options')}
          h="14px"
          minW="14px"
        >
          <LuEllipsisVertical size={12} />
        </IconButton>
      </Menu.Trigger>
      <Portal>
        <Menu.Positioner>
          <Menu.Content minW="180px">
            <Menu.Item value="toggle-chart" onClick={() => setShowScoreChart(!showScoreChart)}>
              {showScoreChart ? t('checklist.section.hideChart') : t('checklist.section.showChart')}
            </Menu.Item>
            <Menu.Item value="edit-profile" onClick={openProfileEditor}>
              {t('checklist.section.editProfile')}
            </Menu.Item>
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );

  return (
    <Stack gap={0.5} align="stretch">
      {showScoreChart ? (
        <>
          <Flex align="center" gap={1} px={1} pt={0.5}>
            <Box flex={1} />
            {scoreBadges}
            {optionsMenu}
          </Flex>
          <ChecklistScoreChart
            resetKey={`${defaultProfile?.id ?? 'no-profile'}:${symbol}:${effectiveInterval}:${marketType}`}
            longScore={longScore?.score}
            shortScore={shortScore?.score}
            profileId={defaultProfile?.id}
            symbol={symbol}
            interval={effectiveInterval}
            marketType={marketType}
          />
        </>
      ) : (
        <Flex align="center" gap={1} px={1} py={0.5}>
          <Box flex={1} />
          {scoreBadges}
          {optionsMenu}
        </Flex>
      )}

      <Stack gap={1.5} px={1} pb={1}>
        {!hasAnyResults ? (
          <Text fontSize="2xs" color="fg.muted" px={1}>
            {t('checklist.section.empty')}
          </Text>
        ) : (
          <>
            {renderGroup(groups.long, 'checklist.section.long', 'Long')}
            {renderGroup(groups.short, 'checklist.section.short', 'Short')}
            {renderGroup(groups.both, 'checklist.section.both', 'Both')}
          </>
        )}
      </Stack>
    </Stack>
  );
});

ChecklistSection.displayName = 'ChecklistSection';

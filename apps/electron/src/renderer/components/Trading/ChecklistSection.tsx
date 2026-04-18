import { Box, Flex, HStack, Stack, Text } from '@chakra-ui/react';
import { Badge, IconButton, TooltipWrapper } from '@renderer/components/ui';
import { useTradingProfiles } from '@renderer/hooks/useTradingProfiles';
import { trpc } from '@renderer/utils/trpc';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuCheck, LuChevronDown, LuChevronRight, LuTriangle, LuX } from 'react-icons/lu';

interface ChecklistSectionProps {
  symbol: string;
  interval: string;
  marketType: 'SPOT' | 'FUTURES';
  side?: 'LONG' | 'SHORT' | 'BOTH';
}

const scoreColor = (score: number, requiredAllPassed: boolean): string => {
  if (!requiredAllPassed) return 'red';
  if (score >= 80) return 'green';
  if (score >= 50) return 'blue';
  return 'orange';
};

export const ChecklistSection = memo(({ symbol, interval, marketType, side = 'BOTH' }: ChecklistSectionProps) => {
  const { t } = useTranslation();
  const { getDefaultProfile, isLoadingProfiles } = useTradingProfiles();
  const [expanded, setExpanded] = useState(false);

  const defaultProfile = getDefaultProfile();

  const { data, isLoading, isError } = trpc.trading.evaluateChecklist.useQuery(
    {
      symbol,
      interval,
      marketType,
      side,
      profileId: defaultProfile?.id,
    },
    {
      enabled: Boolean(defaultProfile?.id) && Boolean(symbol) && Boolean(interval),
      refetchInterval: 15_000,
      staleTime: 10_000,
    },
  );

  if (isLoadingProfiles || !defaultProfile) return null;

  const checklistCount = defaultProfile.checklistConditions?.length ?? 0;
  if (checklistCount === 0) return null;

  if (isError) {
    return (
      <HStack gap={1} px={1} py={0.5} fontSize="2xs" color="red.400">
        <LuTriangle size={10} />
        <Text>{t('checklist.section.error', { defaultValue: 'Checklist error' })}</Text>
      </HStack>
    );
  }

  const score = data?.score;
  const results = data?.results ?? [];

  const palette = score ? scoreColor(score.score, score.requiredAllPassed) : 'gray';

  return (
    <Stack gap={0.5} align="stretch" pt={0.5} borderTop="1px solid" borderColor="border">
      <Flex
        align="center"
        gap={1}
        px={1}
        py={0.5}
        cursor="pointer"
        borderRadius="sm"
        _hover={{ bg: 'bg.muted' }}
        onClick={() => setExpanded((v) => !v)}
      >
        <IconButton size="2xs" variant="ghost" aria-label="Toggle checklist" h="14px" minW="14px">
          {expanded ? <LuChevronDown /> : <LuChevronRight />}
        </IconButton>
        <Text fontSize="xs" color="fg.muted" flex={1}>
          {t('checklist.section.title', { defaultValue: 'Checklist' })}
        </Text>
        {isLoading && !data ? (
          <Text fontSize="2xs" color="fg.muted">
            …
          </Text>
        ) : score ? (
          <HStack gap={1}>
            <TooltipWrapper
              label={
                score.requiredAllPassed
                  ? t('checklist.section.requiredAllPassed', {
                      defaultValue: 'All required conditions passed',
                    })
                  : t('checklist.section.requiredFailed', {
                      defaultValue: 'Required conditions failing',
                    })
              }
              showArrow
            >
              <Badge size="sm" colorPalette={score.requiredAllPassed ? 'green' : 'red'} variant="subtle">
                {score.requiredPassed}/{score.requiredTotal}R
              </Badge>
            </TooltipWrapper>
            <Badge size="sm" colorPalette={palette} variant="solid">
              {Math.round(score.score)}%
            </Badge>
          </HStack>
        ) : null}
      </Flex>

      {expanded && (
        <Stack gap={0.5} px={1} pb={1}>
          {results.length === 0 ? (
            <Text fontSize="2xs" color="fg.muted" px={1}>
              {t('checklist.section.empty', { defaultValue: 'No conditions evaluated.' })}
            </Text>
          ) : (
            results.map((r) => {
              const icon = r.evaluated
                ? r.passed
                  ? <LuCheck color="var(--chakra-colors-green-500)" size={10} />
                  : <LuX color="var(--chakra-colors-red-500)" size={10} />
                : <LuTriangle color="var(--chakra-colors-orange-500)" size={10} />;
              const opLabel = t(`checklist.ops.${r.op}`, { defaultValue: r.op });
              return (
                <Flex key={r.conditionId} align="center" gap={1.5} fontSize="2xs">
                  <Box flexShrink={0}>{icon}</Box>
                  <Text flex={1} truncate>
                    {r.indicatorLabel || r.catalogType || '—'}
                  </Text>
                  <Badge size="sm" variant="outline" colorPalette={r.tier === 'required' ? 'orange' : 'blue'}>
                    {t(`checklist.tier.${r.tier}`, { defaultValue: r.tier })}
                  </Badge>
                  <Text color="fg.muted" minW="32px" textAlign="right">
                    {opLabel}
                  </Text>
                  <Text color="fg.muted" minW="40px" textAlign="right">
                    {r.value !== null && Number.isFinite(r.value) ? r.value.toFixed(2) : '—'}
                  </Text>
                </Flex>
              );
            })
          )}
        </Stack>
      )}
    </Stack>
  );
});

ChecklistSection.displayName = 'ChecklistSection';

import { Badge, TooltipWrapper } from '@renderer/components/ui';
import { Flex, Text } from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';
import { LuCheck, LuMinus, LuX } from 'react-icons/lu';

type ShortDifficulty = 'easy' | 'hard' | 'unavailable';

interface ShortabilityInfo {
  symbol: string;
  available: boolean;
  difficulty: ShortDifficulty;
  sharesAvailable?: number;
  feeRate?: number;
}

interface ShortabilityBadgeProps {
  info: ShortabilityInfo;
  showShareCount?: boolean;
  size?: 'xs' | 'sm' | 'md';
}

const formatShareCount = (count: number): string => {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(0)}K`;
  return count.toString();
};

const getDifficultyConfig = (difficulty: ShortDifficulty) => {
  switch (difficulty) {
    case 'easy':
      return {
        colorPalette: 'green',
        icon: LuCheck,
        label: 'shortability.easy',
      };
    case 'hard':
      return {
        colorPalette: 'orange',
        icon: LuMinus,
        label: 'shortability.hard',
      };
    case 'unavailable':
    default:
      return {
        colorPalette: 'red',
        icon: LuX,
        label: 'shortability.unavailable',
      };
  }
};

export function ShortabilityBadge({
  info,
  showShareCount = true,
  size = 'xs',
}: ShortabilityBadgeProps) {
  const { t } = useTranslation();
  const config = getDifficultyConfig(info.difficulty);
  const Icon = config.icon;

  const tooltipContent = info.available
    ? info.sharesAvailable
      ? t('shortability.tooltip.available', {
          shares: formatShareCount(info.sharesAvailable),
          difficulty: t(config.label),
        })
      : t('shortability.tooltip.availableNoCount', { difficulty: t(config.label) })
    : t('shortability.tooltip.unavailable');

  return (
    <TooltipWrapper label={tooltipContent} showArrow>
      <Badge
        size={size}
        colorPalette={config.colorPalette}
        variant="subtle"
        cursor="help"
      >
        <Flex align="center" gap={1}>
          <Icon size={size === 'xs' ? 10 : size === 'sm' ? 12 : 14} />
          <Text>{t(config.label)}</Text>
          {showShareCount && info.sharesAvailable !== undefined && info.available && (
            <Text color="fg.muted">({formatShareCount(info.sharesAvailable)})</Text>
          )}
        </Flex>
      </Badge>
    </TooltipWrapper>
  );
}

export const createMockShortabilityInfo = (
  difficulty: ShortDifficulty = 'easy',
  symbol = 'AAPL'
): ShortabilityInfo => {
  const sharesMap: Record<ShortDifficulty, number | undefined> = {
    easy: 1_000_000,
    hard: 5_000,
    unavailable: 0,
  };

  return {
    symbol,
    available: difficulty !== 'unavailable',
    difficulty,
    sharesAvailable: sharesMap[difficulty],
    feeRate: difficulty === 'hard' ? 0.05 : undefined,
  };
};

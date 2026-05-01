import { Box, HStack, Text, VStack } from '@chakra-ui/react';
import { passwordStrength, validatePassword, type PasswordIssue } from '@marketmind/utils';
import { memo } from 'react';
import { LuCheck, LuX } from 'react-icons/lu';

const RULE_KEYS: PasswordIssue[] = ['tooShort', 'noUppercase', 'noLowercase', 'noDigit', 'noSymbol'];

const STRENGTH_LABEL_KEYS = ['weak', 'weak', 'fair', 'good', 'strong', 'excellent'] as const;
const STRENGTH_COLORS = ['trading.loss', 'trading.loss', 'trading.warning', 'trading.warning', 'trading.profit', 'trading.profit'] as const;

export type PasswordStrengthLabelKey = 'weak' | 'fair' | 'good' | 'strong' | 'excellent';

export interface PasswordStrengthMeterLabels {
  strength: Record<PasswordStrengthLabelKey, string>;
  rules: Record<PasswordIssue, string>;
}

export interface PasswordStrengthMeterProps {
  password: string;
  visible?: boolean;
  /**
   * Pre-resolved localized strings. The renderer's `usePasswordStrengthMeterLabels`
   * hook builds this from `react-i18next`; ui-core stays locale-agnostic so the
   * package can ship without an i18n dependency.
   */
  labels: PasswordStrengthMeterLabels;
}

export const PasswordStrengthMeter = memo(({ password, visible = true, labels }: PasswordStrengthMeterProps) => {
  if (!visible || password.length === 0) return null;

  const { issues } = validatePassword(password);
  const issueSet = new Set(issues);
  const { score } = passwordStrength(password);
  const labelKey = STRENGTH_LABEL_KEYS[score + 1] ?? 'weak';
  const barColor = STRENGTH_COLORS[score + 1] ?? 'trading.loss';
  const segmentsActive = score + 1;

  return (
    <VStack align="stretch" gap={1.5} mt={1}>
      <HStack gap={1}>
        {[0, 1, 2, 3, 4].map((i) => (
          <Box
            key={i}
            flex={1}
            h="3px"
            borderRadius="full"
            bg={i < segmentsActive ? barColor : 'bg.muted'}
          />
        ))}
        <Text fontSize="2xs" color="fg.muted" minW="60px" textAlign="right">
          {labels.strength[labelKey]}
        </Text>
      </HStack>

      <VStack align="stretch" gap={0.5}>
        {RULE_KEYS.map((key) => {
          const failed = issueSet.has(key);
          return (
            <HStack key={key} gap={1.5} fontSize="2xs">
              <Box color={failed ? 'fg.muted' : 'trading.profit'} display="flex" alignItems="center">
                {failed ? <LuX size={12} /> : <LuCheck size={12} />}
              </Box>
              <Text color={failed ? 'fg.muted' : 'fg'}>
                {labels.rules[key]}
              </Text>
            </HStack>
          );
        })}
        {issueSet.has('common') && (
          <HStack gap={1.5} fontSize="2xs">
            <Box color="trading.loss" display="flex" alignItems="center">
              <LuX size={12} />
            </Box>
            <Text color="trading.loss">{labels.rules.common}</Text>
          </HStack>
        )}
      </VStack>
    </VStack>
  );
});

PasswordStrengthMeter.displayName = 'PasswordStrengthMeter';

import { Radio, RadioGroup } from '@/renderer/components/ui/radio';
import { Box, Collapsible, Flex, HStack, Stack, Text } from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';
import { LuChevronDown, LuChevronUp } from 'react-icons/lu';

export interface TpModeSectionProps {
  isExpanded: boolean;
  onToggle: () => void;
  tpCalculationMode: 'default' | 'fibonacci';
  fibonacciTargetLevel: 'auto' | '1' | '1.272' | '1.382' | '1.5' | '1.618' | '2' | '2.272' | '2.618';
  onTpModeChange: (details: { value: string }) => void;
  onFibonacciLevelChange: (details: { value: string }) => void;
  isPending: boolean;
}

export const TpModeSection = ({
  isExpanded,
  onToggle,
  tpCalculationMode,
  fibonacciTargetLevel,
  onTpModeChange,
  onFibonacciLevelChange,
  isPending,
}: TpModeSectionProps) => {
  const { t } = useTranslation();

  return (
    <Box>
      <Flex
        justify="space-between"
        align="center"
        cursor="pointer"
        onClick={onToggle}
        _hover={{ bg: 'bg.muted' }}
        p={2}
        mx={-2}
        borderRadius="md"
      >
        <Box>
          <Text fontSize="lg" fontWeight="bold">
            {t('settings.algorithmicAutoTrading.tpMode.title')}
          </Text>
          <Text fontSize="sm" color="fg.muted">
            {t('settings.algorithmicAutoTrading.tpMode.description')}
          </Text>
        </Box>
        {isExpanded ? <LuChevronUp size={20} /> : <LuChevronDown size={20} />}
      </Flex>

      <Collapsible.Root open={isExpanded}>
        <Collapsible.Content>
          <RadioGroup
            value={tpCalculationMode}
            onValueChange={onTpModeChange}
            disabled={isPending}
          >
            <HStack gap={6} mt={4}>
              <Radio value="default">
                <Box>
                  <Text fontSize="sm" fontWeight="medium">
                    {t('settings.algorithmicAutoTrading.tpMode.default')}
                  </Text>
                  <Text fontSize="xs" color="fg.muted">
                    {t('settings.algorithmicAutoTrading.tpMode.defaultDescription')}
                  </Text>
                </Box>
              </Radio>
              <Radio value="fibonacci">
                <Box>
                  <Text fontSize="sm" fontWeight="medium">
                    {t('settings.algorithmicAutoTrading.tpMode.fibonacci')}
                  </Text>
                  <Text fontSize="xs" color="fg.muted">
                    {t('settings.algorithmicAutoTrading.tpMode.fibonacciDescription')}
                  </Text>
                </Box>
              </Radio>
            </HStack>
          </RadioGroup>

          {tpCalculationMode === 'fibonacci' && (
            <Box mt={4} pl={4} borderLeftWidth="2px" borderLeftColor="blue.500">
              <Text fontSize="sm" fontWeight="medium" mb={2}>
                {t('settings.algorithmicAutoTrading.tpMode.fibonacciLevel.title')}
              </Text>
              <RadioGroup
                value={fibonacciTargetLevel}
                onValueChange={onFibonacciLevelChange}
                disabled={isPending}
              >
                <Stack gap={2}>
                  <Radio value="auto">
                    <Box>
                      <Text fontSize="sm">{t('settings.algorithmicAutoTrading.tpMode.fibonacciLevel.auto')}</Text>
                      <Text fontSize="xs" color="fg.muted">
                        {t('settings.algorithmicAutoTrading.tpMode.fibonacciLevel.autoDescription')}
                      </Text>
                    </Box>
                  </Radio>
                  <Radio value="1">
                    <Box>
                      <Text fontSize="sm">{t('settings.algorithmicAutoTrading.tpMode.fibonacciLevel.conservative')}</Text>
                      <Text fontSize="xs" color="fg.muted">
                        {t('settings.algorithmicAutoTrading.tpMode.fibonacciLevel.conservativeDescription')}
                      </Text>
                    </Box>
                  </Radio>
                  <Radio value="1.272">
                    <Box>
                      <Text fontSize="sm">{t('settings.algorithmicAutoTrading.tpMode.fibonacciLevel.moderate')}</Text>
                      <Text fontSize="xs" color="fg.muted">
                        {t('settings.algorithmicAutoTrading.tpMode.fibonacciLevel.moderateDescription')}
                      </Text>
                    </Box>
                  </Radio>
                  <Radio value="1.382">
                    <Box>
                      <Text fontSize="sm">{t('settings.algorithmicAutoTrading.tpMode.fibonacciLevel.moderateAggressive')}</Text>
                      <Text fontSize="xs" color="fg.muted">
                        {t('settings.algorithmicAutoTrading.tpMode.fibonacciLevel.moderateAggressiveDescription')}
                      </Text>
                    </Box>
                  </Radio>
                  <Radio value="1.5">
                    <Box>
                      <Text fontSize="sm">{t('settings.algorithmicAutoTrading.tpMode.fibonacciLevel.balanced')}</Text>
                      <Text fontSize="xs" color="fg.muted">
                        {t('settings.algorithmicAutoTrading.tpMode.fibonacciLevel.balancedDescription')}
                      </Text>
                    </Box>
                  </Radio>
                  <Radio value="1.618">
                    <Box>
                      <Text fontSize="sm">{t('settings.algorithmicAutoTrading.tpMode.fibonacciLevel.aggressive')}</Text>
                      <Text fontSize="xs" color="fg.muted">
                        {t('settings.algorithmicAutoTrading.tpMode.fibonacciLevel.aggressiveDescription')}
                      </Text>
                    </Box>
                  </Radio>
                  <Radio value="2">
                    <Box>
                      <Text fontSize="sm">{t('settings.algorithmicAutoTrading.tpMode.fibonacciLevel.extended')}</Text>
                      <Text fontSize="xs" color="fg.muted">
                        {t('settings.algorithmicAutoTrading.tpMode.fibonacciLevel.extendedDescription')}
                      </Text>
                    </Box>
                  </Radio>
                  <Radio value="2.272">
                    <Box>
                      <Text fontSize="sm">{t('settings.algorithmicAutoTrading.tpMode.fibonacciLevel.veryExtended')}</Text>
                      <Text fontSize="xs" color="fg.muted">
                        {t('settings.algorithmicAutoTrading.tpMode.fibonacciLevel.veryExtendedDescription')}
                      </Text>
                    </Box>
                  </Radio>
                  <Radio value="2.618">
                    <Box>
                      <Text fontSize="sm">{t('settings.algorithmicAutoTrading.tpMode.fibonacciLevel.superExtended')}</Text>
                      <Text fontSize="xs" color="fg.muted">
                        {t('settings.algorithmicAutoTrading.tpMode.fibonacciLevel.superExtendedDescription')}
                      </Text>
                    </Box>
                  </Radio>
                </Stack>
              </RadioGroup>
            </Box>
          )}
        </Collapsible.Content>
      </Collapsible.Root>
    </Box>
  );
};

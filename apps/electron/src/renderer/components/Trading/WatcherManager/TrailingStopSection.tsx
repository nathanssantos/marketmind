import { Switch } from '@/renderer/components/ui/switch';
import { Box, Collapsible, Flex, HStack, Text } from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';
import { LuChevronDown, LuChevronUp } from 'react-icons/lu';

export interface TrailingStopSectionProps {
  isExpanded: boolean;
  onToggle: () => void;
  trailingStopEnabled: boolean;
  onTrailingStopEnabledChange: (enabled: boolean) => void;
  isPending: boolean;
}

export const TrailingStopSection = ({
  isExpanded,
  onToggle,
  trailingStopEnabled,
  onTrailingStopEnabledChange,
  isPending,
}: TrailingStopSectionProps) => {
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
            {t('watcherManager.trailingStop.title')}
          </Text>
          <Text fontSize="sm" color="fg.muted">
            {t('watcherManager.trailingStop.description')}
          </Text>
        </Box>
        {isExpanded ? <LuChevronUp size={20} /> : <LuChevronDown size={20} />}
      </Flex>

      <Collapsible.Root open={isExpanded}>
        <Collapsible.Content>
          <HStack justify="space-between" mt={4} p={3} bg="bg.subtle" borderRadius="md">
            <Box>
              <Text fontSize="sm" fontWeight="medium">
                {t('watcherManager.trailingStop.enabled')}
              </Text>
              <Text fontSize="xs" color="fg.muted">
                {t('watcherManager.trailingStop.enabledDescription')}
              </Text>
            </Box>
            <Switch
              checked={trailingStopEnabled}
              onCheckedChange={onTrailingStopEnabledChange}
              disabled={isPending}
            />
          </HStack>
        </Collapsible.Content>
      </Collapsible.Root>
    </Box>
  );
};

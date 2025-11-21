import { Box, Flex, IconButton, Tabs, Text } from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';
import { LuX } from 'react-icons/lu';
import { TooltipWrapper } from '../ui/Tooltip';

interface TradingSidebarProps {
  width: number;
}

export const TradingSidebar = ({ width }: TradingSidebarProps) => {
  const { t } = useTranslation();

  return (
    <Flex
      direction="column"
      width={`${width}px`}
      height="100%"
      bg="bg.surface"
      borderLeft="1px solid"
      borderColor="border"
    >
      <Flex
        px={4}
        py={3}
        align="center"
        justify="space-between"
        borderBottom="1px solid"
        borderColor="border"
        bg="bg.muted"
      >
        <Text fontSize="sm" fontWeight="bold">
          {t('trading.sidebar.title')}
        </Text>
        <TooltipWrapper label={t('trading.sidebar.close')} showArrow>
          <IconButton
            size="xs"
            variant="ghost"
            aria-label={t('trading.sidebar.close')}
          >
            <LuX />
          </IconButton>
        </TooltipWrapper>
      </Flex>

      <Tabs.Root defaultValue="wallets" fitted>
        <Tabs.List>
          <Tabs.Trigger value="wallets">
            <Text fontSize="xs">{t('trading.tabs.wallets')}</Text>
          </Tabs.Trigger>
          <Tabs.Trigger value="ticket">
            <Text fontSize="xs">{t('trading.tabs.ticket')}</Text>
          </Tabs.Trigger>
          <Tabs.Trigger value="portfolio">
            <Text fontSize="xs">{t('trading.tabs.portfolio')}</Text>
          </Tabs.Trigger>
          <Tabs.Trigger value="orders">
            <Text fontSize="xs">{t('trading.tabs.orders')}</Text>
          </Tabs.Trigger>
        </Tabs.List>

        <Box flex={1} overflowY="auto">
          <Tabs.Content value="wallets">
            <Box p={4}>
              <Text fontSize="sm" color="fg.muted">Wallets (TODO)</Text>
            </Box>
          </Tabs.Content>

          <Tabs.Content value="ticket">
            <Box p={4}>
              <Text fontSize="sm" color="fg.muted">Order Ticket (TODO)</Text>
            </Box>
          </Tabs.Content>

          <Tabs.Content value="portfolio">
            <Box p={4}>
              <Text fontSize="sm" color="fg.muted">Portfolio (TODO)</Text>
            </Box>
          </Tabs.Content>

          <Tabs.Content value="orders">
            <Box p={4}>
              <Text fontSize="sm" color="fg.muted">Orders (TODO)</Text>
            </Box>
          </Tabs.Content>
        </Box>
      </Tabs.Root>
    </Flex>
  );
};

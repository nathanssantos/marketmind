import { useColorMode } from '@/renderer/components/ui/color-mode';
import { Logo } from '@/renderer/components/ui/logo';
import { Flex, IconButton, Text } from '@chakra-ui/react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { LuMoon, LuSettings, LuSun } from 'react-icons/lu';
import { TooltipWrapper } from '../ui/Tooltip';

interface HeaderProps {
  onSettingsClick?: () => void;
}

export const Header = memo(({ onSettingsClick }: HeaderProps) => {
  const { t } = useTranslation();
  const { colorMode, toggleColorMode } = useColorMode();

  return (
    <Flex
      as="header"
      position="fixed"
      top={0}
      left={0}
      right={0}
      height="41px"
      px={4}
      py={1}
      align="center"
      justify="space-between"
      bg="bg.panel"
      borderBottom="1px solid"
      borderColor="border"
      zIndex={100}
    >
      <Flex align="center" gap={2}>
        <Logo size={20} />
        <Text fontSize="lg" fontWeight="bold">
          {t('app.title')}
        </Text>
      </Flex>

      <Flex align="center" gap={1}>
        <TooltipWrapper label={`${t('header.theme')}: ${colorMode === 'dark' ? t('header.themeDark') : t('header.themeLight')}`} placement="bottom" showArrow>
          <IconButton
            aria-label={t('header.toggleColorMode')}
            onClick={toggleColorMode}
            variant="ghost"
            size="2xs"
          >
            {colorMode === 'dark' ? <LuSun /> : <LuMoon />}
          </IconButton>
        </TooltipWrapper>
        <TooltipWrapper label={t('header.settings')} placement="bottom" showArrow>
          <IconButton
            aria-label={t('header.settings')}
            onClick={onSettingsClick}
            variant="ghost"
            size="2xs"
          >
            <LuSettings />
          </IconButton>
        </TooltipWrapper>
      </Flex>
    </Flex>
  );
});

Header.displayName = 'Header';

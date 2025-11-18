import { useColorMode } from '@/renderer/components/ui/color-mode';
import { Logo } from '@/renderer/components/ui/logo';
import { Flex, IconButton, Text } from '@chakra-ui/react';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuMoon, LuSettings, LuSun, LuTerminal } from 'react-icons/lu';
import { KeyboardShortcutsDialog } from '../KeyboardShortcuts/KeyboardShortcutsDialog';
import { TooltipWrapper } from '../ui/Tooltip';

interface HeaderProps {
  onSettingsClick?: () => void;
}

export const Header = memo(({ onSettingsClick }: HeaderProps) => {
  const { t } = useTranslation();
  const { colorMode, toggleColorMode } = useColorMode();
  const [showShortcuts, setShowShortcuts] = useState(false);

  return (
    <Flex
      as="header"
      position="fixed"
      top={0}
      left={0}
      right={0}
      height="60px"
      px={4}
      align="center"
      justify="space-between"
      bg="bg.panel"
      borderBottom="1px solid"
      borderColor="border"
      zIndex={100}
    >
      <Flex align="center" gap={2}>
        <Logo size={24} />
        <Text fontSize="xl" fontWeight="bold">
          {t('app.title')}
        </Text>
      </Flex>

      <Flex align="center" gap={3}>
        <TooltipWrapper label={`${t('header.theme')}: ${colorMode === 'dark' ? t('header.themeDark') : t('header.themeLight')}`} placement="bottom" showArrow>
          <IconButton
            aria-label={t('header.toggleColorMode')}
            onClick={toggleColorMode}
            variant="ghost"
            size="sm"
          >
            {colorMode === 'dark' ? <LuSun /> : <LuMoon />}
          </IconButton>
        </TooltipWrapper>
        <TooltipWrapper label={t('header.keyboardShortcuts')} placement="bottom" showArrow>
          <IconButton
            aria-label={t('header.showKeyboardShortcuts')}
            onClick={() => setShowShortcuts(true)}
            variant="ghost"
            size="sm"
          >
            <LuTerminal />
          </IconButton>
        </TooltipWrapper>
        <TooltipWrapper label={t('header.settings')} placement="bottom" showArrow>
          <IconButton
            aria-label={t('header.settings')}
            onClick={onSettingsClick}
            variant="ghost"
            size="sm"
          >
            <LuSettings />
          </IconButton>
        </TooltipWrapper>
      </Flex>
      
      <KeyboardShortcutsDialog 
        isOpen={showShortcuts} 
        onClose={() => setShowShortcuts(false)} 
      />
    </Flex>
  );
});

Header.displayName = 'Header';

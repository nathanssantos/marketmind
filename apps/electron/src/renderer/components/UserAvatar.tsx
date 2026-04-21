import { useGlobalActionsOptional } from '@/renderer/context/GlobalActionsContext';
import { Box, Portal, Text } from '@chakra-ui/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuLogOut, LuSettings, LuUser } from 'react-icons/lu';
import { useNavigate } from 'react-router-dom';
import { useBackendAuth } from '../hooks/useBackendAuth';
import { AccountDialog } from './Account/AccountDialog';
import { Menu } from './ui';

const getInitials = (name?: string | null, email?: string): string => {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
    return name[0]!.toUpperCase();
  }
  return email?.[0]?.toUpperCase() ?? '?';
};

export const UserAvatar = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const globalActions = useGlobalActionsOptional();
  const { currentUser, logout } = useBackendAuth();
  const [accountOpen, setAccountOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    void navigate('/login');
  };

  const initials = getInitials(currentUser?.name, currentUser?.email);

  return (
    <>
      <Menu.Root>
        <Menu.Trigger asChild>
          <Box
            as="button"
            w="22px"
            h="22px"
            borderRadius="full"
            bg="blue.500"
            color="white"
            display="flex"
            alignItems="center"
            justifyContent="center"
            fontSize="10px"
            fontWeight="bold"
            cursor="pointer"
            flexShrink={0}
            _hover={{ bg: 'blue.600' }}
            transition="background 0.15s"
          >
            {initials}
          </Box>
        </Menu.Trigger>
        <Portal>
          <Menu.Positioner>
            <Menu.Content>
              <Box px={3} py={2}>
                {currentUser?.name && (
                  <Text fontSize="sm" fontWeight="semibold" truncate maxW="200px">
                    {currentUser.name}
                  </Text>
                )}
                <Text fontSize="xs" color="fg.muted" truncate maxW="200px">
                  {currentUser?.email}
                </Text>
              </Box>
              <Menu.Separator />
              <Menu.Item value="account" onClick={() => setAccountOpen(true)}>
                <LuUser />
                {t('account.title')}
              </Menu.Item>
              <Menu.Item value="settings" onClick={() => globalActions?.openSettings()}>
                <LuSettings />
                {t('account.settings')}
              </Menu.Item>
              <Menu.Separator />
              <Menu.Item value="logout" onClick={() => { void handleLogout(); }} color="red.400">
                <LuLogOut />
                {t('account.logout')}
              </Menu.Item>
            </Menu.Content>
          </Menu.Positioner>
        </Portal>
      </Menu.Root>

      <AccountDialog isOpen={accountOpen} onClose={() => setAccountOpen(false)} />
    </>
  );
};

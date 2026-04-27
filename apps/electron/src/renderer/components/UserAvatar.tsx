import { useGlobalActionsOptional } from '@/renderer/context/GlobalActionsContext';
import { Box, Portal, Text } from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';
import { LuLogOut, LuSettings, LuUser } from 'react-icons/lu';
import { useNavigate } from 'react-router-dom';
import { useBackendAuth } from '../hooks/useBackendAuth';
import { trpc } from '../utils/trpc';
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

  const avatarQuery = trpc.auth.getAvatar.useQuery(undefined, {
    enabled: !!currentUser?.hasAvatar,
  });
  const avatarSrc = avatarQuery.data ? `data:${avatarQuery.data.mimeType};base64,${avatarQuery.data.data}` : null;

  const handleLogout = async () => {
    await logout();
    void navigate('/login');
  };

  const initials = getInitials(currentUser?.name, currentUser?.email);
  const fallbackBg = currentUser?.avatarColor ?? 'blue.500';

  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <Box
          as="button"
          aria-label={t('account.title')}
          w="22px"
          h="22px"
          borderRadius="full"
          bg={avatarSrc ? 'transparent' : fallbackBg}
          color="white"
          display="flex"
          alignItems="center"
          justifyContent="center"
          fontSize="10px"
          fontWeight="bold"
          cursor="pointer"
          flexShrink={0}
          overflow="hidden"
          _hover={{ opacity: 0.85 }}
          transition="opacity 0.15s"
        >
          {avatarSrc ? (
            <img src={avatarSrc} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            initials
          )}
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
            <Menu.Item value="account" onClick={() => globalActions?.openSettings('account')}>
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
  );
};

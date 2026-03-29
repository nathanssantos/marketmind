import { Box, Flex, HStack, Text, VStack } from '@chakra-ui/react';
import { type FormEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuCheck, LuShieldCheck, LuShieldX } from 'react-icons/lu';
import { Badge, Button, CloseButton, Dialog, Field, Input, Separator, Switch } from '../ui';
import { useBackendAuth } from '../../hooks/useBackendAuth';
import { AUTH_UI } from '../../utils/auth';
import { trpc } from '../../utils/trpc';

interface AccountDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AccountDialog = ({ isOpen, onClose }: AccountDialogProps) => {
  const { t, i18n } = useTranslation();
  const { currentUser, toggleTwoFactor, isTogglingTwoFactor } = useBackendAuth();
  const utils = trpc.useUtils();

  const [name, setName] = useState(currentUser?.name ?? '');
  const [saved, setSaved] = useState(false);

  const updateProfileMutation = trpc.auth.updateProfile.useMutation({
    onSuccess: () => {
      void utils.auth.me.invalidate();
      setSaved(true);
      setTimeout(() => setSaved(false), AUTH_UI.FEEDBACK_TIMEOUT_MS);
    },
  });

  useEffect(() => {
    if (currentUser?.name !== undefined) setName(currentUser.name ?? '');
  }, [currentUser?.name]);

  const handleSave = (e: FormEvent) => {
    e.preventDefault();
    updateProfileMutation.mutate({ name: name.trim() || undefined });
  };

  const handleToggle2FA = async (checked: boolean) => {
    try {
      await toggleTwoFactor(checked);
    } catch {
      // Error handled silently
    }
  };

  const memberSince = currentUser?.createdAt
    ? new Date(currentUser.createdAt).toLocaleDateString(i18n.language, { year: 'numeric', month: 'long', day: 'numeric' })
    : null;

  return (
    <Dialog.Root open={isOpen} onOpenChange={(e) => !e.open && onClose()} size="md">
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content>
          <CloseButton position="absolute" top={4} right={4} onClick={onClose} size="sm" />
          <Dialog.Header borderBottom="1px solid" borderColor="border">
            <Dialog.Title>{t('account.title')}</Dialog.Title>
          </Dialog.Header>

          <Dialog.Body py={6}>
            <VStack gap={6} align="stretch">
              <Box>
                <Text fontSize="sm" fontWeight="semibold" mb={3}>{t('account.profile')}</Text>
                <form onSubmit={handleSave}>
                  <VStack gap={3} align="stretch">
                    <Field label={t('account.name')}>
                      <Input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder={t('account.namePlaceholder')}
                      />
                    </Field>
                    <Field label={t('account.email')}>
                      <HStack width="100%">
                        <Input value={currentUser?.email ?? ''} disabled flex={1} />
                        <Badge colorPalette={currentUser?.emailVerified ? 'green' : 'orange'} size="sm" flexShrink={0} px={2}>
                          {currentUser?.emailVerified ? t('account.emailVerified') : t('account.emailNotVerified')}
                        </Badge>
                      </HStack>
                    </Field>
                    <Flex justify="flex-end">
                      <Button
                        type="submit"
                        size="sm"
                        colorPalette={saved ? 'green' : 'blue'}
                        loading={updateProfileMutation.isPending}
                      >
                        {saved ? <><LuCheck /> {t('account.saved')}</> : t('account.save')}
                      </Button>
                    </Flex>
                  </VStack>
                </form>
              </Box>

              <Separator />

              <Box>
                <Text fontSize="sm" fontWeight="semibold" mb={3}>{t('account.security')}</Text>
                <Flex align="center" justify="space-between" gap={4}>
                  <VStack align="start" gap={0}>
                    <HStack gap={2}>
                      {currentUser?.twoFactorEnabled ? <LuShieldCheck color="var(--chakra-colors-green-500)" /> : <LuShieldX color="var(--chakra-colors-fg-muted)" />}
                      <Text fontSize="sm">{t('account.twoFactor')}</Text>
                    </HStack>
                    <Text fontSize="xs" color="fg.muted">
                      {currentUser?.emailVerified ? t('account.twoFactorDescription') : t('account.twoFactorRequiresEmail')}
                    </Text>
                  </VStack>
                  <Switch
                    checked={currentUser?.twoFactorEnabled ?? false}
                    onCheckedChange={handleToggle2FA}
                    disabled={!currentUser?.emailVerified || isTogglingTwoFactor}
                  />
                </Flex>
              </Box>

              {memberSince && (
                <>
                  <Separator />
                  <Text fontSize="xs" color="fg.muted">
                    {t('account.memberSince')}: {memberSince}
                  </Text>
                </>
              )}
            </VStack>
          </Dialog.Body>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
};

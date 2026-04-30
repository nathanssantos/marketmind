import { Box, Flex, HStack, Stack, Text } from '@chakra-ui/react';
import {
  Badge, Button, Callout, ConfirmationDialog, Field, FormRow, FormSection, MetaText, PasswordInput, PasswordStrengthMeter, Switch,
} from '@renderer/components/ui';
import { validatePassword } from '@marketmind/utils';
import { useBackendAuth } from '@renderer/hooks/useBackendAuth';
import { useToast } from '@renderer/hooks/useToast';
import { trpc } from '@renderer/utils/trpc';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuBot, LuLogOut, LuShieldCheck, LuShieldX } from 'react-icons/lu';
import { AgentActivityPanel } from './AgentActivityPanel';

const formatRelative = (iso: string, locale: string): string =>
  new Date(iso).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });

export const SecurityTab = () => {
  const { t, i18n } = useTranslation();
  const {
    currentUser,
    changePassword,
    isChangingPassword,
    toggleTwoFactor,
    isTogglingTwoFactor,
  } = useBackendAuth();
  const { success: toastSuccess, error: toastError } = useToast();
  const utils = trpc.useUtils();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const sessionsQuery = trpc.auth.listSessions.useQuery();
  const walletsQuery = trpc.wallet.list.useQuery();
  const updateWalletMutation = trpc.wallet.update.useMutation({
    onSuccess: () => utils.wallet.list.invalidate(),
  });
  const [agentTradingPending, setAgentTradingPending] = useState<{ walletId: string; enable: boolean } | null>(null);
  const revokeSession = trpc.auth.revokeSession.useMutation({
    onSuccess: () => utils.auth.listSessions.invalidate(),
  });
  const revokeAllOthers = trpc.auth.revokeAllOtherSessions.useMutation({
    onSuccess: () => utils.auth.listSessions.invalidate(),
  });

  const passwordsMatch = newPassword === confirmPassword;
  const policyValid = newPassword.length === 0 || validatePassword(newPassword).valid;
  const policyInvalid = newPassword.length > 0 && !policyValid;
  const canSubmit =
    currentPassword.length > 0 &&
    policyValid &&
    newPassword.length > 0 &&
    passwordsMatch &&
    !isChangingPassword;

  const handleSubmitPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toastSuccess(t('settings.security.password.changeSuccess'));
      void utils.auth.listSessions.invalidate();
    } catch (err) {
      toastError(t('settings.security.password.changeFailed'), err instanceof Error ? err.message : undefined);
    }
  };

  const handleToggleTwoFactor = async (enabled: boolean) => {
    try {
      await toggleTwoFactor(enabled);
      toastSuccess(enabled ? t('settings.security.twoFactor.enabled') : t('settings.security.twoFactor.disabled'));
    } catch (err) {
      toastError(t('settings.security.twoFactor.toggleFailed'), err instanceof Error ? err.message : undefined);
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    try {
      await revokeSession.mutateAsync({ sessionId });
      toastSuccess(t('settings.security.sessions.revokeSuccess'));
    } catch (err) {
      toastError(t('settings.security.sessions.revokeFailed'), err instanceof Error ? err.message : undefined);
    }
  };

  const handleRevokeAllOthers = async () => {
    try {
      await revokeAllOthers.mutateAsync();
      toastSuccess(t('settings.security.sessions.revokeAllSuccess'));
    } catch (err) {
      toastError(t('settings.security.sessions.revokeFailed'), err instanceof Error ? err.message : undefined);
    }
  };

  return (
    <Stack gap={5}>
      <FormSection
        title={t('settings.security.password.title')}
        description={t('settings.security.password.description')}
      >
        <form onSubmit={(e) => { void handleSubmitPassword(e); }}>
          <Stack gap={2.5} maxW="380px">
            <Field label={t('settings.security.password.current')}>
              <PasswordInput
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                size="sm"
                data-testid="security-current-password"
              />
            </Field>
            <Field
              label={t('settings.security.password.new')}
              invalid={policyInvalid}
            >
              <PasswordInput
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                size="sm"
                data-testid="security-new-password"
              />
              <PasswordStrengthMeter password={newPassword} />
            </Field>
            <Field
              label={t('settings.security.password.confirm')}
              invalid={confirmPassword.length > 0 && !passwordsMatch}
              errorText={confirmPassword.length > 0 && !passwordsMatch ? t('settings.security.password.mismatch') : undefined}
            >
              <PasswordInput
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                size="sm"
                data-testid="security-confirm-password"
              />
            </Field>
            <Box>
              <Button
                type="submit"
                size="sm"
                disabled={!canSubmit}
                loading={isChangingPassword}
                data-testid="security-change-password-submit"
              >
                {t('settings.security.password.submit')}
              </Button>
            </Box>
          </Stack>
        </form>
      </FormSection>

      <FormSection
        title={t('settings.security.twoFactor.title')}
        description={t('settings.security.twoFactor.description')}
      >
        <FormRow
          label={
            <HStack gap={1.5} align="center">
              <Box color={currentUser?.twoFactorEnabled ? 'trading.profit' : 'fg.muted'} display="inline-flex">
                {currentUser?.twoFactorEnabled ? <LuShieldCheck /> : <LuShieldX />}
              </Box>
              <span>
                {currentUser?.twoFactorEnabled
                  ? t('settings.security.twoFactor.activeLabel')
                  : t('settings.security.twoFactor.inactiveLabel')}
              </span>
            </HStack>
          }
          helper={!currentUser?.emailVerified ? t('settings.security.twoFactor.requiresVerifiedEmail') : undefined}
        >
          <Switch
            checked={currentUser?.twoFactorEnabled ?? false}
            onCheckedChange={(checked) => { void handleToggleTwoFactor(checked); }}
            disabled={!currentUser?.emailVerified || isTogglingTwoFactor}
            aria-label={t('settings.security.twoFactor.title')}
            data-testid="security-2fa-toggle"
          />
        </FormRow>
      </FormSection>

      <FormSection
        title={t('settings.security.sessions.title')}
        description={t('settings.security.sessions.description')}
        action={
          (sessionsQuery.data?.length ?? 0) > 1 ? (
            <Button
              size="xs"
              variant="outline"
              colorPalette="red"
              onClick={() => { void handleRevokeAllOthers(); }}
              loading={revokeAllOthers.isPending}
              data-testid="security-revoke-all-others"
            >
              <LuLogOut />
              {t('settings.security.sessions.revokeAll')}
            </Button>
          ) : null
        }
      >
        {sessionsQuery.isLoading ? (
          <MetaText>{t('common.loading')}</MetaText>
        ) : (sessionsQuery.data?.length ?? 0) === 0 ? (
          <MetaText>{t('settings.security.sessions.empty')}</MetaText>
        ) : (
          <Stack gap={1.5}>
            {sessionsQuery.data!.map((s) => (
              <Flex
                key={s.id}
                px={2.5}
                py={2}
                borderWidth="1px"
                borderColor="border"
                borderRadius="md"
                align="flex-start"
                justify="space-between"
                gap={3}
                data-testid={`security-session-${s.id}`}
              >
                <Box flex={1} minW={0}>
                  <Flex gap={2} mb={0.5} align="flex-start" wrap="wrap">
                    <Text fontSize="xs" fontWeight="medium" wordBreak="break-all" lineHeight="short">
                      {s.userAgent ?? t('settings.security.sessions.unknownAgent')}
                    </Text>
                    {s.isCurrent && (
                      <Badge colorPalette="green" size="sm" px={1.5} flexShrink={0}>
                        {t('settings.security.sessions.current')}
                      </Badge>
                    )}
                  </Flex>
                  <Text fontSize="2xs" color="fg.muted">
                    {s.ip ?? t('settings.security.sessions.unknownIp')} · {t('settings.security.sessions.createdAt', { date: formatRelative(s.createdAt, i18n.language) })}
                  </Text>
                </Box>
                {!s.isCurrent && (
                  <Button
                    size="xs"
                    variant="outline"
                    colorPalette="red"
                    onClick={() => { void handleRevokeSession(s.id); }}
                    loading={revokeSession.isPending}
                    data-testid={`security-session-revoke-${s.id}`}
                  >
                    {t('settings.security.sessions.revoke')}
                  </Button>
                )}
              </Flex>
            ))}
          </Stack>
        )}
      </FormSection>

      <FormSection
        title={t('settings.security.agentTrading.title')}
        description={t('settings.security.agentTrading.description')}
      >
        <Callout tone="warning" compact>
          {t('settings.security.agentTrading.warning')}
        </Callout>
        {walletsQuery.isLoading ? (
          <Text fontSize="xs" color="fg.muted">{t('common.loading')}</Text>
        ) : (walletsQuery.data ?? []).length === 0 ? (
          <Text fontSize="xs" color="fg.muted">{t('settings.security.agentTrading.noWallets')}</Text>
        ) : (
          <Stack gap={1.5}>
            {(walletsQuery.data ?? []).map((wallet) => (
              <FormRow
                key={wallet.id}
                label={
                  <HStack gap={2}>
                    <Box color="fg.muted"><LuBot size={14} /></Box>
                    <Text fontSize="sm">{wallet.name}</Text>
                    <Badge size="sm" colorPalette={wallet.walletType === 'paper' ? 'gray' : 'orange'}>
                      {wallet.walletType ?? 'paper'}
                    </Badge>
                  </HStack>
                }
                helper={t('settings.security.agentTrading.perWalletHelper')}
              >
                <Switch
                  checked={!!wallet.agentTradingEnabled}
                  disabled={updateWalletMutation.isPending}
                  onCheckedChange={(enable) => {
                    if (enable) {
                      setAgentTradingPending({ walletId: wallet.id, enable: true });
                    } else {
                      void updateWalletMutation.mutateAsync({ id: wallet.id, agentTradingEnabled: false })
                        .then(() => toastSuccess(t('settings.security.agentTrading.disabled', { name: wallet.name })))
                        .catch((err) => toastError(t('settings.security.agentTrading.toggleFailed'), err instanceof Error ? err.message : undefined));
                    }
                  }}
                  data-testid={`agent-trading-toggle-${wallet.id}`}
                />
              </FormRow>
            ))}
          </Stack>
        )}
      </FormSection>

      <AgentActivityPanel />

      <ConfirmationDialog
        isOpen={agentTradingPending !== null}
        onClose={() => setAgentTradingPending(null)}
        onConfirm={() => {
          if (!agentTradingPending) return;
          void (async () => {
            try {
              await updateWalletMutation.mutateAsync({
                id: agentTradingPending.walletId,
                agentTradingEnabled: agentTradingPending.enable,
              });
              const wallet = (walletsQuery.data ?? []).find((w) => w.id === agentTradingPending.walletId);
              toastSuccess(t('settings.security.agentTrading.enabled', { name: wallet?.name ?? '' }));
            } catch (err) {
              toastError(t('settings.security.agentTrading.toggleFailed'), err instanceof Error ? err.message : undefined);
            } finally {
              setAgentTradingPending(null);
            }
          })();
        }}
        title={t('settings.security.agentTrading.confirmTitle')}
        description={t('settings.security.agentTrading.confirmBody')}
        confirmLabel={t('settings.security.agentTrading.confirmCta')}
        colorPalette="orange"
        isDestructive
        isLoading={updateWalletMutation.isPending}
      />

      {currentUser?.createdAt && (
        <MetaText>
          {t('settings.account.memberSince')}:{' '}
          {new Date(currentUser.createdAt).toLocaleDateString(i18n.language, { year: 'numeric', month: 'long', day: 'numeric' })}
        </MetaText>
      )}
    </Stack>
  );
};

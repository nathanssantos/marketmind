import { Box, Flex, HStack, Stack, Text } from '@chakra-ui/react';
import { Badge, Button, Field, FormSection, Input, MetaText } from '@renderer/components/ui';
import { useBackendAuth } from '@renderer/hooks/useBackendAuth';
import { useToast } from '@renderer/hooks/useToast';
import { trpc } from '@renderer/utils/trpc';
import { type ChangeEvent, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuCheck, LuTrash2, LuUpload } from 'react-icons/lu';
import { AVATAR_COLOR_PALETTE } from './constants';

const AVATAR_MAX_BYTES = 500_000;
const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const FEEDBACK_MS = 2000;

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Unexpected reader result'));
        return;
      }
      const commaIndex = result.indexOf(',');
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
    };
    reader.readAsDataURL(file);
  });

export const AccountTab = () => {
  const { t, i18n } = useTranslation();
  const {
    currentUser,
    updateProfile,
    isUpdatingProfile,
    uploadAvatar,
    isUploadingAvatar,
    deleteAvatar,
    isDeletingAvatar,
    resendVerificationEmail,
    isResendingVerification,
  } = useBackendAuth();
  const { success: toastSuccess, error: toastError, info: toastInfo } = useToast();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(currentUser?.name ?? '');
  const [savedName, setSavedName] = useState(false);
  const [avatarColor, setAvatarColor] = useState<string | null>(currentUser?.avatarColor ?? null);

  const avatarQuery = trpc.auth.getAvatar.useQuery(undefined, {
    enabled: !!currentUser?.hasAvatar,
  });

  useEffect(() => {
    if (currentUser?.name !== undefined) setName(currentUser.name ?? '');
  }, [currentUser?.name]);
  useEffect(() => {
    setAvatarColor(currentUser?.avatarColor ?? null);
  }, [currentUser?.avatarColor]);

  const handleSaveName = async () => {
    try {
      await updateProfile({ name: name.trim() });
      setSavedName(true);
      setTimeout(() => setSavedName(false), FEEDBACK_MS);
    } catch (err) {
      toastError(t('settings.account.errors.saveFailed'), err instanceof Error ? err.message : undefined);
    }
  };

  const handleColorPick = async (color: string | null) => {
    setAvatarColor(color);
    try {
      await updateProfile({ avatarColor: color });
    } catch (err) {
      toastError(t('settings.account.errors.saveFailed'), err instanceof Error ? err.message : undefined);
    }
  };

  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      toastError(t('settings.account.errors.invalidFileType'));
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      toastError(t('settings.account.errors.fileTooLarge', { maxKb: Math.round(AVATAR_MAX_BYTES / 1024) }));
      return;
    }
    try {
      const base64 = await fileToBase64(file);
      await uploadAvatar(base64, file.type);
      await avatarQuery.refetch();
      toastSuccess(t('settings.account.avatar.uploadSuccess'));
    } catch (err) {
      toastError(t('settings.account.errors.uploadFailed'), err instanceof Error ? err.message : undefined);
    }
  };

  const handleDeleteAvatar = async () => {
    try {
      await deleteAvatar();
      await avatarQuery.refetch();
      toastSuccess(t('settings.account.avatar.deleteSuccess'));
    } catch (err) {
      toastError(t('settings.account.errors.deleteFailed'), err instanceof Error ? err.message : undefined);
    }
  };

  const handleResendVerification = async () => {
    try {
      await resendVerificationEmail();
      toastInfo(t('settings.account.email.verificationSent'));
    } catch (err) {
      toastError(t('settings.account.errors.resendFailed'), err instanceof Error ? err.message : undefined);
    }
  };

  const memberSince = currentUser?.createdAt
    ? new Date(currentUser.createdAt).toLocaleDateString(i18n.language, { year: 'numeric', month: 'long', day: 'numeric' })
    : null;

  const trimmedName = currentUser?.name?.trim();
  const initialsSource = (trimmedName && trimmedName.length > 0)
    ? trimmedName
    : (currentUser?.email ?? '?');
  const initials = initialsSource
    .split(/\s+/).slice(0, 2).map((p) => p[0] ?? '').join('').toUpperCase();
  const avatarSrc = avatarQuery.data ? `data:${avatarQuery.data.mimeType};base64,${avatarQuery.data.data}` : null;

  return (
    <Stack gap={5}>
      <FormSection
        title={t('settings.account.profile.title')}
        description={t('settings.account.profile.description')}
      >
        <Flex gap={4} align="center" flexWrap="wrap">
          <Box
            w="64px"
            h="64px"
            borderRadius="full"
            bg={avatarColor ?? 'accent.solid'}
            color="white"
            display="flex"
            alignItems="center"
            justifyContent="center"
            fontSize="xl"
            fontWeight="bold"
            overflow="hidden"
            flexShrink={0}
            data-testid="account-avatar-preview"
          >
            {avatarSrc ? (
              <img src={avatarSrc} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              initials
            )}
          </Box>
          <Stack gap={1.5} flex={1} minW="200px">
            <HStack gap={2}>
              <Button
                size="xs"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                loading={isUploadingAvatar}
                data-testid="account-avatar-upload-button"
              >
                <LuUpload />
                {t('settings.account.avatar.upload')}
              </Button>
              {currentUser?.hasAvatar && (
                <Button
                  size="xs"
                  variant="outline"
                  colorPalette="red"
                  onClick={() => { void handleDeleteAvatar(); }}
                  loading={isDeletingAvatar}
                  data-testid="account-avatar-delete-button"
                >
                  <LuTrash2 />
                  {t('common.delete')}
                </Button>
              )}
            </HStack>
            <Text fontSize="2xs" color="fg.muted">
              {t('settings.account.avatar.helper', { maxKb: Math.round(AVATAR_MAX_BYTES / 1024) })}
            </Text>
            <input
              ref={fileInputRef}
              type="file"
              accept={ALLOWED_MIME_TYPES.join(',')}
              onChange={(e) => { void handleFileSelect(e); }}
              style={{ display: 'none' }}
              data-testid="account-avatar-file-input"
            />
          </Stack>
        </Flex>

        {!currentUser?.hasAvatar && (
          <Box>
            <Text fontSize="2xs" color="fg.muted" mb={1.5}>
              {t('settings.account.avatar.colorLabel')}
            </Text>
            <HStack gap={1.5} flexWrap="wrap">
              {AVATAR_COLOR_PALETTE.map((color) => (
                <button
                  key={color}
                  type="button"
                  data-testid={`avatar-color-${color}`}
                  aria-label={color}
                  onClick={() => { void handleColorPick(color); }}
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '9999px',
                    background: color,
                    borderWidth: '2px',
                    borderStyle: 'solid',
                    borderColor: avatarColor === color ? 'currentColor' : 'transparent',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                />
              ))}
            </HStack>
          </Box>
        )}

        <Field label={t('settings.account.profile.name')}>
          <HStack gap={2}>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('settings.account.profile.namePlaceholder')}
              maxLength={255}
              size="sm"
              flex={1}
              data-testid="account-name-input"
            />
            <Button
              size="sm"
              onClick={() => { void handleSaveName(); }}
              loading={isUpdatingProfile}
              colorPalette={savedName ? 'green' : 'blue'}
              data-testid="account-name-save-button"
            >
              {savedName ? <><LuCheck /> {t('settings.account.saved')}</> : t('common.save')}
            </Button>
          </HStack>
        </Field>
      </FormSection>

      <FormSection
        title={t('settings.account.email.title')}
        description={t('settings.account.email.description')}
      >
        <Field label={t('settings.account.email.label')}>
          <HStack>
            <Input value={currentUser?.email ?? ''} disabled flex={1} size="xs" />
            <Badge
              colorPalette={currentUser?.emailVerified ? 'green' : 'orange'}
              size="sm"
              flexShrink={0}
              px={2}
            >
              {currentUser?.emailVerified
                ? t('settings.account.email.verified')
                : t('settings.account.email.notVerified')}
            </Badge>
          </HStack>
        </Field>
        {!currentUser?.emailVerified && (
          <Box>
            <Button
              size="xs"
              variant="outline"
              onClick={() => { void handleResendVerification(); }}
              loading={isResendingVerification}
              data-testid="account-resend-verification-button"
            >
              {t('settings.account.email.resend')}
            </Button>
          </Box>
        )}
      </FormSection>

      {memberSince && (
        <MetaText>
          {t('settings.account.memberSince')}: {memberSince}
        </MetaText>
      )}
    </Stack>
  );
};

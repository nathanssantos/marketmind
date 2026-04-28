import { Badge, Button, EmptyState, FormSection, IconButton } from '@renderer/components/ui';
import { Box, Flex, Grid, Portal, Stack, Text } from '@chakra-ui/react';
import { MenuContent, MenuItem, MenuPositioner, MenuRoot, MenuTrigger } from '@chakra-ui/react/menu';
import type { TradingProfile } from '@marketmind/types';
import { useTradingProfiles } from '@renderer/hooks/useTradingProfiles';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BsThreeDotsVertical } from 'react-icons/bs';
import { LuCopy, LuPencil, LuPlus, LuStar, LuTrash2, LuUpload } from 'react-icons/lu';
import { ImportProfileDialog } from './ImportProfileDialog';
import { ProfileEditorDialog } from './ProfileEditorDialog';

export const TradingProfilesManager = () => {
  const { t } = useTranslation();
  const {
    profiles,
    isLoadingProfiles,
    deleteProfile,
    duplicateProfile,
    isDeletingProfile,
  } = useTradingProfiles();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [editingProfile, setEditingProfile] = useState<TradingProfile | null>(null);

  const handleDuplicate = async (profile: TradingProfile) => {
    const newName = `${profile.name} (${t('common.copy')})`;
    await duplicateProfile(profile.id, newName);
  };

  return (
    <Stack gap={4}>
      <FormSection
        title={
          <Flex align="center" gap={2}>
            <Text as="span">{t('tradingProfiles.title')}</Text>
            {profiles.length > 0 && (
              <Badge size="sm" colorPalette="blue">
                {profiles.length}
              </Badge>
            )}
          </Flex>
        }
        description={t('tradingProfiles.description')}
        action={
          <Flex gap={2}>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowImportDialog(true)}
              data-testid="trigger-import-profile"
            >
              <LuUpload />
              {t('tradingProfiles.import.openImport')}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowCreateDialog(true)}
              data-testid="trigger-create-profile"
            >
              <LuPlus />
              {t('tradingProfiles.create')}
            </Button>
          </Flex>
        }
      />

      {isLoadingProfiles ? (
        <EmptyState size="sm" title={t('common.loading')} />
      ) : profiles.length === 0 ? (
        <EmptyState
          dashed
          title={t('tradingProfiles.empty')}
          action={{ label: t('tradingProfiles.createFirst'), onClick: () => setShowCreateDialog(true) }}
        />
      ) : (
        <Grid templateColumns="repeat(auto-fill, minmax(300px, 1fr))" gap={4}>
          {profiles.map((profile) => (
            <ProfileCard
              key={profile.id}
              profile={profile}
              onEdit={() => setEditingProfile(profile)}
              onDelete={() => { void deleteProfile(profile.id); }}
              onDuplicate={() => { void handleDuplicate(profile); }}
              isDeleting={isDeletingProfile}
            />
          ))}
        </Grid>
      )}

      <ProfileEditorDialog
        isOpen={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        profile={null}
      />

      <ProfileEditorDialog
        isOpen={editingProfile !== null}
        onClose={() => setEditingProfile(null)}
        profile={editingProfile}
      />

      <ImportProfileDialog
        isOpen={showImportDialog}
        onClose={() => setShowImportDialog(false)}
      />
    </Stack>
  );
};

interface ProfileCardProps {
  profile: TradingProfile;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  isDeleting?: boolean;
}

const ProfileCard = ({ profile, onEdit, onDelete, onDuplicate, isDeleting = false }: ProfileCardProps) => {
  const { t } = useTranslation();

  return (
    <Box
      p={4}
      bg="bg.muted"
      borderRadius="md"
      borderLeftWidth="3px"
      borderLeftColor={profile.isDefault ? 'yellow.muted' : 'blue.muted'}
      position="relative"
    >
      <Flex justify="space-between" align="flex-start" mb={3}>
        <Flex align="center" gap={2}>
          {profile.isDefault && (
            <Box color="yellow.fg" aria-label={t('tradingProfiles.defaultMarker')}>
              <LuStar size={14} />
            </Box>
          )}
          <Text fontWeight="bold" fontSize="md">
            {profile.name}
          </Text>
        </Flex>
        <MenuRoot id={`profile-menu-${profile.id}`} positioning={{ placement: 'bottom-end' }}>
          <MenuTrigger asChild>
            <IconButton
              size="2xs"
              variant="ghost"
              aria-label="Profile options"
              onClick={(e) => e.stopPropagation()}
              disabled={isDeleting}
            >
              <BsThreeDotsVertical />
            </IconButton>
          </MenuTrigger>
          <Portal>
            <MenuPositioner>
              <MenuContent
                bg="bg.panel"
                borderColor="border"
                shadow="lg"
                minW="180px"
                zIndex={99999}
                p={0}
              >
                <MenuItem
                  value="edit"
                  onClick={onEdit}
                  px={4}
                  py={2.5}
                  _hover={{ bg: 'bg.muted' }}
                >
                  <LuPencil />
                  <Text>{t('common.edit')}</Text>
                </MenuItem>
                <MenuItem
                  value="duplicate"
                  onClick={onDuplicate}
                  px={4}
                  py={2.5}
                  _hover={{ bg: 'bg.muted' }}
                >
                  <LuCopy />
                  <Text>{t('common.duplicate')}</Text>
                </MenuItem>
                <MenuItem
                  value="delete"
                  onClick={onDelete}
                  color="red.fg"
                  px={4}
                  py={2.5}
                  _hover={{ bg: 'bg.muted' }}
                  disabled={isDeleting}
                >
                  <LuTrash2 />
                  <Text>{t('common.delete')}</Text>
                </MenuItem>
              </MenuContent>
            </MenuPositioner>
          </Portal>
        </MenuRoot>
      </Flex>

      {profile.description && (
        <Text fontSize="sm" color="fg.muted" mb={3}>
          {profile.description}
        </Text>
      )}

      <Stack gap={2} fontSize="xs">
        <Box>
          <Text color="fg.muted" mb={1}>
            {t('tradingProfiles.enabledSetups')}:
          </Text>
          <Flex flexWrap="wrap" gap={1}>
            {profile.enabledSetupTypes.slice(0, 4).map((setup) => (
              <Badge key={setup} size="sm" colorPalette="blue" variant="subtle">
                {t(`tradingProfiles.setups.${setup}`, setup)}
              </Badge>
            ))}
            {profile.enabledSetupTypes.length > 4 && (
              <Badge size="sm" colorPalette="gray" variant="subtle">
                +{profile.enabledSetupTypes.length - 4}
              </Badge>
            )}
          </Flex>
        </Box>

        {(profile.maxPositionSize ?? profile.maxConcurrentPositions) && (
          <Flex gap={4} mt={1}>
            {profile.maxPositionSize && (
              <Text color="fg.muted">
                {t('tradingProfiles.maxPosition')}: {profile.maxPositionSize}%
              </Text>
            )}
            {profile.maxConcurrentPositions && (
              <Text color="fg.muted">
                {t('tradingProfiles.maxConcurrent')}: {profile.maxConcurrentPositions}
              </Text>
            )}
          </Flex>
        )}
      </Stack>
    </Box>
  );
};

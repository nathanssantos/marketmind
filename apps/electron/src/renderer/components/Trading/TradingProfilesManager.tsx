import { Badge, Button, IconButton } from '@renderer/components/ui';
import { Box, Flex, Grid, Heading, Portal, Stack, Text } from '@chakra-ui/react';
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
      <Flex justify="space-between" align="flex-start" gap={4}>
        <Box>
          <Flex align="center" gap={2}>
            <Heading size="md">{t('tradingProfiles.title')}</Heading>
            {profiles.length > 0 && (
              <Badge size="sm" colorPalette="blue">
                {profiles.length}
              </Badge>
            )}
          </Flex>
          <Text fontSize="sm" color="fg.muted">
            {t('tradingProfiles.description')}
          </Text>
        </Box>
        <Flex gap={2}>
          <Button size="sm" variant="outline" onClick={() => setShowImportDialog(true)}>
            <LuUpload />
            {t('tradingProfiles.import.openImport')}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowCreateDialog(true)}>
            <LuPlus />
            {t('tradingProfiles.create')}
          </Button>
        </Flex>
      </Flex>

      {isLoadingProfiles ? (
        <Box p={4} textAlign="center">
          <Text fontSize="sm" color="fg.muted">
            {t('common.loading')}
          </Text>
        </Box>
      ) : profiles.length === 0 ? (
        <Box
          p={6}
          textAlign="center"
          borderWidth="1px"
          borderStyle="dashed"
          borderRadius="lg"
          borderColor="border"
        >
          <Text fontSize="sm" color="fg.muted" mb={2}>
            {t('tradingProfiles.empty')}
          </Text>
          <Button size="sm" variant="outline" onClick={() => setShowCreateDialog(true)}>
            <LuPlus />
            {t('tradingProfiles.createFirst')}
          </Button>
        </Box>
      ) : (
        <Grid templateColumns="repeat(auto-fill, minmax(300px, 1fr))" gap={4}>
          {profiles.map((profile) => (
            <ProfileCard
              key={profile.id}
              profile={profile}
              onEdit={() => setEditingProfile(profile)}
              onDelete={() => deleteProfile(profile.id)}
              onDuplicate={() => handleDuplicate(profile)}
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
      borderLeft="4px solid"
      borderColor={profile.isDefault ? 'yellow.500' : 'blue.500'}
      position="relative"
    >
      <Flex justify="space-between" align="flex-start" mb={3}>
        <Flex align="center" gap={2}>
          {profile.isDefault && (
            <Box color="yellow.500">
              <LuStar size={16} />
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
                  color="red.500"
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

        {(profile.maxPositionSize || profile.maxConcurrentPositions) && (
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

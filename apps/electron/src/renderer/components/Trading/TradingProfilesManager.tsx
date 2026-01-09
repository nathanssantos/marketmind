import { Box, Collapsible, Flex, Grid, IconButton, Portal, Stack, Text } from '@chakra-ui/react';
import { MenuContent, MenuItem, MenuPositioner, MenuRoot, MenuTrigger } from '@chakra-ui/react/menu';
import type { TradingProfile } from '@marketmind/types';
import { Button } from '@renderer/components/ui/button';
import { useTradingProfiles } from '@renderer/hooks/useTradingProfiles';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BsThreeDotsVertical } from 'react-icons/bs';
import { LuChevronDown, LuChevronUp, LuCopy, LuPencil, LuPlus, LuStar, LuTrash2 } from 'react-icons/lu';
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
  const [editingProfile, setEditingProfile] = useState<TradingProfile | null>(null);
  const [profilesExpanded, setProfilesExpanded] = useState(false);

  const handleDuplicate = async (profile: TradingProfile) => {
    const newName = `${profile.name} (${t('common.copy')})`;
    await duplicateProfile(profile.id, newName);
  };

  return (
    <Box>
      <Flex
        justify="space-between"
        align="center"
        cursor="pointer"
        onClick={() => setProfilesExpanded(!profilesExpanded)}
        _hover={{ bg: 'bg.muted' }}
        p={2}
        mx={-2}
        borderRadius="md"
      >
        <Box>
          <Flex align="center" gap={2}>
            <Text fontSize="lg" fontWeight="bold">
              {t('tradingProfiles.title')}
            </Text>
            {profiles.length > 0 && (
              <Box
                px={2}
                py={0.5}
                bg="blue.100"
                color="blue.800"
                borderRadius="full"
                fontSize="xs"
                fontWeight="medium"
                _dark={{ bg: 'blue.900', color: 'blue.200' }}
              >
                {profiles.length}
              </Box>
            )}
          </Flex>
          <Text fontSize="sm" color="fg.muted">
            {t('tradingProfiles.description')}
          </Text>
        </Box>
        {profilesExpanded ? <LuChevronUp size={20} /> : <LuChevronDown size={20} />}
      </Flex>

      <Collapsible.Root open={profilesExpanded}>
        <Collapsible.Content>
          <Stack gap={4} mt={4}>
            <Flex justify="flex-end">
              <Button
                size="sm"
                colorPalette="blue"
                onClick={() => setShowCreateDialog(true)}
              >
                <LuPlus />
                {t('tradingProfiles.create')}
              </Button>
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
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowCreateDialog(true)}
                >
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
          </Stack>
        </Collapsible.Content>
      </Collapsible.Root>

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
    </Box>
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
              <Box
                key={setup}
                px={2}
                py={0.5}
                bg="blue.100"
                color="blue.800"
                borderRadius="sm"
                fontSize="2xs"
                _dark={{ bg: 'blue.900', color: 'blue.200' }}
              >
                {t(`tradingProfiles.setups.${setup}`, setup)}
              </Box>
            ))}
            {profile.enabledSetupTypes.length > 4 && (
              <Box
                px={2}
                py={0.5}
                bg="gray.100"
                color="gray.600"
                borderRadius="sm"
                fontSize="2xs"
                _dark={{ bg: 'gray.800', color: 'gray.300' }}
              >
                +{profile.enabledSetupTypes.length - 4}
              </Box>
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

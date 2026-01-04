import {
  Box,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
  Flex,
  Grid,
  HStack,
  Input,
  Separator,
  Spinner,
  Stack,
  Text,
  Textarea,
} from '@chakra-ui/react';
import type { CreateTradingProfileInput, TradingProfile, UpdateTradingProfileInput } from '@marketmind/types';
import { Button } from '@renderer/components/ui/button';
import { Checkbox } from '@renderer/components/ui/checkbox';
import { Field } from '@renderer/components/ui/field';
import { NumberInput } from '@renderer/components/ui/number-input';
import { Switch } from '@renderer/components/ui/switch';
import { useAvailableSetups } from '@renderer/hooks/useProfileEditor';
import { useTradingProfiles } from '@renderer/hooks/useTradingProfiles';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface ProfileEditorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  profile: TradingProfile | null;
}

export const ProfileEditorDialog = ({ isOpen, onClose, profile }: ProfileEditorDialogProps) => {
  const { t } = useTranslation();
  const { createProfile, updateProfile, isCreatingProfile, isUpdatingProfile } = useTradingProfiles();
  const { setups: availableSetups, groups: setupGroups, isLoading: isLoadingSetups } = useAvailableSetups();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [enabledSetupTypes, setEnabledSetupTypes] = useState<string[]>([]);
  const [maxPositionSize, setMaxPositionSize] = useState<number | undefined>(undefined);
  const [maxConcurrentPositions, setMaxConcurrentPositions] = useState<number | undefined>(undefined);
  const [isDefault, setIsDefault] = useState(false);
  const [overridePositionSize, setOverridePositionSize] = useState(false);
  const [overrideConcurrentPositions, setOverrideConcurrentPositions] = useState(false);

  const isEditing = profile !== null;

  useEffect(() => {
    if (profile) {
      setName(profile.name);
      setDescription(profile.description ?? '');
      setEnabledSetupTypes(profile.enabledSetupTypes);
      setMaxPositionSize(profile.maxPositionSize ?? undefined);
      setMaxConcurrentPositions(profile.maxConcurrentPositions ?? undefined);
      setIsDefault(profile.isDefault);
      setOverridePositionSize(profile.maxPositionSize !== null && profile.maxPositionSize !== undefined);
      setOverrideConcurrentPositions(profile.maxConcurrentPositions !== null && profile.maxConcurrentPositions !== undefined);
    } else {
      setName('');
      setDescription('');
      setEnabledSetupTypes([]);
      setMaxPositionSize(undefined);
      setMaxConcurrentPositions(undefined);
      setIsDefault(false);
      setOverridePositionSize(false);
      setOverrideConcurrentPositions(false);
    }
  }, [profile, isOpen]);

  const handleToggleSetup = (setupId: string) => {
    setEnabledSetupTypes((prev) =>
      prev.includes(setupId) ? prev.filter((id) => id !== setupId) : [...prev, setupId]
    );
  };

  const handleToggleGroup = (groupId: string) => {
    const groupSetups = availableSetups.filter((s) => s.group === groupId).map((s) => s.id);
    const allEnabled = groupSetups.every((id) => enabledSetupTypes.includes(id));

    if (allEnabled) {
      setEnabledSetupTypes((prev) => prev.filter((id) => !groupSetups.includes(id)));
    } else {
      setEnabledSetupTypes((prev) => [...new Set([...prev, ...groupSetups])]);
    }
  };

  const handleSubmit = async () => {
    if (!name.trim() || enabledSetupTypes.length === 0) return;

    if (isEditing && profile) {
      const data: UpdateTradingProfileInput = {
        name: name.trim(),
        description: description.trim() || undefined,
        enabledSetupTypes,
        maxPositionSize: overridePositionSize ? maxPositionSize : undefined,
        maxConcurrentPositions: overrideConcurrentPositions ? maxConcurrentPositions : undefined,
        isDefault,
      };
      await updateProfile(profile.id, data);
    } else {
      const data: CreateTradingProfileInput = {
        name: name.trim(),
        description: description.trim() || undefined,
        enabledSetupTypes,
        maxPositionSize: overridePositionSize ? maxPositionSize : undefined,
        maxConcurrentPositions: overrideConcurrentPositions ? maxConcurrentPositions : undefined,
        isDefault,
      };
      await createProfile(data);
    }

    onClose();
  };

  const isSubmitting = isCreatingProfile || isUpdatingProfile;
  const canSubmit = name.trim().length > 0 && enabledSetupTypes.length > 0 && !isSubmitting;

  return (
    <DialogRoot open={isOpen} onOpenChange={(e) => !e.open && onClose()} size="lg">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? t('tradingProfiles.editProfile') : t('tradingProfiles.createProfile')}
          </DialogTitle>
        </DialogHeader>

        <DialogBody>
          <Stack gap={6}>
            <Field label={t('tradingProfiles.fields.name')} required>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('tradingProfiles.placeholders.name')}
                maxLength={100}
              />
            </Field>

            <Field label={t('tradingProfiles.fields.description')}>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('tradingProfiles.placeholders.description')}
                maxLength={500}
                rows={2}
              />
            </Field>

            <Separator />

            <Box>
              <Flex justify="space-between" align="center" mb={4}>
                <Text fontSize="md" fontWeight="semibold">
                  {t('tradingProfiles.fields.enabledSetups')}
                </Text>
                <Text fontSize="sm" color="fg.muted">
                  {enabledSetupTypes.length} / {availableSetups.length}
                </Text>
              </Flex>

              {isLoadingSetups ? (
                <Flex justify="center" py={8}>
                  <Spinner size="md" />
                </Flex>
              ) : (
              <Stack gap={4}>
                {setupGroups.map((group) => {
                  const groupSetups = availableSetups.filter((s) => s.group === group.id);
                  const enabledInGroup = groupSetups.filter((s) => enabledSetupTypes.includes(s.id)).length;
                  const allEnabled = enabledInGroup === groupSetups.length;

                  return (
                    <Box key={group.id}>
                      <HStack justify="space-between" mb={2}>
                        <Text fontSize="sm" fontWeight="semibold" color="fg.muted">
                          {group.name}
                        </Text>
                        <Button
                          size="2xs"
                          variant="ghost"
                          onClick={() => handleToggleGroup(group.id)}
                        >
                          {allEnabled ? t('common.deselectAll') : t('common.selectAll')}
                        </Button>
                      </HStack>
                      <Grid templateColumns="repeat(auto-fill, minmax(200px, 1fr))" gap={2}>
                        {groupSetups.map((setup) => (
                          <HStack
                            key={setup.id}
                            p={2}
                            borderRadius="md"
                            bg="bg.subtle"
                            _hover={{ bg: 'bg.muted' }}
                            cursor="pointer"
                            onClick={() => handleToggleSetup(setup.id)}
                          >
                            <Checkbox
                              checked={enabledSetupTypes.includes(setup.id)}
                              onCheckedChange={() => handleToggleSetup(setup.id)}
                            />
                            <Text fontSize="sm">
                              {t(`tradingProfiles.setups.${setup.id}`, setup.id)}
                            </Text>
                          </HStack>
                        ))}
                      </Grid>
                    </Box>
                  );
                })}
              </Stack>
              )}
            </Box>

            <Separator />

            <Box>
              <Text fontSize="md" fontWeight="semibold" mb={4}>
                {t('tradingProfiles.fields.riskOverrides')}
              </Text>

              <Stack gap={4}>
                <HStack justify="space-between">
                  <Box>
                    <Text fontSize="sm" fontWeight="medium">
                      {t('tradingProfiles.fields.overrideMaxPosition')}
                    </Text>
                    <Text fontSize="xs" color="fg.muted">
                      {t('tradingProfiles.fields.overrideMaxPositionDescription')}
                    </Text>
                  </Box>
                  <Switch
                    checked={overridePositionSize}
                    onCheckedChange={(checked) => {
                      setOverridePositionSize(checked);
                      if (!checked) setMaxPositionSize(undefined);
                    }}
                  />
                </HStack>

                {overridePositionSize && (
                  <Field label={t('tradingProfiles.fields.maxPositionSize')}>
                    <NumberInput
                      value={maxPositionSize ?? ''}
                      onChange={(e) => setMaxPositionSize(e.target.value ? Number(e.target.value) : undefined)}
                      min={1}
                      max={100}
                    />
                  </Field>
                )}

                <HStack justify="space-between">
                  <Box>
                    <Text fontSize="sm" fontWeight="medium">
                      {t('tradingProfiles.fields.overrideMaxConcurrent')}
                    </Text>
                    <Text fontSize="xs" color="fg.muted">
                      {t('tradingProfiles.fields.overrideMaxConcurrentDescription')}
                    </Text>
                  </Box>
                  <Switch
                    checked={overrideConcurrentPositions}
                    onCheckedChange={(checked) => {
                      setOverrideConcurrentPositions(checked);
                      if (!checked) setMaxConcurrentPositions(undefined);
                    }}
                  />
                </HStack>

                {overrideConcurrentPositions && (
                  <Field label={t('tradingProfiles.fields.maxConcurrentPositions')}>
                    <NumberInput
                      value={maxConcurrentPositions ?? ''}
                      onChange={(e) => setMaxConcurrentPositions(e.target.value ? Number(e.target.value) : undefined)}
                      min={1}
                      max={10}
                    />
                  </Field>
                )}
              </Stack>
            </Box>

            <Separator />

            <HStack justify="space-between">
              <Box>
                <Text fontSize="sm" fontWeight="medium">
                  {t('tradingProfiles.fields.setAsDefault')}
                </Text>
                <Text fontSize="xs" color="fg.muted">
                  {t('tradingProfiles.fields.setAsDefaultDescription')}
                </Text>
              </Box>
              <Switch checked={isDefault} onCheckedChange={setIsDefault} />
            </HStack>
          </Stack>
        </DialogBody>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            {t('common.cancel')}
          </Button>
          <Button
            colorPalette="blue"
            onClick={handleSubmit}
            loading={isSubmitting}
            disabled={!canSubmit}
          >
            {isEditing ? t('common.save') : t('tradingProfiles.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
};

import { Box, Collapsible, Flex, HStack, Input, SimpleGrid, Spinner, Stack, Text, Textarea } from '@chakra-ui/react';
import {
  DialogBackdrop,
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogPositioner,
  DialogRoot,
  DialogTitle,
} from '@renderer/components/ui/dialog';
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
import { LuChevronDown, LuChevronUp } from 'react-icons/lu';

interface ProfileEditorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  profile: TradingProfile | null;
}

export const ProfileEditorDialog = ({ isOpen, onClose, profile }: ProfileEditorDialogProps) => {
  const { t } = useTranslation();
  const { createProfile, updateProfile, isCreatingProfile, isUpdatingProfile } = useTradingProfiles();
  const { setups: availableSetups, isLoading: isLoadingSetups } = useAvailableSetups();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [enabledSetupTypes, setEnabledSetupTypes] = useState<string[]>([]);
  const [maxPositionSize, setMaxPositionSize] = useState<number | undefined>(undefined);
  const [maxConcurrentPositions, setMaxConcurrentPositions] = useState<number | undefined>(undefined);
  const [isDefault, setIsDefault] = useState(false);
  const [overridePositionSize, setOverridePositionSize] = useState(false);
  const [overrideConcurrentPositions, setOverrideConcurrentPositions] = useState(false);

  const [basicInfoExpanded, setBasicInfoExpanded] = useState(true);
  const [setupsExpanded, setSetupsExpanded] = useState(true);
  const [riskExpanded, setRiskExpanded] = useState(false);

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

  const handleToggleAll = () => {
    const allEnabled = availableSetups.every((s) => enabledSetupTypes.includes(s.id));
    if (allEnabled) {
      setEnabledSetupTypes([]);
    } else {
      setEnabledSetupTypes(availableSetups.map((s) => s.id));
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
  const allSetupsEnabled = availableSetups.length > 0 && availableSetups.every((s) => enabledSetupTypes.includes(s.id));
  const enabledCount = enabledSetupTypes.length;

  return (
    <DialogRoot open={isOpen} onOpenChange={(e) => !e.open && onClose()} size="lg">
      <DialogBackdrop />
      <DialogPositioner>
        <DialogContent>
          <DialogHeader px={4} pt={4}>
            <DialogTitle>
              {isEditing ? t('tradingProfiles.editProfile') : t('tradingProfiles.createProfile')}
            </DialogTitle>
          </DialogHeader>
          <DialogCloseTrigger />

          <DialogBody p={4} maxH="70vh" overflowY="auto">
            <Stack gap={4}>
              <Box>
                <Flex
                  justify="space-between"
                  align="center"
                  cursor="pointer"
                  onClick={() => setBasicInfoExpanded(!basicInfoExpanded)}
                  _hover={{ bg: 'bg.muted' }}
                  p={2}
                  mx={-2}
                  borderRadius="md"
                >
                  <Box>
                    <Text fontSize="md" fontWeight="bold">
                      {t('tradingProfiles.sections.basicInfo', 'Basic Information')}
                    </Text>
                    <Text fontSize="xs" color="fg.muted">
                      {t('tradingProfiles.sections.basicInfoDescription', 'Profile name and description')}
                    </Text>
                  </Box>
                  {basicInfoExpanded ? <LuChevronUp size={20} /> : <LuChevronDown size={20} />}
                </Flex>

                <Collapsible.Root open={basicInfoExpanded}>
                  <Collapsible.Content>
                    <Stack gap={4} mt={4}>
                      <Field label={t('tradingProfiles.fields.name')} required>
                        <Input
                          size="sm"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder={t('tradingProfiles.placeholders.name')}
                          maxLength={100}
                          px={3}
                        />
                      </Field>

                      <Field label={t('tradingProfiles.fields.description')}>
                        <Textarea
                          size="sm"
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          placeholder={t('tradingProfiles.placeholders.description')}
                          maxLength={500}
                          rows={2}
                          px={3}
                        />
                      </Field>

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
                  </Collapsible.Content>
                </Collapsible.Root>
              </Box>

              <Box>
                <Flex
                  justify="space-between"
                  align="center"
                  cursor="pointer"
                  onClick={() => setSetupsExpanded(!setupsExpanded)}
                  _hover={{ bg: 'bg.muted' }}
                  p={2}
                  mx={-2}
                  borderRadius="md"
                >
                  <Box>
                    <Flex align="center" gap={2}>
                      <Text fontSize="md" fontWeight="bold">
                        {t('tradingProfiles.fields.enabledSetups')}
                      </Text>
                      <Box
                        px={2}
                        py={0.5}
                        bg={enabledCount === availableSetups.length ? 'green.100' : enabledCount > 0 ? 'blue.100' : 'red.100'}
                        color={enabledCount === availableSetups.length ? 'green.800' : enabledCount > 0 ? 'blue.800' : 'red.800'}
                        borderRadius="full"
                        fontSize="xs"
                        fontWeight="medium"
                        _dark={{
                          bg: enabledCount === availableSetups.length ? 'green.900' : enabledCount > 0 ? 'blue.900' : 'red.900',
                          color: enabledCount === availableSetups.length ? 'green.200' : enabledCount > 0 ? 'blue.200' : 'red.200',
                        }}
                      >
                        {enabledCount}/{availableSetups.length}
                      </Box>
                    </Flex>
                    <Text fontSize="xs" color="fg.muted">
                      {t('tradingProfiles.sections.setupsDescription', 'Select which trading setups this profile will use')}
                    </Text>
                  </Box>
                  {setupsExpanded ? <LuChevronUp size={20} /> : <LuChevronDown size={20} />}
                </Flex>

                <Collapsible.Root open={setupsExpanded}>
                  <Collapsible.Content>
                    <Stack gap={4} mt={4}>
                      <Box>
                        <Checkbox checked={allSetupsEnabled} onCheckedChange={handleToggleAll}>
                          <Text fontWeight="semibold" fontSize="sm">
                            {t('setupConfig.toggleAll', 'Select All')}
                          </Text>
                        </Checkbox>
                      </Box>

                      {isLoadingSetups ? (
                        <Flex justify="center" py={4}>
                          <Spinner size="sm" />
                        </Flex>
                      ) : availableSetups.length === 0 ? (
                        <Box p={4} textAlign="center">
                          <Text fontSize="sm" color="fg.muted">
                            {t('setupConfig.noStrategiesAvailable', 'No strategies available')}
                          </Text>
                        </Box>
                      ) : (
                        <SimpleGrid columns={{ base: 1, md: 2 }} gap={2}>
                          {availableSetups.map((setup) => (
                            <Box
                              key={setup.id}
                              p={2}
                              bg="bg.muted"
                              borderRadius="md"
                              borderLeft="3px solid"
                              borderColor={enabledSetupTypes.includes(setup.id) ? 'green.500' : 'gray.400'}
                              cursor="pointer"
                              _hover={{ bg: 'bg.subtle' }}
                              onClick={() => handleToggleSetup(setup.id)}
                            >
                              <Checkbox
                                checked={enabledSetupTypes.includes(setup.id)}
                                onCheckedChange={() => handleToggleSetup(setup.id)}
                              >
                                <Text fontSize="sm">
                                  {t(`tradingProfiles.setups.${setup.id}`, setup.id)}
                                </Text>
                              </Checkbox>
                            </Box>
                          ))}
                        </SimpleGrid>
                      )}
                    </Stack>
                  </Collapsible.Content>
                </Collapsible.Root>
              </Box>

              <Box>
                <Flex
                  justify="space-between"
                  align="center"
                  cursor="pointer"
                  onClick={() => setRiskExpanded(!riskExpanded)}
                  _hover={{ bg: 'bg.muted' }}
                  p={2}
                  mx={-2}
                  borderRadius="md"
                >
                  <Box>
                    <Text fontSize="md" fontWeight="bold">
                      {t('tradingProfiles.fields.riskOverrides')}
                    </Text>
                    <Text fontSize="xs" color="fg.muted">
                      {t('tradingProfiles.sections.riskDescription', 'Override wallet risk settings for this profile')}
                    </Text>
                  </Box>
                  {riskExpanded ? <LuChevronUp size={20} /> : <LuChevronDown size={20} />}
                </Flex>

                <Collapsible.Root open={riskExpanded}>
                  <Collapsible.Content>
                    <Stack gap={4} mt={4}>
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
                            size="sm"
                            value={maxPositionSize ?? ''}
                            onChange={(e) => setMaxPositionSize(e.target.value ? Number(e.target.value) : undefined)}
                            min={1}
                            max={100}
                            px={3}
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
                            size="sm"
                            value={maxConcurrentPositions ?? ''}
                            onChange={(e) => setMaxConcurrentPositions(e.target.value ? Number(e.target.value) : undefined)}
                            min={1}
                            max={10}
                            px={3}
                          />
                        </Field>
                      )}
                    </Stack>
                  </Collapsible.Content>
                </Collapsible.Root>
              </Box>
            </Stack>
          </DialogBody>

          <DialogFooter px={4} pb={4}>
            <Button size="2xs" variant="ghost" onClick={onClose} disabled={isSubmitting} px={3}>
              {t('common.cancel')}
            </Button>
            <Button
              size="2xs"
              colorPalette="blue"
              onClick={handleSubmit}
              loading={isSubmitting}
              disabled={!canSubmit}
              px={3}
            >
              {isEditing ? t('common.save') : t('tradingProfiles.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </DialogPositioner>
    </DialogRoot>
  );
};

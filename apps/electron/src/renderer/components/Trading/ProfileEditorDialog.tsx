import { Box, Flex, HStack, SimpleGrid, Spinner, Stack, Text } from '@chakra-ui/react';
import {
  Button,
  Checkbox,
  CollapsibleSection,
  DialogBackdrop,
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogPositioner,
  DialogRoot,
  DialogTitle,
  Field,
  Input,
  Select,
  Switch,
  Textarea,
} from '@renderer/components/ui';
import type { TradingProfile } from '@marketmind/types';
import { useUserIndicators } from '@renderer/hooks';
import { useTranslation } from 'react-i18next';
import { ChecklistEditor } from './ChecklistEditor';
import { DIRECTION_MODE_OPTIONS, MODE_KEYS, TRADING_MODE_OPTIONS } from './profileEditorConstants';
import { OverrideBadge, OverrideRow, ovStr } from './profileEditorUtils';
import { ProfileFibEntrySection } from './ProfileFibEntrySection';
import { ProfileFiltersSection } from './ProfileFiltersSection';
import { ProfileRiskSection } from './ProfileRiskSection';
import { ProfileTrailingStopSection } from './ProfileTrailingStopSection';
import { useProfileEditorForm } from './useProfileEditorForm';

interface ProfileEditorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  profile: TradingProfile | null;
}

export const ProfileEditorDialog = ({ isOpen, onClose, profile }: ProfileEditorDialogProps) => {
  const { t } = useTranslation();
  const form = useProfileEditorForm(profile, isOpen, onClose);
  const { overrideActions } = form;
  const { indicators: availableIndicators } = useUserIndicators();

  return (
    <DialogRoot open={isOpen} onOpenChange={(e) => !e.open && onClose()} size="xl">
      <DialogBackdrop />
      <DialogPositioner>
        <DialogContent>
          <DialogHeader px={4} pt={4}>
            <DialogTitle>
              {form.isEditing ? t('tradingProfiles.editProfile') : t('tradingProfiles.createProfile')}
            </DialogTitle>
          </DialogHeader>
          <DialogCloseTrigger />

          <DialogBody p={4} maxH="70vh" overflowY="auto">
            <Stack gap={2}>
              <CollapsibleSection
                title={t('tradingProfiles.sections.basicInfo')}
                description={t('tradingProfiles.sections.basicInfoDescription')}
                defaultOpen={true}
                size="lg"
              >
                <Stack gap={4}>
                  <Field label={t('tradingProfiles.fields.name')} required>
                    <Input
                      size="sm"
                      value={form.name}
                      onChange={(e) => form.setName(e.target.value)}
                      placeholder={t('tradingProfiles.placeholders.name')}
                      maxLength={100}
                      px={3}
                    />
                  </Field>
                  <Field label={t('tradingProfiles.fields.description')}>
                    <Textarea
                      size="sm"
                      value={form.description}
                      onChange={(e) => form.setDescription(e.target.value)}
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
                    <Switch checked={form.isDefault} onCheckedChange={form.setIsDefault} />
                  </HStack>
                </Stack>
              </CollapsibleSection>

              <CollapsibleSection
                title={t('tradingProfiles.sections.tradingMode')}
                description={t('tradingProfiles.sections.tradingModeDescription')}
                badge={<OverrideBadge count={overrideActions.ovCount(MODE_KEYS)} />}
                size="lg"
              >
                <Stack gap={4}>
                  <OverrideRow
                    label={t('tradingProfiles.overrides.tradingMode')}
                    description={t('tradingProfiles.overrides.usingGlobalDefault')}
                    isActive={overrideActions.isActive('tradingMode')}
                    onToggle={overrideActions.tog('tradingMode', 'auto')}
                  >
                    <Select
                      value={ovStr(overrideActions.co, 'tradingMode', 'auto')}
                      options={TRADING_MODE_OPTIONS}
                      onChange={(v) => overrideActions.setOv('tradingMode', v)}
                      size="sm"
                    />
                  </OverrideRow>
                  <OverrideRow
                    label={t('tradingProfiles.overrides.directionMode')}
                    description={t('tradingProfiles.overrides.usingGlobalDefault')}
                    isActive={overrideActions.isActive('directionMode')}
                    onToggle={overrideActions.tog('directionMode', 'auto')}
                  >
                    <Select
                      value={ovStr(overrideActions.co, 'directionMode', 'auto')}
                      options={DIRECTION_MODE_OPTIONS}
                      onChange={(v) => overrideActions.setOv('directionMode', v)}
                      size="sm"
                    />
                  </OverrideRow>
                </Stack>
              </CollapsibleSection>

              <CollapsibleSection
                title={t('tradingProfiles.fields.enabledSetups')}
                description={t('tradingProfiles.sections.setupsDescription')}
                defaultOpen={true}
                badge={
                  <Box
                    px={2}
                    py={0.5}
                    bg={form.enabledCount === form.availableSetups.length ? 'green.100' : form.enabledCount > 0 ? 'blue.100' : 'red.100'}
                    color={form.enabledCount === form.availableSetups.length ? 'green.800' : form.enabledCount > 0 ? 'blue.800' : 'red.800'}
                    borderRadius="full"
                    fontSize="xs"
                    fontWeight="medium"
                    _dark={{
                      bg: form.enabledCount === form.availableSetups.length ? 'green.900' : form.enabledCount > 0 ? 'blue.900' : 'red.900',
                      color: form.enabledCount === form.availableSetups.length ? 'green.200' : form.enabledCount > 0 ? 'blue.200' : 'red.200',
                    }}
                  >
                    {form.enabledCount}/{form.availableSetups.length}
                  </Box>
                }
                size="lg"
              >
                <Stack gap={4}>
                  <Box>
                    <Checkbox checked={form.allSetupsEnabled} onCheckedChange={form.handleToggleAll}>
                      <Text fontWeight="semibold" fontSize="sm">
                        {t('setupConfig.toggleAll')}
                      </Text>
                    </Checkbox>
                  </Box>
                  {form.isLoadingSetups ? (
                    <Flex justify="center" py={4}>
                      <Spinner size="sm" />
                    </Flex>
                  ) : form.availableSetups.length === 0 ? (
                    <Box p={4} textAlign="center">
                      <Text fontSize="sm" color="fg.muted">
                        {t('setupConfig.noStrategiesAvailable')}
                      </Text>
                    </Box>
                  ) : (
                    <SimpleGrid columns={{ base: 1, md: 2 }} gap={2}>
                      {form.availableSetups.map((setup) => (
                        <Box
                          key={setup.id}
                          p={2}
                          bg="bg.muted"
                          borderRadius="md"
                          borderLeft="3px solid"
                          borderColor={form.enabledSetupTypes.includes(setup.id) ? 'green.500' : 'gray.400'}
                          cursor="pointer"
                          _hover={{ bg: 'bg.subtle' }}
                          onClick={() => form.handleToggleSetup(setup.id)}
                        >
                          <Checkbox
                            checked={form.enabledSetupTypes.includes(setup.id)}
                            onCheckedChange={() => form.handleToggleSetup(setup.id)}
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
              </CollapsibleSection>

              <CollapsibleSection
                title={t('tradingProfiles.sections.checklist', { defaultValue: 'Pre-trade checklist' })}
                description={t('tradingProfiles.sections.checklistDescription', {
                  defaultValue:
                    'Conditions evaluated before each trade. Required = must pass. Preferred = adds to confidence score.',
                })}
                badge={
                  <Box
                    px={2}
                    py={0.5}
                    bg={form.checklistConditions.length > 0 ? 'blue.100' : 'gray.100'}
                    color={form.checklistConditions.length > 0 ? 'blue.800' : 'gray.700'}
                    borderRadius="full"
                    fontSize="xs"
                    fontWeight="medium"
                    _dark={{
                      bg: form.checklistConditions.length > 0 ? 'blue.900' : 'gray.700',
                      color: form.checklistConditions.length > 0 ? 'blue.200' : 'gray.300',
                    }}
                  >
                    {form.checklistConditions.length}
                  </Box>
                }
                size="lg"
              >
                <ChecklistEditor
                  conditions={form.checklistConditions}
                  availableIndicators={availableIndicators}
                  onChange={form.setChecklistConditions}
                  isSaving={form.isSubmitting}
                />
              </CollapsibleSection>

              <ProfileFiltersSection actions={overrideActions} />
              <ProfileFibEntrySection actions={overrideActions} />
              <ProfileTrailingStopSection actions={overrideActions} />
              <ProfileRiskSection
                actions={overrideActions}
                overridePositionSize={form.overridePositionSize}
                setOverridePositionSize={form.setOverridePositionSize}
                maxPositionSize={form.maxPositionSize}
                setMaxPositionSize={form.setMaxPositionSize}
                overrideConcurrentPositions={form.overrideConcurrentPositions}
                setOverrideConcurrentPositions={form.setOverrideConcurrentPositions}
                maxConcurrentPositions={form.maxConcurrentPositions}
                setMaxConcurrentPositions={form.setMaxConcurrentPositions}
              />
            </Stack>
          </DialogBody>

          <DialogFooter px={4} pb={4}>
            <Button size="2xs" variant="ghost" onClick={onClose} disabled={form.isSubmitting} px={3}>
              {t('common.cancel')}
            </Button>
            <Button
              size="2xs"
              variant="outline"
              onClick={() => void form.handleSubmit()}
              loading={form.isSubmitting}
              disabled={!form.canSubmit}
              px={3}
            >
              {form.isEditing ? t('common.save') : t('tradingProfiles.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </DialogPositioner>
    </DialogRoot>
  );
};

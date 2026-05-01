import { Box, Flex, Stack } from '@chakra-ui/react';
import {
  Badge,
  Callout,
  DialogShell,
  Field,
  Input,
  Textarea,
} from '@renderer/components/ui';
import type { DialogControlProps } from '@marketmind/types';
import { trpc } from '@renderer/utils/trpc';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

type ImportProfileDialogProps = DialogControlProps;

interface ParsedProfile {
  name?: string;
  enabledSetupTypes?: string[];
  [key: string]: unknown;
}

export const ImportProfileDialog = ({ isOpen, onClose }: ImportProfileDialogProps) => {
  const { t } = useTranslation();
  const utils = trpc.useUtils();

  const [jsonInput, setJsonInput] = useState('');
  const [profileName, setProfileName] = useState('');
  const [parseError, setParseError] = useState('');
  const [parsedData, setParsedData] = useState<ParsedProfile | null>(null);

  const importMutation = trpc.tradingProfiles.importFromBacktest.useMutation({
    onSuccess: () => {
      void utils.tradingProfiles.list.invalidate();
      handleClose();
    },
  });

  const handleJsonChange = (value: string) => {
    setJsonInput(value);
    setParseError('');
    setParsedData(null);

    if (!value.trim()) return;

    try {
      const parsed = JSON.parse(value) as ParsedProfile;
      if (!parsed.enabledSetupTypes || !Array.isArray(parsed.enabledSetupTypes)) {
        setParseError(t('tradingProfiles.import.invalidJson'));
        return;
      }
      setParsedData(parsed);
      if (parsed.name && !profileName) setProfileName(parsed.name);
    } catch {
      setParseError(t('tradingProfiles.import.invalidJson'));
    }
  };

  const handleClose = () => {
    setJsonInput('');
    setProfileName('');
    setParseError('');
    setParsedData(null);
    onClose();
  };

  const handleImport = () => {
    if (!parsedData || !profileName.trim()) return;
    const { name: _name, ...configFields } = parsedData;
    void importMutation.mutateAsync({
      name: profileName.trim(),
      enabledSetupTypes: parsedData.enabledSetupTypes ?? [],
      ...configFields,
    });
  };

  return (
    <DialogShell
      isOpen={isOpen}
      onClose={handleClose}
      size="lg"
      title={t('tradingProfiles.import.title')}
      description={t('tradingProfiles.import.description')}
      onSubmit={handleImport}
      submitLabel={t('tradingProfiles.import.importButton')}
      submitDisabled={!parsedData || !profileName.trim()}
      isLoading={importMutation.isPending}
    >
      <Stack gap={3}>
        <Field label={t('tradingProfiles.import.nameLabel')}>
          <Input
            size="xs"
            value={profileName}
            onChange={(e) => setProfileName(e.target.value)}
            placeholder={t('tradingProfiles.import.namePlaceholder')}
          />
        </Field>

        <Field
          label={t('tradingProfiles.import.pasteJson')}
          invalid={!!parseError}
          errorText={parseError}
        >
          <Textarea
            value={jsonInput}
            onChange={(e) => handleJsonChange(e.target.value)}
            rows={8}
            fontFamily="mono"
            fontSize="xs"
            px={3}
            py={2}
          />
        </Field>

        {parsedData && (
          <Callout tone="success" title={t('tradingProfiles.import.preview')} compact>
            <Stack gap={1.5} mt={1}>
              <Box fontSize="2xs">
                {t('tradingProfiles.import.strategiesCount', {
                  count: parsedData.enabledSetupTypes?.length ?? 0,
                })}
              </Box>
              {parsedData.enabledSetupTypes && (
                <Flex flexWrap="wrap" gap={1}>
                  {parsedData.enabledSetupTypes.slice(0, 6).map((setup) => (
                    <Badge key={setup} size="xs" colorPalette="blue" variant="subtle">
                      {setup}
                    </Badge>
                  ))}
                  {parsedData.enabledSetupTypes.length > 6 && (
                    <Badge size="xs" colorPalette="gray" variant="subtle">
                      +{parsedData.enabledSetupTypes.length - 6}
                    </Badge>
                  )}
                </Flex>
              )}
            </Stack>
          </Callout>
        )}
      </Stack>
    </DialogShell>
  );
};

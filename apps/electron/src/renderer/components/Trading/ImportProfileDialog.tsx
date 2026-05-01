import { Box, Flex, Stack } from '@chakra-ui/react';
import {
  Badge,
  Button,
  Callout,
  CloseButton,
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
    <DialogRoot open={isOpen} onOpenChange={(e) => !e.open && handleClose()} size="lg">
      <DialogBackdrop />
      <DialogPositioner>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('tradingProfiles.import.title')}</DialogTitle>
            <DialogCloseTrigger asChild>
              <CloseButton size="sm" />
            </DialogCloseTrigger>
          </DialogHeader>

          <DialogBody>
            <Stack gap={3}>
              <Field label={t('tradingProfiles.import.nameLabel')}>
                <Input
                  size="sm"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  placeholder="e.g., Optimized BTC Strategy"
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
                          <Badge key={setup} size="sm" colorPalette="blue" variant="subtle">
                            {setup}
                          </Badge>
                        ))}
                        {parsedData.enabledSetupTypes.length > 6 && (
                          <Badge size="sm" colorPalette="gray" variant="subtle">
                            +{parsedData.enabledSetupTypes.length - 6}
                          </Badge>
                        )}
                      </Flex>
                    )}
                  </Stack>
                </Callout>
              )}
            </Stack>
          </DialogBody>

          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="outline"
              onClick={handleImport}
              disabled={!parsedData || !profileName.trim()}
              loading={importMutation.isPending}
            >
              {importMutation.isPending
                ? t('tradingProfiles.import.importing')
                : t('tradingProfiles.import.importButton')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </DialogPositioner>
    </DialogRoot>
  );
};

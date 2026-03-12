import { Box, Stack, Text, Textarea } from '@chakra-ui/react';
import { Button } from '@renderer/components/ui/button';
import { Input } from '@renderer/components/ui/input';
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
import { Field } from '@renderer/components/ui/field';
import { trpc } from '@renderer/utils/trpc';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface ImportProfileDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

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
    } as Parameters<typeof importMutation.mutateAsync>[0]);
  };

  return (
    <DialogRoot open={isOpen} onOpenChange={(e) => !e.open && handleClose()} size="lg">
      <DialogBackdrop />
      <DialogPositioner>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('tradingProfiles.import.title')}</DialogTitle>
            <DialogCloseTrigger />
          </DialogHeader>

          <DialogBody>
            <Stack gap={4}>
              <Field label={t('tradingProfiles.import.nameLabel')}>
                <Input
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
                />
              </Field>

              {parsedData && (
                <Box p={3} bg="bg.muted" borderRadius="md">
                  <Text fontSize="sm" fontWeight="bold" mb={2}>
                    {t('tradingProfiles.import.preview')}
                  </Text>
                  <Stack gap={1}>
                    <Text fontSize="xs" color="fg.muted">
                      {t('tradingProfiles.import.strategiesCount', {
                        count: parsedData.enabledSetupTypes?.length ?? 0,
                      })}
                    </Text>
                    {parsedData.enabledSetupTypes && (
                      <Box display="flex" flexWrap="wrap" gap={1}>
                        {parsedData.enabledSetupTypes.slice(0, 6).map((setup) => (
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
                            {setup}
                          </Box>
                        ))}
                        {parsedData.enabledSetupTypes.length > 6 && (
                          <Box
                            px={2}
                            py={0.5}
                            bg="gray.100"
                            color="gray.600"
                            borderRadius="sm"
                            fontSize="2xs"
                            _dark={{ bg: 'gray.800', color: 'gray.300' }}
                          >
                            +{parsedData.enabledSetupTypes.length - 6}
                          </Box>
                        )}
                      </Box>
                    )}
                  </Stack>
                </Box>
              )}
            </Stack>
          </DialogBody>

          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>
              {t('common.cancel')}
            </Button>
            <Button
              colorPalette="blue"
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

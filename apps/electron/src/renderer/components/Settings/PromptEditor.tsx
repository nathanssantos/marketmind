import { Button } from '@/renderer/components/ui/button';
import { Field } from '@/renderer/components/ui/field';
import { Box, Code, Flex, Separator, Stack, Text, Textarea } from '@chakra-ui/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuCheck, LuRefreshCw, LuX } from 'react-icons/lu';

interface PromptEditorProps {
  value: string;
  defaultValue: string;
  onChange: (value: string) => void;
  onReset: () => void;
  label: string;
  description?: string;
  placeholder?: string;
}

export const PromptEditor = ({
  value,
  defaultValue,
  onChange,
  onReset,
  label,
  description,
  placeholder,
}: PromptEditorProps) => {
  const { t } = useTranslation();
  const [editedValue, setEditedValue] = useState(value);
  const [isValid, setIsValid] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isModified = value !== defaultValue;
  const hasUnsavedChanges = editedValue !== value;

  const validateJson = (jsonString: string): boolean => {
    if (!jsonString.trim()) {
      setError(t('settings.prompt.errorEmpty'));
      return false;
    }

    try {
      JSON.parse(jsonString);
      setError(null);
      return true;
    } catch (err) {
      if (err instanceof Error) {
        setError(`${t('settings.prompt.errorInvalidJson')}: ${err.message}`);
      } else {
        setError(t('settings.prompt.errorInvalidJson'));
      }
      return false;
    }
  };

  const handleChange = (newValue: string) => {
    setEditedValue(newValue);
    const valid = validateJson(newValue);
    setIsValid(valid);
  };

  const handleSave = () => {
    if (validateJson(editedValue)) {
      onChange(editedValue);
      setIsValid(true);
    }
  };

  const handleReset = () => {
    setEditedValue(defaultValue);
    setIsValid(true);
    setError(null);
    onReset();
  };

  const handleCancel = () => {
    setEditedValue(value);
    setIsValid(true);
    setError(null);
  };

  const formatJson = () => {
    try {
      const parsed = JSON.parse(editedValue);
      const formatted = JSON.stringify(parsed, null, 2);
      setEditedValue(formatted);
      setIsValid(true);
      setError(null);
    } catch (err) {
      setIsValid(false);
      if (err instanceof Error) {
        setError(`${t('settings.prompt.errorInvalidJson')}: ${err.message}`);
      }
    }
  };

  return (
    <Stack gap={4}>
      <Box>
        <Text fontSize="sm" fontWeight="semibold" mb={2}>
          {label}
        </Text>
        {description && (
          <Text fontSize="sm" color="fg.muted" mb={3}>
            {description}
          </Text>
        )}

        {isModified && (
          <Box
            bg="orange.500/10"
            p={3}
            borderRadius="md"
            borderLeft="3px solid"
            borderColor="orange.500"
            mb={3}
          >
            <Text fontSize="sm" color="orange.500">
              ⚠️ {t('settings.prompt.customPromptWarning')}
            </Text>
          </Box>
        )}

        <Field
          invalid={!isValid}
          {...(error && { errorText: error })}
        >
          <Textarea
            value={editedValue}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={placeholder}
            fontFamily="mono"
            fontSize="sm"
            minHeight="400px"
            spellCheck={false}
            css={{
              '&::-webkit-scrollbar': {
                width: '8px',
              },
              '&::-webkit-scrollbar-track': {
                background: 'transparent',
              },
              '&::-webkit-scrollbar-thumb': {
                background: 'var(--chakra-colors-border-muted)',
                borderRadius: '4px',
              },
            }}
          />
        </Field>
      </Box>

      <Flex gap={2} wrap="wrap">
        <Button
          onClick={handleSave}
          disabled={!isValid || !hasUnsavedChanges}
          colorPalette="green"
          flex={1}
        >
          <LuCheck />
          {t('common.save')}
        </Button>

        <Button
          onClick={formatJson}
          variant="outline"
          flex={1}
        >
          {t('settings.prompt.formatJson')}
        </Button>

        {hasUnsavedChanges && (
          <Button
            onClick={handleCancel}
            variant="outline"
            colorPalette="gray"
            flex={1}
          >
            <LuX />
            {t('common.cancel')}
          </Button>
        )}
      </Flex>

      {isModified && (
        <>
          <Separator />
          <Button
            onClick={handleReset}
            variant="outline"
            colorPalette="red"
            width="full"
          >
            <LuRefreshCw />
            {t('settings.prompt.resetToDefault')}
          </Button>
        </>
      )}

      <Box
        bg="blue.500/10"
        p={3}
        borderRadius="md"
        borderLeft="3px solid"
        borderColor="blue.500"
      >
        <Text fontSize="sm" fontWeight="semibold" mb={2}>
          💡 {t('common.tips')}
        </Text>
        <Stack gap={1} fontSize="xs" color="fg.muted">
          <Text>• {t('settings.prompt.tipValidJson')}</Text>
          <Text>• {t('settings.prompt.tipFormat')}</Text>
          <Text>• {t('settings.prompt.tipBackup')}</Text>
        </Stack>
      </Box>

      {isModified && (
        <Box>
          <Text fontSize="xs" fontWeight="semibold" mb={2} color="fg.muted">
            {t('settings.prompt.defaultValue')}:
          </Text>
          <Code
            display="block"
            p={3}
            borderRadius="md"
            fontSize="xs"
            whiteSpace="pre-wrap"
            overflowX="auto"
            maxHeight="200px"
            css={{
              '&::-webkit-scrollbar': {
                width: '8px',
                height: '8px',
              },
              '&::-webkit-scrollbar-track': {
                background: 'transparent',
              },
              '&::-webkit-scrollbar-thumb': {
                background: 'var(--chakra-colors-border-muted)',
                borderRadius: '4px',
              },
            }}
          >
            {JSON.stringify(JSON.parse(defaultValue), null, 2)}
          </Code>
        </Box>
      )}
    </Stack>
  );
};

import { Button } from '@/renderer/components/ui/button';
import { useColorMode } from '@/renderer/components/ui/color-mode';
import { Field } from '@/renderer/components/ui/field';
import { Select } from '@/renderer/components/ui/select';
import { useAIStore } from '@/renderer/store';
import { Box, Flex, Separator, Stack, Text } from '@chakra-ui/react';
import { HiArrowDownTray, HiArrowUpTray, HiTrash } from 'react-icons/hi2';

export const GeneralTab = () => {
  const { colorMode, setColorMode } = useColorMode();
  const { conversations, importConversation, clearAll } = useAIStore();

  const handleThemeChange = (newTheme: 'light' | 'dark') => {
    setColorMode(newTheme);
  };

  const handleExportAll = () => {
    const data = {
      conversations,
      exportedAt: Date.now(),
      version: '0.6.0',
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `marketmind-conversations-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const content = event.target?.result as string;
          importConversation(content);
          alert('Conversation imported successfully!');
        } catch (error) {
          alert('Failed to import conversation. Please check the file format.');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleClearAll = () => {
    const confirm = window.confirm(
      'Are you sure you want to delete all conversations? This action cannot be undone.'
    );
    if (confirm) {
      clearAll();
      alert('All conversations cleared.');
    }
  };

  return (
    <Stack gap={6}>
      <Box>
        <Field label="Theme">
          <Select
            value={colorMode}
            onChange={(value) => handleThemeChange(value as 'light' | 'dark')}
            options={[
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
          />
        </Field>
      </Box>

      <Separator />

      <Box>
        <Text fontSize="md" fontWeight="medium" mb={3}>
          Data Management
        </Text>
        <Stack gap={3}>
          <Flex gap={2}>
            <Button flex={1} variant="outline" onClick={handleExportAll} disabled={conversations.length === 0}>
              <HiArrowDownTray />
              Export All Conversations
            </Button>
            <Button flex={1} variant="outline" onClick={handleImport}>
              <HiArrowUpTray />
              Import Conversation
            </Button>
          </Flex>
          <Button colorPalette="red" variant="outline" onClick={handleClearAll} disabled={conversations.length === 0}>
            <HiTrash />
            Clear All Data
          </Button>
        </Stack>
      </Box>

      <Box bg="bg.muted" p={4} borderRadius="md">
        <Text fontSize="sm" fontWeight="medium" mb={2}>
          About Data Management
        </Text>
        <Stack gap={2} fontSize="sm" color="fg.muted">
          <Text>• Export: Save all your conversations as a JSON file</Text>
          <Text>• Import: Load a previously exported conversation</Text>
          <Text>• Clear: Remove all conversations and reset the app</Text>
          <Text>• Total Conversations: {conversations.length}</Text>
        </Stack>
      </Box>
    </Stack>
  );
};

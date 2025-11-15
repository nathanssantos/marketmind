import { Button } from '@/renderer/components/ui/button';
import { Slider } from '@/renderer/components/ui/slider';
import { Switch } from '@/renderer/components/ui/switch';
import { useAutoUpdate } from '@/renderer/hooks/useAutoUpdate';
import { useLocalStorage } from '@/renderer/hooks/useLocalStorage';
import { useAIStore } from '@/renderer/store';
import { Box, Flex, Separator, Stack, Text } from '@chakra-ui/react';
import { HiArrowDownTray, HiArrowPath, HiArrowUpTray, HiTrash } from 'react-icons/hi2';

export const GeneralTab = () => {
  const { conversations, importConversation, clearAll } = useAIStore();
  
  const [autoCheckUpdates, setAutoCheckUpdates] = useLocalStorage('autoCheckUpdates', true);
  const [autoDownloadUpdates, setAutoDownloadUpdates] = useLocalStorage('autoDownloadUpdates', true);
  const [updateCheckInterval, setUpdateCheckInterval] = useLocalStorage('updateCheckInterval', 24);
  
  const { status, checkForUpdates, startAutoCheck, stopAutoCheck } = useAutoUpdate();

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

  const handleAutoCheckChange = (checked: boolean) => {
    setAutoCheckUpdates(checked);
    if (checked) {
      startAutoCheck(updateCheckInterval);
    } else {
      stopAutoCheck();
    }
  };

  const handleAutoDownloadChange = (checked: boolean) => {
    setAutoDownloadUpdates(checked);
  };

  const handleIntervalChange = (value: number[]) => {
    const interval = value[0] ?? 24;
    setUpdateCheckInterval(interval);
    if (autoCheckUpdates) {
      stopAutoCheck();
      startAutoCheck(interval);
    }
  };

  const handleCheckNow = () => {
    checkForUpdates();
  };

  return (
    <Stack gap={6}>
      <Box 
        bg="blue.500/10" 
        p={4} 
        borderRadius="md"
        borderLeft="4px solid"
        borderColor="blue.500"
      >
        <Text fontSize="sm" fontWeight="semibold" mb={2}>
          💡 Data Management
        </Text>
        <Stack gap={1} fontSize="sm" color="fg.muted">
          <Text>• Export: Save all conversations as JSON file for backup</Text>
          <Text>• Import: Load a previously exported conversation</Text>
          <Text>• Clear: Remove all conversations and chat history</Text>
          <Text>• Total Conversations: {conversations.length}</Text>
        </Stack>
      </Box>

      <Separator />

      <Box>
        <Text fontSize="md" fontWeight="medium" mb={3}>
          Auto-Update Settings
        </Text>
        <Stack gap={4}>
          <Box>
            <Switch 
              checked={autoCheckUpdates} 
              onCheckedChange={handleAutoCheckChange}
            >
              Check for updates automatically
            </Switch>
            <Text fontSize="sm" color="fg.muted" mt={1}>
              Automatically check for new versions in the background
            </Text>
          </Box>

          {autoCheckUpdates && (
            <Box>
              <Text fontSize="sm" mb={2}>
                Check interval: {updateCheckInterval} hours
              </Text>
              <Slider 
                value={[updateCheckInterval]}
                onValueChange={handleIntervalChange}
                min={1}
                max={168}
                step={1}
              />
            </Box>
          )}

          <Box>
            <Switch 
              checked={autoDownloadUpdates} 
              onCheckedChange={handleAutoDownloadChange}
            >
              Download updates automatically
            </Switch>
            <Text fontSize="sm" color="fg.muted" mt={1}>
              Automatically download new versions when available
            </Text>
          </Box>

          <Button 
            variant="outline" 
            onClick={handleCheckNow}
            disabled={status === 'checking'}
          >
            <HiArrowPath />
            Check for Updates Now
          </Button>
        </Stack>
      </Box>

      <Separator />

      <Box>
        <Text fontSize="md" fontWeight="medium" mb={3}>
          Data Management
        </Text>
        <Flex gap={2}>
          <Button flex={1} variant="outline" onClick={handleExportAll} disabled={conversations.length === 0}>
            <HiArrowDownTray />
            Export All Conversations
          </Button>
          <Button flex={1} variant="outline" onClick={handleImport}>
            <HiArrowUpTray />
            Import Conversation
          </Button>
          <Button flex={1} colorPalette="red" variant="outline" onClick={handleClearAll} disabled={conversations.length === 0}>
            <HiTrash />
            Clear All Data
          </Button>
        </Flex>
      </Box>
    </Stack>
  );
};

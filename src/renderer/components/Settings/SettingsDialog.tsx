import { Button } from '@/renderer/components/ui/button';
import { Dialog } from '@/renderer/components/ui/dialog';
import { Tabs } from '@/renderer/components/ui/tabs';
import { Box } from '@chakra-ui/react';
import { useState } from 'react';
import { AboutTab } from './AboutTab';
import { AIConfigTab } from './AIConfigTab';
import { GeneralTab } from './GeneralTab';
import { NewsConfigTab } from './NewsConfigTab';
import { useSettingsDialog } from './useSettingsDialog';

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsDialog = ({ isOpen, onClose }: SettingsDialogProps) => {
  const [activeTab, setActiveTab] = useState<string>('general');
  const { isDirty, handleSave, handleClose } = useSettingsDialog(onClose);

  return (
    <Dialog.Root open={isOpen} onOpenChange={(e) => !e.open && handleClose()} size="xl">
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content maxH="85vh">
          <Dialog.Header borderBottom="1px solid" borderColor="border">
            <Dialog.Title>Settings</Dialog.Title>
          </Dialog.Header>
          <Dialog.CloseTrigger />

          <Dialog.Body overflowY="auto">
            <Tabs.Root value={activeTab} onValueChange={(e) => setActiveTab(e.value)} variant="enclosed">
              <Tabs.List>
                <Tabs.Trigger value="general">General</Tabs.Trigger>
                <Tabs.Trigger value="ai">AI Configuration</Tabs.Trigger>
                <Tabs.Trigger value="news">News</Tabs.Trigger>
                <Tabs.Trigger value="about">About</Tabs.Trigger>
              </Tabs.List>

              <Box mt={4}>
                <Tabs.Content value="general">
                  <GeneralTab />
                </Tabs.Content>

                <Tabs.Content value="ai">
                  <AIConfigTab />
                </Tabs.Content>

                <Tabs.Content value="news">
                  <NewsConfigTab />
                </Tabs.Content>

                <Tabs.Content value="about">
                  <AboutTab />
                </Tabs.Content>
              </Box>
            </Tabs.Root>
          </Dialog.Body>

          <Dialog.Footer borderTop="1px solid" borderColor="border">
            <Dialog.ActionTrigger asChild>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
            </Dialog.ActionTrigger>
            <Button colorPalette="blue" onClick={handleSave} disabled={!isDirty}>
              Save Changes
            </Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
};

import {
  Box,
  Button,
  DialogActionTrigger,
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
  Tabs,
} from '@chakra-ui/react';
import { useState } from 'react';
import { AboutTab } from './AboutTab';
import { AIConfigTab } from './AIConfigTab';
import { GeneralTab } from './GeneralTab';
import { useSettingsModal } from './useSettingsModal';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal = ({ isOpen, onClose }: SettingsModalProps) => {
  const [activeTab, setActiveTab] = useState<string>('general');
  const { isDirty, handleSave, handleClose } = useSettingsModal(onClose);

  return (
    <DialogRoot open={isOpen} onOpenChange={(e) => !e.open && handleClose()} size="xl">
      <DialogContent maxH="85vh">
        <DialogHeader borderBottom="1px solid" borderColor="border">
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        <DialogCloseTrigger />

        <DialogBody overflowY="auto">
          <Tabs.Root value={activeTab} onValueChange={(e) => setActiveTab(e.value)} variant="enclosed">
            <Tabs.List>
              <Tabs.Trigger value="general">General</Tabs.Trigger>
              <Tabs.Trigger value="ai">AI Configuration</Tabs.Trigger>
              <Tabs.Trigger value="about">About</Tabs.Trigger>
            </Tabs.List>

            <Box mt={4}>
              <Tabs.Content value="general">
                <GeneralTab />
              </Tabs.Content>

              <Tabs.Content value="ai">
                <AIConfigTab />
              </Tabs.Content>

              <Tabs.Content value="about">
                <AboutTab />
              </Tabs.Content>
            </Box>
          </Tabs.Root>
        </DialogBody>

        <DialogFooter borderTop="1px solid" borderColor="border">
          <DialogActionTrigger asChild>
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
          </DialogActionTrigger>
          <Button colorPalette="blue" onClick={handleSave} disabled={!isDirty}>
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
};

import { useAIStore } from '@/renderer/store';
import { useState } from 'react';

export const useSettingsModal = (onClose: () => void) => {
  const [isDirty, setIsDirty] = useState(false);
  const settings = useAIStore((state) => state.settings);

  const handleSave = () => {
    setIsDirty(false);
    onClose();
  };

  const handleClose = () => {
    if (isDirty) {
      const confirmClose = window.confirm(
        'You have unsaved changes. Are you sure you want to close?'
      );
      if (!confirmClose) return;
    }
    setIsDirty(false);
    onClose();
  };

  const markDirty = () => setIsDirty(true);

  return {
    isDirty,
    settings,
    handleSave,
    handleClose,
    markDirty,
  };
};

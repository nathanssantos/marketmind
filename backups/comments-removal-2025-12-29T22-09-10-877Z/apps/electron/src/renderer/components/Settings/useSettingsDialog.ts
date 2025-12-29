import { useState } from 'react';

export const useSettingsDialog = (onClose: () => void) => {
  const [isDirty, setIsDirty] = useState(false);

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
    handleSave,
    handleClose,
    markDirty,
  };
};

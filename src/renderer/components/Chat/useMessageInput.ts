import { useState, useCallback } from 'react';
import { useAIStore } from '@/renderer/store/aiStore';
import { useChartContext } from '@/renderer/context/ChartContext';

export const useMessageInput = () => {
  const [message, setMessage] = useState('');
  const { chartData } = useChartContext();
  
  const sendMessage = useAIStore((state) => state.sendMessage);
  const provider = useAIStore((state) => state.provider);
  const model = useAIStore((state) => state.model);

  const canSend = message.trim().length > 0 && provider && model;

  const handleSend = useCallback(async () => {
    if (!canSend) return;

    await sendMessage(message.trim(), chartData || undefined);
    
    setMessage('');
  }, [canSend, message, chartData, sendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  return {
    message,
    setMessage,
    handleSend,
    handleKeyDown,
    canSend,
    hasChartData: !!chartData,
  };
};

import { useChartContext } from '@/renderer/context/ChartContext';
import { useAIStore } from '@/renderer/store/aiStore';
import { useCallback, useState } from 'react';

export const useMessageInput = () => {
  const [message, setMessage] = useState('');
  const { chartData } = useChartContext();
  
  const sendMessage = useAIStore((state) => state.sendMessage);
  const settings = useAIStore((state) => state.settings);
  const isLoading = useAIStore((state) => state.isLoading);

  const canSend = message.trim().length > 0 && settings?.provider && settings?.model && !isLoading;

  const handleSend = useCallback(async () => {
    if (!canSend) return;

    const messageToSend = message.trim();
    setMessage('');
    
    await sendMessage(messageToSend, chartData || undefined);
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

import { useAIStore } from '@/renderer/store/aiStore';
import { useEffect, useRef } from 'react';

export const useMessageList = () => {
  const messages = useAIStore((state) => state.messages);
  const isLoading = useAIStore((state) => state.isLoading);
  const error = useAIStore((state) => state.error);
  const setError = useAIStore((state) => state.setError);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const clearError = () => {
    setError(null);
  };

  return {
    messages,
    loading: isLoading,
    error,
    messagesEndRef,
    clearError,
  };
};

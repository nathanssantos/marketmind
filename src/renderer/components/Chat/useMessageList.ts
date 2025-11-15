import { useAIStore } from '@/renderer/store/aiStore';
import { useEffect, useRef } from 'react';

export const useMessageList = () => {
  const messages = useAIStore((state) => state.messages);
  const isLoading = useAIStore((state) => state.isLoading);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  return {
    messages,
    loading: isLoading,
    messagesEndRef,
  };
};

import { Box, Flex, IconButton, Text } from '@chakra-ui/react';
import { useState } from 'react';
import { HiClock, HiTrash } from 'react-icons/hi2';
import { useChartContext } from '../../context/ChartContext';
import { useAIStore } from '../../store/aiStore';
import { Popover } from '../ui/popover';

export const ConversationHistory = () => {
  const [open, setOpen] = useState(false);
  const { chartData } = useChartContext();
  const activeConversationId = useAIStore((state) => state.activeConversationId);
  const getConversationsBySymbol = useAIStore((state) => state.getConversationsBySymbol);
  const setActiveConversation = useAIStore((state) => state.setActiveConversation);
  const deleteConversation = useAIStore((state) => state.deleteConversation);

  const symbol = chartData?.symbol || '';
  const conversations = symbol ? getConversationsBySymbol(symbol) : [];

  const handleSelectConversation = (id: string) => {
    setActiveConversation(id);
    setOpen(false);
  };

  const handleDeleteConversation = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteConversation(id);
  };

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Agora';
    if (diffMins < 60) return `${diffMins}m atrás`;
    if (diffHours < 24) return `${diffHours}h atrás`;
    if (diffDays < 7) return `${diffDays}d atrás`;
    
    return date.toLocaleDateString('pt-BR', { 
      day: '2-digit', 
      month: '2-digit',
      year: '2-digit'
    });
  };

  return (
    <Popover
      open={open}
      onOpenChange={(e) => setOpen(e.open)}
      trigger={
        <IconButton
          aria-label="Conversation history"
          size="sm"
          variant="ghost"
        >
          <HiClock />
        </IconButton>
      }
    >
      <Flex direction="column" maxHeight="400px">
        <Flex
          align="center"
          justify="space-between"
          px={3}
          py={2}
          borderBottom="1px solid"
          borderColor="border"
        >
          <Text fontSize="sm" fontWeight="semibold">
            Conversas - {symbol}
          </Text>
        </Flex>

        <Box overflowY="auto" maxHeight="350px">
          {conversations.length === 0 ? (
            <Flex
              align="center"
              justify="center"
              py={8}
              px={4}
              color="fg.muted"
            >
              <Text fontSize="sm" textAlign="center">
                Nenhuma conversa ainda
              </Text>
            </Flex>
          ) : (
            conversations.map((conversation) => (
              <Flex
                key={conversation.id}
                align="center"
                gap={2}
                px={3}
                py={2}
                cursor="pointer"
                bg={conversation.id === activeConversationId ? 'bg.muted' : 'transparent'}
                _hover={{ bg: 'bg.muted' }}
                onClick={() => handleSelectConversation(conversation.id)}
                borderBottom="1px solid"
                borderColor="border"
              >
                <Flex direction="column" flex={1} minWidth={0}>
                  <Text
                    fontSize="sm"
                    fontWeight={conversation.id === activeConversationId ? 'semibold' : 'normal'}
                    overflow="hidden"
                    textOverflow="ellipsis"
                    whiteSpace="nowrap"
                  >
                    {conversation.title}
                  </Text>
                  <Text fontSize="xs" color="fg.muted">
                    {conversation.messages.length} {conversation.messages.length === 1 ? 'mensagem' : 'mensagens'} · {formatDate(conversation.updatedAt)}
                  </Text>
                </Flex>
                <IconButton
                  aria-label="Delete conversation"
                  onClick={(e) => handleDeleteConversation(conversation.id, e)}
                  size="xs"
                  variant="ghost"
                  colorScheme="red"
                >
                  <HiTrash />
                </IconButton>
              </Flex>
            ))
          )}
        </Box>
      </Flex>
    </Popover>
  );
};

import { Flex, IconButton, Text } from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';
import { LuChevronRight, LuPencilRuler, LuPlus } from 'react-icons/lu';
import { useChartContext } from '../../context/ChartContext';
import { useAIStore } from '../../store/aiStore';
import { TooltipWrapper } from '../ui/Tooltip';
import { ConversationHistory } from './ConversationHistory';
import { MessageInput } from './MessageInput';
import { MessageList } from './MessageList';

interface ChatSidebarProps {
  width: number;
  isOpen: boolean;
  onToggle: () => void;
}

export const ChatSidebar = ({ width, isOpen, onToggle }: ChatSidebarProps) => {
  const { t } = useTranslation();
  const { chartData } = useChartContext();
  const startNewConversation = useAIStore((state) => state.startNewConversation);
  const enableAIStudies = useAIStore((state) => state.enableAIStudies);
  const toggleAIStudies = useAIStore((state) => state.toggleAIStudies);

  const handleNewConversation = () => {
    if (chartData?.symbol) {
      startNewConversation(chartData.symbol);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <Flex
      direction="column"
      width={`${width}px`}
      minWidth="300px"
      height="100%"
      bg="bg.surface"
      borderLeft="1px solid"
      borderColor="border"
    >
      <Flex
        align="center"
        justify="space-between"
        px={4}
        py={3}
        borderBottom="1px solid"
        borderColor="border"
      >
        <Flex direction="column" gap={0}>
          <Text fontSize="lg" fontWeight="semibold">
            {t('chat.title')}
          </Text>
          {chartData?.symbol && (
            <Text fontSize="xs" color="fg.muted">
              {chartData.symbol}
            </Text>
          )}
        </Flex>
        <Flex align="center" gap={1}>
          <TooltipWrapper 
            label={enableAIStudies ? t('chat.disableAIStudies') : t('chat.enableAIStudies')} 
            showArrow
          >
            <IconButton
              aria-label={enableAIStudies ? t('chat.disableAIStudies') : t('chat.enableAIStudies')}
              onClick={toggleAIStudies}
              size="sm"
              variant="ghost"
              colorPalette={enableAIStudies ? 'blue' : 'gray'}
            >
              <LuPencilRuler />
            </IconButton>
          </TooltipWrapper>
          <TooltipWrapper label={t('chat.newConversation')} showArrow>
            <IconButton
              aria-label={t('chat.newConversation')}
              onClick={handleNewConversation}
              size="sm"
              variant="ghost"
            >
              <LuPlus />
            </IconButton>
          </TooltipWrapper>
          <ConversationHistory />
          <TooltipWrapper label={t('chat.closeChat')} showArrow>
            <IconButton
              aria-label={t('chat.closeChat')}
              onClick={onToggle}
              size="sm"
              variant="ghost"
            >
              <LuChevronRight />
            </IconButton>
          </TooltipWrapper>
        </Flex>
      </Flex>

      <MessageList />
      <MessageInput />
    </Flex>
  );
};

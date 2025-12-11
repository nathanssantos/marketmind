import { IconButton } from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';
import { LuPlus } from 'react-icons/lu';
import { useChartContext } from '../../context/ChartContext';
import { useAIStore } from '../../store/aiStore';
import { SidebarContainer, SidebarHeader } from '../ui/Sidebar';
import { TooltipWrapper } from '../ui/Tooltip';
import { ConversationHistory } from './ConversationHistory';
import { MarketContextDisplay } from './MarketContextDisplay';
import { MessageInput } from './MessageInput';
import { MessageList } from './MessageList';

interface ChatSidebarProps {
  width: number;
  isOpen: boolean;
}

export const ChatSidebar = ({ width, isOpen }: ChatSidebarProps) => {
  const { t } = useTranslation();
  const { chartData } = useChartContext();
  const startNewConversation = useAIStore((state) => state.startNewConversation);

  const handleNewConversation = () => {
    if (chartData?.symbol) startNewConversation(chartData.symbol);
  };

  return (
    <SidebarContainer width={width} isOpen={isOpen}>
      <SidebarHeader
        title={t('chat.title')}
        actions={
          <>
            <TooltipWrapper label={t('chat.newConversation')} showArrow>
              <IconButton
                aria-label={t('chat.newConversation')}
                onClick={handleNewConversation}
                size="2xs"
                variant="ghost"
              >
                <LuPlus />
              </IconButton>
            </TooltipWrapper>
            <ConversationHistory />
          </>
        }
      />
      <MarketContextDisplay />
      <MessageList />
      <MessageInput />
    </SidebarContainer>
  );
};

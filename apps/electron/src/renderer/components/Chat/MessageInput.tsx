import { Box, Flex, IconButton, Textarea } from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';
import { LuBot, LuPencilRuler, LuSend } from 'react-icons/lu';
import { useAIStore } from '../../store/aiStore';
import { CompactAISelector } from '../Layout/CompactAISelector';
import { TooltipWrapper } from '../ui/Tooltip';
import { useMessageInput } from './useMessageInput';

export const MessageInput = () => {
  const { t } = useTranslation();
  const enableAIPatterns = useAIStore((state) => state.enableAIPatterns);
  const toggleAIPatterns = useAIStore((state) => state.toggleAIPatterns);
  const isAutoTradingActive = useAIStore((state) => state.isAutoTradingActive);
  const toggleAutoTrading = useAIStore((state) => state.toggleAutoTrading);
  const {
    message,
    setMessage,
    handleSend,
    handleKeyDown,
    canSend,
  } = useMessageInput();

  return (
    <Box
      px={4}
      py={3}
      borderTop="1px solid"
      borderColor="border"
    >
      <Flex gap={2}>
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('chat.inputPlaceholder')}
          resize="none"
          rows={3}
          maxLength={2000}
          px={3}
          py={2}
        />
        <IconButton
          aria-label={t('chat.sendMessage')}
          onClick={handleSend}
          disabled={!canSend}
          colorPalette="blue"
          size="sm"
          height="auto"
          width="48px"
          alignSelf="stretch"
        >
          <LuSend />
        </IconButton>
      </Flex>
      <Flex mt={2} align="center" gap={2}>
        <TooltipWrapper
          label={enableAIPatterns ? t('chat.disableAIPatterns') : t('chat.enableAIPatterns')}
          showArrow
        >
          <IconButton
            aria-label={enableAIPatterns ? t('chat.disableAIPatterns') : t('chat.enableAIPatterns')}
            onClick={toggleAIPatterns}
            size="2xs"
            variant={enableAIPatterns ? 'solid' : 'outline'}
            colorPalette={enableAIPatterns ? 'purple' : 'gray'}
          >
            <LuPencilRuler />
          </IconButton>
        </TooltipWrapper>
        <TooltipWrapper
          label={isAutoTradingActive ? t('chat.disableAutoTrading') : t('chat.enableAutoTrading')}
          showArrow
        >
          <IconButton
            aria-label={isAutoTradingActive ? t('chat.disableAutoTrading') : t('chat.enableAutoTrading')}
            onClick={toggleAutoTrading}
            size="2xs"
            variant={isAutoTradingActive ? 'solid' : 'outline'}
            colorPalette={isAutoTradingActive ? 'green' : 'gray'}
          >
            <LuBot />
          </IconButton>
        </TooltipWrapper>
        <CompactAISelector showBadge={true} />
      </Flex>
    </Box>
  );
};

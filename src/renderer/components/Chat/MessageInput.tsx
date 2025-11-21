import { Box, Flex, IconButton, Textarea } from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';
import { LuPencilRuler, LuSend } from 'react-icons/lu';
import { useAIStore } from '../../store/aiStore';
import { CompactAISelector } from '../Layout/CompactAISelector';
import { TooltipWrapper } from '../ui/Tooltip';
import { useMessageInput } from './useMessageInput';

export const MessageInput = () => {
  const { t } = useTranslation();
  const enableAIStudies = useAIStore((state) => state.enableAIStudies);
  const toggleAIStudies = useAIStore((state) => state.toggleAIStudies);
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
          label={enableAIStudies ? t('chat.disableAIStudies') : t('chat.enableAIStudies')}
          showArrow
        >
          <IconButton
            aria-label={enableAIStudies ? t('chat.disableAIStudies') : t('chat.enableAIStudies')}
            onClick={toggleAIStudies}
            size="2xs"
            variant={enableAIStudies ? 'solid' : 'outline'}
            colorPalette={enableAIStudies ? 'purple' : 'gray'}
          >
            <LuPencilRuler />
          </IconButton>
        </TooltipWrapper>
        <CompactAISelector showBadge={true} />
      </Flex>
    </Box>
  );
};

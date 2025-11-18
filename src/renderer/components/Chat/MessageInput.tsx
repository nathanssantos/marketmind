import { Box, Flex, IconButton, Textarea } from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';
import { LuSend } from 'react-icons/lu';
import { UnifiedAISelector } from '../Layout/UnifiedAISelector';
import { useMessageInput } from './useMessageInput';

export const MessageInput = () => {
  const { t } = useTranslation();
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
      <Box mb={3}>
        <UnifiedAISelector showBadge={false} openUpwards={true} />
      </Box>
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
    </Box>
  );
};

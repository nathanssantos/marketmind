import { Box, Flex, IconButton, Textarea } from '@chakra-ui/react';
import { HiPaperAirplane } from 'react-icons/hi2';
import { useMessageInput } from './useMessageInput';

export const MessageInput = () => {
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
          placeholder="Ask about the chart..."
          resize="none"
          rows={3}
          maxLength={2000}
          py={2}
        />
        <IconButton
          aria-label="Send message"
          onClick={handleSend}
          disabled={!canSend}
          colorPalette="blue"
          size="sm"
        >
          <HiPaperAirplane />
        </IconButton>
      </Flex>
    </Box>
  );
};

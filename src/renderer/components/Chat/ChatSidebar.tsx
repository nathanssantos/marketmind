import { Flex, IconButton, Text } from '@chakra-ui/react';
import { HiChevronRight } from 'react-icons/hi2';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';

interface ChatSidebarProps {
  width: number;
  isOpen: boolean;
  onToggle: () => void;
}

export const ChatSidebar = ({ width, isOpen, onToggle }: ChatSidebarProps) => {
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
        <Text fontSize="lg" fontWeight="semibold">
          AI Assistant
        </Text>
        <IconButton
          aria-label="Close chat"
          onClick={onToggle}
          size="sm"
          variant="ghost"
        >
          <HiChevronRight />
        </IconButton>
      </Flex>

      <MessageList />
      <MessageInput />
    </Flex>
  );
};

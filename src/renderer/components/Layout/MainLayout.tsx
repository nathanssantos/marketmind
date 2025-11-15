import { Box, Flex, IconButton } from '@chakra-ui/react';
import { HiChevronLeft } from 'react-icons/hi2';
import { useState, useCallback, useRef, useEffect } from 'react';
import { Header } from './Header';
import { ChatSidebar } from '../Chat/ChatSidebar';
import { useLocalStorage } from '@/renderer/hooks/useLocalStorage';

interface MainLayoutProps {
  children: React.ReactNode;
  onSettingsClick?: () => void;
}

const MIN_CHAT_WIDTH = 300;
const MAX_CHAT_WIDTH = 800;
const DEFAULT_CHAT_WIDTH = 400;

export const MainLayout = ({ children, onSettingsClick }: MainLayoutProps) => {
  const [isChatOpen, setIsChatOpen] = useLocalStorage('chat-sidebar-open', true);
  const [chatWidth, setChatWidth] = useLocalStorage('chat-sidebar-width', DEFAULT_CHAT_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const toggleChat = useCallback(() => {
    setIsChatOpen((prev) => !prev);
  }, [setIsChatOpen]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    startXRef.current = e.clientX;
    startWidthRef.current = chatWidth;
  }, [chatWidth]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return;

    const deltaX = startXRef.current - e.clientX;
    const newWidth = Math.min(
      Math.max(startWidthRef.current + deltaX, MIN_CHAT_WIDTH),
      MAX_CHAT_WIDTH
    );
    setChatWidth(newWidth);
  }, [isResizing, setChatWidth]);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, handleMouseMove, handleMouseUp]);

  return (
    <Box width="100vw" height="100vh" overflow="hidden" bg="bg.panel">
      <Header onSettingsClick={onSettingsClick || undefined} />
      
      <Flex
        position="fixed"
        top="60px"
        left={0}
        right={0}
        bottom={0}
        overflow="hidden"
      >
        <Box
          flex={1}
          position="relative"
          overflow="hidden"
          width={isChatOpen ? `calc(100% - ${chatWidth}px)` : '100%'}
          transition="width 0.2s ease"
        >
          {children}
        </Box>

        {isChatOpen && (
          <>
            <Box
              position="relative"
              width="4px"
              bg="border"
              cursor="col-resize"
              _hover={{ bg: 'blue.500' }}
              onMouseDown={handleMouseDown}
              userSelect="none"
            />
            <ChatSidebar 
              width={chatWidth} 
              isOpen={isChatOpen} 
              onToggle={toggleChat}
            />
          </>
        )}

        {!isChatOpen && (
          <IconButton
            aria-label="Open chat"
            onClick={toggleChat}
            position="fixed"
            right={4}
            bottom={4}
            colorPalette="blue"
            borderRadius="full"
            size="lg"
            zIndex={100}
          >
            <HiChevronLeft />
          </IconButton>
        )}
      </Flex>
    </Box>
  );
};

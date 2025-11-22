import { GlobalActionsProvider } from '@/renderer/context/GlobalActionsContext';
import { useLocalStorage } from '@/renderer/hooks/useLocalStorage';
import { useTradingStore } from '@/renderer/store/tradingStore';
import { useUIStore } from '@/renderer/store/uiStore';
import { Box, Flex } from '@chakra-ui/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AdvancedControlsConfig } from '../Chart/AdvancedControls';
import { ChatSidebar } from '../Chat/ChatSidebar';
import { KeyboardShortcutsDialog } from '../KeyboardShortcuts/KeyboardShortcutsDialog';
import { SettingsDialog } from '../Settings/SettingsDialog';
import { TradingSidebar } from '../Trading/TradingSidebar';
import { Header } from './Header';

interface MainLayoutProps {
  children: React.ReactNode;
  onOpenSymbolSelector?: () => void;
  advancedConfig: AdvancedControlsConfig;
  onAdvancedConfigChange: (config: AdvancedControlsConfig) => void;
  isChatOpen: boolean;
  onToggleChat: () => void;
}

const MIN_CHAT_WIDTH = 300;
const MAX_CHAT_WIDTH = 800;
const DEFAULT_CHAT_WIDTH = 400;
const MIN_TRADING_WIDTH = 300;
const MAX_TRADING_WIDTH = 600;
const DEFAULT_TRADING_WIDTH = 400;

export const MainLayout = ({ children, onOpenSymbolSelector, advancedConfig, onAdvancedConfigChange, isChatOpen, onToggleChat }: MainLayoutProps) => {
  const [chatWidth, setChatWidth] = useLocalStorage('chat-sidebar-width', DEFAULT_CHAT_WIDTH);
  const [tradingWidth, setTradingWidth] = useLocalStorage('trading-sidebar-width', DEFAULT_TRADING_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);
  const resizingTargetRef = useRef<'chat' | 'trading' | null>(null);

  const chatPosition = useUIStore((state) => state.chatPosition);
  const isSimulatorActive = useTradingStore((state) => state.isSimulatorActive);

  const handleSettingsClick = useCallback(() => {
    setIsSettingsOpen(true);
  }, []);

  const globalActions = useMemo(() => ({
    openSettings: () => setIsSettingsOpen(true),
    toggleChatSidebar: onToggleChat,
    focusChatInput: () => {
      if (!isChatOpen) onToggleChat();
    },
    showKeyboardShortcuts: () => setShowKeyboardShortcuts(true),
    openSymbolSelector: () => onOpenSymbolSelector?.(),
  }), [onToggleChat, isChatOpen, onOpenSymbolSelector]);

  const handleMouseDown = useCallback((e: React.MouseEvent, target: 'chat' | 'trading') => {
    e.preventDefault();
    setIsResizing(true);
    resizingTargetRef.current = target;
    startXRef.current = e.clientX;
    startWidthRef.current = target === 'chat' ? chatWidth : tradingWidth;
  }, [chatWidth, tradingWidth]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing || !resizingTargetRef.current) return;

    const target = resizingTargetRef.current;
    const isLeftSide = (target === 'chat' && chatPosition === 'left') || (target === 'trading' && false);
    const deltaX = isLeftSide ? e.clientX - startXRef.current : startXRef.current - e.clientX;
    
    const minWidth = target === 'chat' ? MIN_CHAT_WIDTH : MIN_TRADING_WIDTH;
    const maxWidth = target === 'chat' ? MAX_CHAT_WIDTH : MAX_TRADING_WIDTH;
    const newWidth = Math.min(Math.max(startWidthRef.current + deltaX, minWidth), maxWidth);
    
    if (target === 'chat') {
      setChatWidth(newWidth);
    } else {
      setTradingWidth(newWidth);
    }
  }, [isResizing, chatPosition, setChatWidth, setTradingWidth]);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
    resizingTargetRef.current = null;
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
    <GlobalActionsProvider actions={globalActions}>
      <Box width="100vw" height="100vh" overflow="hidden">
        <Header onSettingsClick={handleSettingsClick} />

        <Flex
          position="fixed"
          top="96px"
          left={0}
          right={0}
          bottom={0}
          overflow="hidden"
        >
          {chatPosition === 'left' && isChatOpen && (
            <>
              <ChatSidebar
                width={chatWidth}
                isOpen={isChatOpen}
                onToggle={onToggleChat}
              />
              <Box
                position="relative"
                width="4px"
                bg="border"
                cursor="col-resize"
                _hover={{ bg: 'blue.500' }}
                onMouseDown={(e) => handleMouseDown(e, 'chat')}
                userSelect="none"
              />
            </>
          )}

          <Box
            flex={1}
            position="relative"
            overflow="hidden"
            width={
              isChatOpen && isSimulatorActive
                ? `calc(100% - ${chatWidth}px - ${tradingWidth}px)`
                : isChatOpen
                  ? `calc(100% - ${chatWidth}px)`
                  : isSimulatorActive
                    ? `calc(100% - ${tradingWidth}px)`
                    : '100%'
            }
            transition="width 0.2s ease"
          >
            {children}
          </Box>

          {isSimulatorActive && (
            <>
              <Box
                position="relative"
                width="4px"
                bg="border"
                cursor="col-resize"
                _hover={{ bg: 'green.500' }}
                onMouseDown={(e) => handleMouseDown(e, 'trading')}
                userSelect="none"
              />
              <TradingSidebar width={tradingWidth} />
            </>
          )}

          {chatPosition === 'right' && isChatOpen && (
            <>
              <Box
                position="relative"
                width="4px"
                bg="border"
                cursor="col-resize"
                _hover={{ bg: 'blue.500' }}
                onMouseDown={(e) => handleMouseDown(e, 'chat')}
                userSelect="none"
              />
              <ChatSidebar
                width={chatWidth}
                isOpen={isChatOpen}
                onToggle={onToggleChat}
              />
            </>
          )}
        </Flex>

        <SettingsDialog
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          advancedConfig={advancedConfig}
          onAdvancedConfigChange={onAdvancedConfigChange}
        />
        <KeyboardShortcutsDialog isOpen={showKeyboardShortcuts} onClose={() => setShowKeyboardShortcuts(false)} />
      </Box>
    </GlobalActionsProvider>
  );
};

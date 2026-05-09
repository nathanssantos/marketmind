import { Box, Flex, Text as ChakraText, Toaster } from '@chakra-ui/react';
import { CryptoIcon, IconButton } from '@renderer/components/ui';
import type { MarketType } from '@marketmind/types';
import type { ReactElement, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { LuX } from 'react-icons/lu';
import { getToasterNavigateToSymbol, toaster } from '@renderer/utils/toaster';

interface ToastLike {
  id: string;
  type?: string;
  title?: ReactNode;
  description?: ReactNode;
  meta?: unknown;
}

const ToastContent = ({ toast }: { toast: ToastLike }): ReactElement => {
  const { t } = useTranslation();
  const symbol = (toast.meta as Record<string, unknown> | undefined)?.['symbol'] as string | undefined;
  const marketType = (toast.meta as Record<string, unknown> | undefined)?.['marketType'] as MarketType | undefined;
  const navigate = getToasterNavigateToSymbol();
  const canNavigate = !!symbol && !!navigate;

  return (
    <Box
      key={toast.id}
      p={4}
      bg={
        toast.type === 'error'
          ? 'red.500'
          : toast.type === 'success'
            ? 'green.500'
            : toast.type === 'warning'
              ? 'orange.500'
              : 'blue.500'
      }
      color="white"
      borderRadius="md"
      boxShadow="lg"
      maxW="400px"
      position="relative"
    >
      <IconButton
        aria-label={t('common.close')}
        size="xs"
        position="absolute"
        top={2}
        right={2}
        onClick={() => toaster.dismiss(toast.id)}
        variant="ghost"
        color="white"
        _hover={{ bg: 'whiteAlpha.200' }}
      >
        <LuX />
      </IconButton>
      {symbol ? (
        <Flex
          align="center"
          gap={2}
          mb={1}
          pr={6}
          cursor={canNavigate ? 'pointer' : 'default'}
          onClick={canNavigate && navigate ? () => navigate(symbol, marketType) : undefined}
          _hover={canNavigate ? { opacity: 0.8 } : undefined}
        >
          <CryptoIcon symbol={symbol} size={24} />
          <ChakraText fontWeight="bold" fontSize="sm">{toast.title}</ChakraText>
        </Flex>
      ) : (
        <ChakraText fontWeight="bold" fontSize="sm" mb={1} pr={6}>
          {toast.title}
        </ChakraText>
      )}
      {toast.description && (
        <ChakraText fontSize="xs" pl={symbol ? 8 : 0}>{toast.description}</ChakraText>
      )}
    </Box>
  );
};

/**
 * App-wide toast shelf. Subscribes to the shared `toaster` store and
 * renders each toast through `<ToastContent>`. Drop this near the top
 * of the React tree (e.g. inside the auth/preferences gate) so toasts
 * are visible across every route.
 */
export const ToastShelf = (): ReactElement => (
  <Toaster toaster={toaster}>
    {(toast) => <ToastContent toast={toast as ToastLike} />}
  </Toaster>
);

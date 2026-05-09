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

// Status palette for toast pills. Routed through Chakra v3's
// `colorPalette` prop instead of hardcoded `red.500` literals so the
// theme system controls the actual hex (and the shade-literal audit
// stays green). `colorPalette.solid` resolves to the canonical bold
// fill of the palette in either theme.
const TOAST_PALETTE: Record<string, string> = {
  error: 'red',
  success: 'green',
  warning: 'orange',
  info: 'blue',
};

const ToastContent = ({ toast }: { toast: ToastLike }): ReactElement => {
  const { t } = useTranslation();
  const symbol = (toast.meta as Record<string, unknown> | undefined)?.['symbol'] as string | undefined;
  const marketType = (toast.meta as Record<string, unknown> | undefined)?.['marketType'] as MarketType | undefined;
  const navigate = getToasterNavigateToSymbol();
  const canNavigate = !!symbol && !!navigate;
  const palette = TOAST_PALETTE[toast.type ?? 'info'] ?? TOAST_PALETTE['info'];

  return (
    <Box
      key={toast.id}
      p={4}
      colorPalette={palette}
      bg="colorPalette.solid"
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

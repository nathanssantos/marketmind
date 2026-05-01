import { Box, Flex, Heading, Text, VStack } from '@chakra-ui/react';
import type { ReactNode } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Link, Logo } from '../ui';

interface AuthLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  /**
   * Optional footer rendered below the form body inside the card. Use
   * `<AuthFooterLink>` for the standard "Don't have an account? Sign up"
   * pattern shared across the 6 auth pages.
   */
  footer?: ReactNode;
}

export const AuthLayout = ({ children, title, subtitle, footer }: AuthLayoutProps) => {
  const { t } = useTranslation();

  return (
    <Flex
      minH="100vh"
      align="center"
      justify="center"
      bg="bg.canvas"
      p={4}
    >
      <Box w="full" maxW="400px">
        <VStack gap={2} mb={8} align="center">
          <Logo size={48} />
          <Heading size="lg">{t('app.title')}</Heading>
        </VStack>

        <Box
          bg="bg.panel"
          borderRadius="xl"
          borderWidth="1px"
          borderColor="border.default"
          p={8}
        >
          <VStack gap={1} mb={6} align="start">
            <Heading size="md">{title}</Heading>
            {subtitle && (
              <Text fontSize="sm" color="fg.muted">{subtitle}</Text>
            )}
          </VStack>

          {children}

          {footer && <Box mt={4}>{footer}</Box>}
        </Box>
      </Box>
    </Flex>
  );
};

interface AuthFooterLinkProps {
  /** Optional prefix text (e.g. "Don't have an account?"). */
  prefix?: string;
  /** Link label text (e.g. "Sign up"). */
  label: string;
  /** Destination route. */
  to: string;
}

/**
 * Standard "footer link" pattern shared across the 6 auth pages.
 * Centered muted text + optional prefix + a RouterLink wrapped in the
 * UI Link primitive.
 */
export const AuthFooterLink = ({ prefix, label, to }: AuthFooterLinkProps) => (
  <Text fontSize="sm" textAlign="center" color="fg.muted">
    {prefix && <>{prefix}{' '}</>}
    <Link asChild colorPalette="blue">
      <RouterLink to={to}>{label}</RouterLink>
    </Link>
  </Text>
);

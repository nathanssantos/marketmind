import { Box, Flex, Heading, Text, VStack } from '@chakra-ui/react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Logo } from '../ui';

interface AuthLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
}

export const AuthLayout = ({ children, title, subtitle }: AuthLayoutProps) => {
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
        </Box>
      </Box>
    </Flex>
  );
};

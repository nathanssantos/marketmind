import { Box, Button, Stack, Text } from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';
import { LuTriangleAlert } from 'react-icons/lu';

interface ErrorMessageProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export const ErrorMessage = ({
  title,
  message,
  onRetry
}: ErrorMessageProps) => {
  const { t } = useTranslation();

  return (
    <Box
      position="absolute"
      top="50%"
      left="50%"
      transform="translate(-50%, -50%)"
      textAlign="center"
      maxW="500px"
      p={8}
      borderRadius="lg"
      bg="bg.muted"
      borderWidth="1px"
      borderColor="border"
    >
      <Stack gap={4} alignItems="center">
        <Box
          p={3}
          borderRadius="full"
          bg="red.500/10"
          color="red.500"
        >
          <LuTriangleAlert size={32} />
        </Box>

        <Stack gap={2}>
          <Text fontSize="xl" fontWeight="bold" color="fg">
            {title || t('common.error')}
          </Text>
          <Text fontSize="md" color="fg.muted">
            {message}
          </Text>
        </Stack>

        {onRetry && (
          <Button
            onClick={onRetry}
            colorPalette="blue"
            size="md"
            mt={2}
            px={3}
          >
            {t('app.retry')}
          </Button>
        )}
      </Stack>
    </Box>
  );
};

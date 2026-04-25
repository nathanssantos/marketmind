import { Box, Spinner, Stack, Text } from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';

interface LoadingSpinnerProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const LoadingSpinner = ({ message, size = 'lg' }: LoadingSpinnerProps) => {
  const { t } = useTranslation();
  
  return (
    <Box
      position="absolute"
      top="50%"
      left="50%"
      transform="translate(-50%, -50%)"
      textAlign="center"
    >
      <Stack gap={4} alignItems="center">
        <Spinner 
          size={size} 
          color="blue.500"
          borderWidth="4px"
        />
        <Text 
          fontSize="lg" 
          color="fg.muted"
          fontWeight="medium"
        >
          {message ?? t('common.loading')}
        </Text>
      </Stack>
    </Box>
  );
};

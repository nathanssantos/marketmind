import { Box, Button, DialogBackdrop, DialogBody, DialogCloseTrigger, DialogContent, DialogFooter, DialogHeader, DialogRoot, DialogTitle, HStack, Stack, Text } from '@chakra-ui/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HiChartBar, HiChatBubbleLeftRight, HiCog, HiSparkles } from 'react-icons/hi2';

interface OnboardingDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const OnboardingDialog = ({ isOpen, onClose }: OnboardingDialogProps) => {
  const { t } = useTranslation();
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    {
      icon: HiChartBar,
      titleKey: 'onboarding.steps.welcome.title',
      descriptionKey: 'onboarding.steps.welcome.description',
    },
    {
      icon: HiSparkles,
      titleKey: 'onboarding.steps.aiProvider.title',
      descriptionKey: 'onboarding.steps.aiProvider.description',
    },
    {
      icon: HiChartBar,
      titleKey: 'onboarding.steps.analyze.title',
      descriptionKey: 'onboarding.steps.analyze.description',
    },
    {
      icon: HiChatBubbleLeftRight,
      titleKey: 'onboarding.steps.chat.title',
      descriptionKey: 'onboarding.steps.chat.description',
    },
    {
      icon: HiCog,
      titleKey: 'onboarding.steps.ready.title',
      descriptionKey: 'onboarding.steps.ready.description',
    },
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onClose();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    onClose();
  };

  const step = steps[currentStep];
  
  if (!step) {
    return null;
  }
  
  const Icon = step.icon;

  return (
    <DialogRoot open={isOpen} onOpenChange={(e) => !e.open && onClose()} size="lg">
      <DialogBackdrop />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('onboarding.title')}</DialogTitle>
        </DialogHeader>
        <DialogCloseTrigger />
        
        <DialogBody>
          <Stack gap={6} py={4}>
            <Box 
              p={4} 
              borderRadius="lg" 
              bg="blue.500/10" 
              display="flex" 
              justifyContent="center"
            >
              <Icon size={48} color="var(--chakra-colors-blue-500)" />
            </Box>

            <Stack gap={3}>
              <Text fontSize="xl" fontWeight="bold" textAlign="center">
                {t(step.titleKey)}
              </Text>
              <Text color="fg.muted" textAlign="center" lineHeight="tall">
                {t(step.descriptionKey)}
              </Text>
            </Stack>

            <HStack gap={2} justifyContent="center">
              {steps.map((_, index) => (
                <Box
                  key={index}
                  width={index === currentStep ? '24px' : '8px'}
                  height="8px"
                  borderRadius="full"
                  bg={index === currentStep ? 'blue.500' : 'gray.600'}
                  transition="all 0.3s"
                />
              ))}
            </HStack>
          </Stack>
        </DialogBody>

        <DialogFooter>
          <HStack justify="space-between" width="100%">
            <Button
              variant="ghost"
              onClick={handleSkip}
              size="sm"
            >
              {t('onboarding.skip')}
            </Button>

            <HStack gap={2}>
              <Button
                variant="outline"
                onClick={handlePrevious}
                disabled={currentStep === 0}
                size="sm"
              >
                {t('onboarding.previous')}
              </Button>
              <Button
                onClick={handleNext}
                colorPalette="blue"
                size="sm"
              >
                {currentStep === steps.length - 1 ? t('onboarding.getStarted') : t('onboarding.next')}
              </Button>
            </HStack>
          </HStack>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
};

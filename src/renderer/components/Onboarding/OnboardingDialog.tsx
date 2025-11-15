import { Box, Button, DialogBackdrop, DialogBody, DialogCloseTrigger, DialogContent, DialogFooter, DialogHeader, DialogRoot, DialogTitle, HStack, Stack, Text } from '@chakra-ui/react';
import { useState } from 'react';
import { HiChartBar, HiChatBubbleLeftRight, HiCog, HiSparkles } from 'react-icons/hi2';

interface OnboardingDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const steps = [
  {
    icon: HiChartBar,
    title: 'Welcome to MarketMind',
    description: 'Your AI-powered financial chart analysis assistant. MarketMind combines advanced charting with AI analysis to help you make informed trading decisions.',
  },
  {
    icon: HiSparkles,
    title: 'Choose Your AI Provider',
    description: 'MarketMind supports multiple AI providers: OpenAI (GPT-4), Anthropic (Claude), and Google (Gemini). Configure your API keys in the settings to get started.',
  },
  {
    icon: HiChartBar,
    title: 'Analyze Market Data',
    description: 'View real-time candlestick charts, volume indicators, and moving averages. Use the controls to customize your chart view and select different timeframes.',
  },
  {
    icon: HiChatBubbleLeftRight,
    title: 'Chat with AI',
    description: 'Ask questions about chart patterns, trends, and trading signals. The AI has access to your chart data and can provide technical analysis and insights.',
  },
  {
    icon: HiCog,
    title: 'Ready to Start',
    description: 'Open the settings (top right) to configure your AI provider and API keys. Then start analyzing charts and chatting with your AI assistant!',
  },
];

export const OnboardingDialog = ({ isOpen, onClose }: OnboardingDialogProps) => {
  const [currentStep, setCurrentStep] = useState(0);

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
          <DialogTitle>Getting Started</DialogTitle>
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
                {step.title}
              </Text>
              <Text color="fg.muted" textAlign="center" lineHeight="tall">
                {step.description}
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
              Skip
            </Button>

            <HStack gap={2}>
              <Button
                variant="outline"
                onClick={handlePrevious}
                disabled={currentStep === 0}
                size="sm"
              >
                Previous
              </Button>
              <Button
                onClick={handleNext}
                colorPalette="blue"
                size="sm"
              >
                {currentStep === steps.length - 1 ? 'Get Started' : 'Next'}
              </Button>
            </HStack>
          </HStack>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
};

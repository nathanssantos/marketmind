import { useAIStore } from '@/renderer/store/aiStore';
import { Box, Flex, IconButton, Input, Text, VStack } from '@chakra-ui/react';
import type { AIProviderType } from '@marketmind/types';
import { memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuSparkles } from 'react-icons/lu';
import { Popover } from '../ui/popover';
import { TooltipWrapper } from '../ui/Tooltip';

interface AIModelOption {
    value: string;
    label: string;
}

const AI_MODEL_OPTIONS: AIModelOption[] = [
    { value: 'openai:gpt-5.1', label: 'OpenAI - GPT-5.1' },
    { value: 'openai:gpt-5', label: 'OpenAI - GPT-5' },
    { value: 'openai:gpt-5-pro', label: 'OpenAI - GPT-5 Pro' },
    { value: 'openai:gpt-5-mini', label: 'OpenAI - GPT-5 Mini' },
    { value: 'openai:gpt-5-nano', label: 'OpenAI - GPT-5 Nano' },
    { value: 'openai:o3', label: 'OpenAI - o3 (Reasoning)' },
    { value: 'openai:o3-mini', label: 'OpenAI - o3-mini (Reasoning)' },
    { value: 'openai:o1', label: 'OpenAI - o1 (Reasoning)' },
    { value: 'openai:gpt-4.1', label: 'OpenAI - GPT-4.1' },
    { value: 'openai:gpt-4.1-mini', label: 'OpenAI - GPT-4.1 Mini' },
    { value: 'openai:gpt-4o', label: 'OpenAI - GPT-4o' },
    { value: 'openai:gpt-4o-mini', label: 'OpenAI - GPT-4o Mini' },

    { value: 'anthropic:claude-sonnet-4-5', label: 'Claude - 4.5 Sonnet' },
    { value: 'anthropic:claude-haiku-4-5', label: 'Claude - 4.5 Haiku' },
    { value: 'anthropic:claude-opus-4-1', label: 'Claude - 4.1 Opus' },
    { value: 'anthropic:claude-3-5-haiku-20241022', label: 'Claude - 3.5 Haiku' },
    { value: 'anthropic:claude-3-haiku-20240307', label: 'Claude - 3 Haiku' },

    { value: 'gemini:gemini-3-pro-preview', label: 'Gemini - 3 Pro Preview' },
    { value: 'gemini:gemini-2.5-pro', label: 'Gemini - 2.5 Pro' },
    { value: 'gemini:gemini-2.5-flash', label: 'Gemini - 2.5 Flash' },
    { value: 'gemini:gemini-2.5-flash-lite', label: 'Gemini - 2.5 Flash-Lite' },
    { value: 'gemini:gemini-2.0-flash', label: 'Gemini - 2.0 Flash' },
    { value: 'gemini:gemini-2.0-flash-exp', label: 'Gemini - 2.0 Flash Exp (FREE)' },
];

interface CompactAISelectorProps {
    showBadge?: boolean;
}

export const CompactAISelector = memo(({ showBadge = true }: CompactAISelectorProps) => {
    const { t } = useTranslation();
    const provider = useAIStore((state) => state.provider);
    const model = useAIStore((state) => state.model);
    const updateSettings = useAIStore((state) => state.updateSettings);

    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const currentValue = useMemo(
        () => provider && model ? `${provider}:${model}` : '',
        [provider, model]
    );

    const selectedOption = useMemo(
        () => AI_MODEL_OPTIONS.find((opt) => opt.value === currentValue),
        [currentValue]
    );

    const isConfigured = provider && model;

    const filteredOptions = useMemo(() => {
        if (!searchQuery) return AI_MODEL_OPTIONS;
        const query = searchQuery.toLowerCase();
        return AI_MODEL_OPTIONS.filter((opt) =>
            opt.label.toLowerCase().includes(query) ||
            opt.value.toLowerCase().includes(query)
        );
    }, [searchQuery]);

    const handleSelect = useCallback((value: string) => {
        const [newProvider, ...modelParts] = value.split(':');
        const newModel = modelParts.join(':');

        if (newProvider && newModel) {
            updateSettings({
                provider: newProvider as AIProviderType,
                model: newModel,
            });
        }
        setIsOpen(false);
        setSearchQuery('');
    }, [updateSettings]);

    return (
        <Flex align="center" gap={2}>
            <Popover
                open={isOpen}
                onOpenChange={(e) => setIsOpen(e.open)}
                showArrow={false}
                width="320px"
                positioning={{ placement: 'top-start', offset: { mainAxis: 8 } }}
                trigger={
                    <Flex>
                        <TooltipWrapper label={t('common.selectAiModel')} showArrow isDisabled={isOpen}>
                            <IconButton
                                aria-label={t('common.selectAiModel')}
                                size="2xs"
                                variant={isConfigured ? 'solid' : 'outline'}
                                colorPalette={isConfigured ? 'purple' : 'gray'}
                            >
                                <LuSparkles />
                            </IconButton>
                        </TooltipWrapper>
                    </Flex>
                }
            >
                <Flex direction="column" maxH="400px">
                    <Box p={2} borderBottomWidth="1px" borderColor="border" flexShrink={0}>
                        <Input
                            placeholder={t('common.search')}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            size="xs"
                            bg="bg.muted"
                            borderColor="border"
                            _focus={{ borderColor: 'purple.500' }}
                            autoFocus
                            px={3}
                        />
                    </Box>

                    <Box overflowY="auto" flex={1}>
                        {filteredOptions.length === 0 && (
                            <Box p={4} textAlign="center">
                                <Text color="fg.muted" fontSize="xs">
                                    {t('common.noResults')}
                                </Text>
                            </Box>
                        )}

                        {filteredOptions.length > 0 && (
                            <VStack gap={0} align="stretch">
                                {filteredOptions.map((option) => (
                                    <Box
                                        key={option.value}
                                        px={3}
                                        py={2}
                                        cursor="pointer"
                                        bg={currentValue === option.value ? 'bg.muted' : 'transparent'}
                                        _hover={{ bg: 'bg.muted' }}
                                        onClick={() => handleSelect(option.value)}
                                        borderBottomWidth="1px"
                                        borderColor="border"
                                    >
                                        <Text fontWeight={currentValue === option.value ? 'semibold' : 'medium'} fontSize="xs" color="fg">
                                            {option.label}
                                        </Text>
                                    </Box>
                                ))}
                            </VStack>
                        )}
                    </Box>
                </Flex>
            </Popover>

            {showBadge && selectedOption && (
                <Text fontSize="2xs" color="fg.muted" fontWeight="medium" maxWidth="120px" whiteSpace="nowrap" overflow="hidden" textOverflow="ellipsis">
                    {selectedOption.label}
                </Text>
            )}
        </Flex>
    );
});

CompactAISelector.displayName = 'CompactAISelector';

import { Badge, Box, HStack, Link, Spinner, Stack, Text, VStack } from '@chakra-ui/react';
import type { CalendarEvent } from '@marketmind/types';
import { format, formatDistanceToNow, isPast } from 'date-fns';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    FiCalendar,
    FiExternalLink,
    FiGift,
    FiMapPin,
    FiPackage,
    FiTrendingUp,
    FiUsers,
    FiZap,
} from 'react-icons/fi';
import { useCalendar } from '../../hooks/useCalendar';

interface CalendarPanelProps {
    symbols?: string[];
    refetchTrigger?: number;
}

const EVENT_TYPE_CONFIG = {
    conference: { colorPalette: 'blue', icon: FiUsers, labelKey: 'calendar.eventTypes.conference' },
    release: { colorPalette: 'purple', icon: FiPackage, labelKey: 'calendar.eventTypes.release' },
    airdrop: { colorPalette: 'green', icon: FiGift, labelKey: 'calendar.eventTypes.airdrop' },
    update: { colorPalette: 'cyan', icon: FiZap, labelKey: 'calendar.eventTypes.update' },
    listing: { colorPalette: 'orange', icon: FiTrendingUp, labelKey: 'calendar.eventTypes.listing' },
    partnership: { colorPalette: 'pink', icon: FiUsers, labelKey: 'calendar.eventTypes.partnership' },
    other: { colorPalette: 'gray', icon: FiCalendar, labelKey: 'calendar.eventTypes.other' },
};

const IMPORTANCE_CONFIG = {
    low: { colorPalette: 'gray', labelKey: 'calendar.importance.low' },
    medium: { colorPalette: 'blue', labelKey: 'calendar.importance.medium' },
    high: { colorPalette: 'orange', labelKey: 'calendar.importance.high' },
    critical: { colorPalette: 'red', labelKey: 'calendar.importance.critical' },
};

const EventTypeBadge = ({ type }: { type: CalendarEvent['type'] }) => {
    const { t } = useTranslation();
    const config = EVENT_TYPE_CONFIG[type];
    const Icon = config.icon;

    return (
        <Badge colorPalette={config.colorPalette} variant="subtle">
            <HStack gap={1}>
                <Icon size={12} />
                <Text>{t(config.labelKey)}</Text>
            </HStack>
        </Badge>
    );
};

const ImportanceBadge = ({ importance }: { importance: CalendarEvent['importance'] }) => {
    const { t } = useTranslation();
    const config = IMPORTANCE_CONFIG[importance];

    return (
        <Badge colorPalette={config.colorPalette} variant="solid" size="xs">
            {t(config.labelKey)}
        </Badge>
    );
};

const EventCard = ({ event }: { event: CalendarEvent }) => {
    const { t } = useTranslation();
    const isEventPast = isPast(event.startDate);
    const isOngoing = event.endDate && event.startDate <= Date.now() && event.endDate >= Date.now();

    return (
        <Box
            p={4}
            borderWidth="1px"
            borderRadius="md"
            borderColor="border.subtle"
            bg="bg.surface"
            _hover={{ bg: 'bg.muted', borderColor: 'border.emphasized' }}
            transition="all 0.2s"
            opacity={isEventPast ? 0.7 : 1}
        >
            <VStack align="stretch" gap={3}>
                <HStack justify="space-between" align="start" gap={2}>
                    <VStack align="stretch" flex={1} gap={1}>
                        <HStack gap={2}>
                            {event.url ? (
                                <Link
                                    href={event.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    flex={1}
                                    _hover={{ textDecoration: 'none' }}
                                    onClick={(e) => {
                                        e.preventDefault();
                                        window.open(event.url, '_blank');
                                    }}
                                >
                                    <Text fontWeight="semibold" fontSize="sm" lineHeight="1.4">
                                        {event.title}
                                    </Text>
                                </Link>
                            ) : (
                                <Text fontWeight="semibold" fontSize="sm" lineHeight="1.4">
                                    {event.title}
                                </Text>
                            )}
                            {event.url && <FiExternalLink size={14} />}
                        </HStack>

                        {event.description && (
                            <Text fontSize="xs" color="fg.muted" lineHeight="1.4">
                                {event.description}
                            </Text>
                        )}
                    </VStack>
                </HStack>

                <HStack gap={2} flexWrap="wrap">
                    <EventTypeBadge type={event.type} />
                    <ImportanceBadge importance={event.importance} />

                    {isOngoing && (
                        <Badge colorPalette="green" variant="solid" size="xs">
                            {t('calendar.status.ongoing')}
                        </Badge>
                    )}

                    {isEventPast && !isOngoing && (
                        <Badge colorPalette="gray" variant="outline" size="xs">
                            {t('calendar.status.past')}
                        </Badge>
                    )}
                </HStack>

                <VStack align="stretch" gap={1}>
                    <HStack gap={2} fontSize="xs" color="fg.muted">
                        <FiCalendar size={12} />
                        <Text>
                            {format(event.startDate, 'PPP p')}
                            {event.endDate && ` - ${format(event.endDate, 'PPP p')}`}
                        </Text>
                    </HStack>

                    {!isEventPast && (
                        <HStack gap={2} fontSize="xs" color="fg.muted">
                            <Text>
                                {formatDistanceToNow(event.startDate, { addSuffix: true })}
                            </Text>
                        </HStack>
                    )}

                    {event.location && (
                        <HStack gap={2} fontSize="xs" color="fg.muted">
                            <FiMapPin size={12} />
                            <Text>{event.location}</Text>
                        </HStack>
                    )}
                </VStack>

                <HStack justify="space-between" align="center" flexWrap="wrap" gap={2}>
                    <Text fontSize="xs" color="fg.muted">
                        {event.source}
                    </Text>

                    {event.symbols && event.symbols.length > 0 && (
                        <HStack gap={1}>
                            {event.symbols.slice(0, 3).map((symbol) => (
                                <Badge key={symbol} size="xs" variant="outline">
                                    {symbol}
                                </Badge>
                            ))}
                            {event.symbols.length > 3 && (
                                <Badge size="xs" variant="outline">
                                    +{event.symbols.length - 3}
                                </Badge>
                            )}
                        </HStack>
                    )}
                </HStack>
            </VStack>
        </Box>
    );
};

export const CalendarPanel = ({ symbols, refetchTrigger }: CalendarPanelProps) => {
    const { t } = useTranslation();
    const { events, loading, error, fetchEvents, settings } = useCalendar();

    useEffect(() => {
        if (settings.enabled && (refetchTrigger === undefined || refetchTrigger > 0)) {
            console.log('[CalendarPanel] Fetching events, trigger:', refetchTrigger);
            const filter = symbols ? { symbols } : {};
            void fetchEvents(filter);
        }
    }, [refetchTrigger, symbols, fetchEvents, settings.enabled]);

    if (!settings.enabled) {
        return (
            <Box p={8} textAlign="center">
                <Text color="fg.muted" fontSize="sm">
                    {t('calendar.disabled')}
                </Text>
                <Text color="fg.muted" fontSize="xs" mt={2}>
                    {t('calendar.enableInSettings')}
                </Text>
            </Box>
        );
    }

    if (loading && events.length === 0) {
        return (
            <Box p={8} display="flex" justifyContent="center" alignItems="center">
                <Spinner size="lg" />
            </Box>
        );
    }

    if (error) {
        return (
            <Box p={4} bg="red.50" borderRadius="md">
                <Text color="red.700" fontSize="sm">
                    {t('calendar.failedToLoad')}: {error.message}
                </Text>
            </Box>
        );
    }

    if (events.length === 0) {
        return (
            <Box p={8} textAlign="center">
                <Text color="fg.muted" fontSize="sm">
                    {t('calendar.noEvents')}
                </Text>
            </Box>
        );
    }

    const sortedEvents = [...events].sort((a, b) => a.startDate - b.startDate);

    return (
        <Stack gap={3} p={4}>
            {sortedEvents.map((event) => (
                <EventCard key={event.id} event={event} />
            ))}
        </Stack>
    );
};

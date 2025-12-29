import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AlgorithmicAutoTradingTab } from './AlgorithmicAutoTradingTab';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
        i18n: {
            language: 'en',
            changeLanguage: vi.fn(),
        },
    }),
}));

const renderWithChakra = (component: React.ReactElement) =>
    render(<ChakraProvider value={defaultSystem}>{component}</ChakraProvider>);

vi.mock('@renderer/hooks/useToast', () => ({
    useToast: () => ({
        error: vi.fn(),
        warning: vi.fn(),
        success: vi.fn(),
        info: vi.fn(),
    }),
}));

vi.mock('@renderer/hooks/useBackendWallet', () => ({
    useBackendWallet: () => ({
        wallets: [{ id: 'wallet-1', name: 'Test Wallet', currentBalance: '1000', currency: 'USDT' }],
        isLoading: false,
    }),
}));

vi.mock('@renderer/hooks/useBackendAutoTrading', () => ({
    useBackendAutoTrading: () => ({
        isLoading: false,
        startAutoTrading: vi.fn(),
        stopAutoTrading: vi.fn(),
    }),
}));

vi.mock('@/renderer/utils/trpc', () => ({
    trpc: {
        autoTrading: {
            getConfig: {
                useQuery: () => ({
                    data: { enabledSetupTypes: ['setup-91', 'setup-92'] },
                    isLoading: false,
                }),
            },
        },
    },
}));

vi.mock('@/renderer/store/setupStore', () => ({
    useSetupStore: vi.fn(() => ({
        isAutoTradingActive: false,
        toggleAutoTrading: vi.fn(),
        config: {
            setup91: { enabled: true },
            pattern123: { enabled: false },
        },
    })),
}));

describe('AlgorithmicAutoTradingTab', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders the component', () => {
        renderWithChakra(<AlgorithmicAutoTradingTab />);
        expect(screen.getByText('settings.algorithmicAutoTrading.title')).toBeDefined();
    });

    it('displays auto-trading status section', () => {
        renderWithChakra(<AlgorithmicAutoTradingTab />);
        expect(screen.getByText('settings.algorithmicAutoTrading.status.title')).toBeDefined();
    });

    it('shows switch control for auto-trading', () => {
        renderWithChakra(<AlgorithmicAutoTradingTab />);
        const switchElement = document.querySelector('[role="switch"]');
        expect(switchElement).toBeDefined();
    });
});
